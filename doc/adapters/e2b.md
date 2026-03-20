# E2B Cloud Sandbox Adapter

**Adapter type**: `e2b`  
**Package**: `@paperclipai/server` (in-tree)  
**Registered**: Server ✓

通过 E2B 云端沙箱运行 agent。支持沙箱生命周期管理（创建 → 执行 → 保持活跃），以及跨 heartbeat 复用沙箱实例。

---

## 何时使用

| 场景 | 推荐 |
|------|------|
| 需要在隔离云端沙箱中运行 agent | 用 **`e2b`** |
| agent 运行在本地同一台机器 | 用 `process` adapter 或本地 adapters |
| 调用外部 HTTP agent 服务 | 用 `http` adapter |
| 需要实时 stdout 捕获和运行查看 | 用本地 adapters（`claude_local` 等） |

---

## 配置字段

在 Paperclip UI 中创建/编辑 Agent 时，选择 "E2B" 类型后填写以下字段：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `template` | string | — | `base` | E2B 沙箱模板名称或 ID |
| `startupCommand` | string | — | `echo 'E2B sandbox ready'` | 沙箱启动后执行的命令 |
| `idleTimeoutMs` | number | — | `600000` (10 分钟) | 沙箱空闲超时（毫秒），超时后自动 kill |
| `timeoutMs` | number | — | `300000` (5 分钟) | 单次命令执行超时（毫秒） |

### 环境变量（通过 secrets 注入）

在 adapter 配置的 `env` 区块中添加：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `E2B_API_KEY` | string | ✓ | E2B API Key。建议使用 company secret 引用，避免明文存储 |

### 配置示例（JSON）

```json
{
  "template": "base",
  "startupCommand": "echo 'Sandbox ready'",
  "idleTimeoutMs": 600000,
  "timeoutMs": 300000,
  "env": {
    "E2B_API_KEY": {
      "type": "secret_ref",
      "secretId": "<your-secret-id>",
      "version": "latest"
    }
  }
}
```

---

## 沙箱生命周期

### 首次运行（心跳 1）

1. 调用 `Sandbox.create()` 创建新沙箱
2. 执行配置的 `startupCommand`
3. 将沙箱 ID (`sandboxId`) 存入 `sessionParams`，供后续心跳复用
4. 调用 `sandbox.setTimeout(idleTimeoutMs)` 设置空闲超时

### 后续运行（心跳 N）

1. 从 `sessionParams.sandboxId` 读取沙箱 ID
2. 调用 `Sandbox.connect(sandboxId)` 连接到已有沙箱
3. 验证沙箱是否仍在运行
4. 若沙箱已停止，自动创建新沙箱
5. 执行 `startupCommand`
6. 更新空闲超时

### 沙箱清理

- **错误时**：adapter 在错误返回前自动调用 `sandbox.kill()`
- **空闲超时**：`idleTimeoutMs` 到期后 E2B 平台自动 kill 沙箱
- **clearSession**：`clearSession: true` 时心跳服务会清空 sessionParams，下次运行创建新沙箱

---

## Session 持久化

e2b adapter 将沙箱 ID 存储在 session 中，实现跨心跳的沙箱复用：

```
sessionParams.sandboxId         → E2B 沙箱 ID
sessionParams.sandboxConnected  → 连接状态标志
```

每次运行结果中，`sessionId` 和 `sessionDisplayId` 均返回沙箱 ID，便于在 Paperclip UI 中查看。

---

## 环境测试（Test Environment）

在 Paperclip UI 中点击 "Test environment" 按钮，adapter 执行以下检查：

| 检查项 | 级别 | 说明 |
|--------|------|------|
| `e2b_api_key_missing` | error | 未配置 E2B API Key |
| `e2b_api_key_present` | info | API Key 已配置 |
| `e2b_template_configured` | info | 使用了自定义沙箱模板 |
| `e2b_template_default` | info | 使用默认 base 模板 |
| `e2b_startup_command_configured` | info | 配置了启动命令 |

---

## 错误代码

| errorCode | 含义 | 处理建议 |
|-----------|------|---------|
| `e2b_api_key_missing` | 缺少 E2B_API_KEY | 在 adapterConfig.env 中添加 secret 引用 |
| `e2b_timeout` | 沙箱创建或操作超时 | 检查网络或增大 timeoutMs |
| `e2b_error` | 沙箱执行出错 | 查看 errorMessage 详情 |
| `e2b_command_timeout` | startupCommand 执行超时 | 增大 timeoutMs 或优化命令 |
| `e2b_command_failed` | startupCommand 非零退出码 | 检查命令本身是否正确 |

---

## 实现文件

```
server/src/adapters/e2b/
├── index.ts       # 模块定义（type, execute, testEnvironment, agentConfigurationDoc）
├── execute.ts     # 沙箱生命周期管理（create → connect → run → keepalive）
└── test.ts        # 环境诊断
```

---

## 相关文档

- E2B 官方文档：https://e2b.dev/docs
- E2B JavaScript SDK：https://e2b.dev/docs/sdk-reference/js-sdk
- Adapter 创建指南：[`.agents/skills/create-agent-adapter/SKILL.md`](https://github.com/paperclipai/paperclip/blob/main/.agents/skills/create-agent-adapter/SKILL.md)

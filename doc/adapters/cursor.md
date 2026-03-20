# Cursor (HTTP) Adapter

**Adapter type**: `cursor_http`  
**Package**: `@paperclipai/adapter-cursor-http`  
**Registered**: Server ✓ · UI ✓ · CLI ✓

通过 HTTP API 将任何兼容的 Cursor Agent 网关接入 Paperclip。支持轮询和回调两种异步完成通知模式。

---

## 何时使用

| 场景 | 推荐 |
|------|------|
| Cursor Agent CLI 本地可用 | 用 `cursor` adapter（subprocess） |
| 有自托管的 Cursor Agent HTTP 网关 | 用 **`cursor_http`** |
| 只有一个简单的 shell 命令要跑 | 用 `process` adapter |
| Cursor HTTP 端点不可达 | 先检查网络，或改用 `cursor` 本地模式 |

---

## 配置字段

在 Paperclip UI 中创建/编辑 Agent 时，选择 "Cursor (HTTP)" 类型后填写以下字段：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `url` | string | ✓ | — | Cursor Agent 的 HTTP 端点，例如 `https://cursor-agent.example.com/run` |
| `authToken` | string | — | — | Bearer Token，用于 endpoint 鉴权 |
| `callbackUrl` | string | — | — | 异步完成回调 URL（可选；不填则走轮询） |
| `method` | string | — | `POST` | HTTP 方法 |
| `model` | string | — | `auto` | Cursor 模型 ID，默认为 auto |
| `promptTemplate` | string | — | 提示词模板 | 支持 `{{agent.id}}`、`{{runId}}` 等变量 |
| `timeoutSec` | number | — | `120` | HTTP 请求超时（秒） |
| `pollIntervalMs` | number | — | `5000` | 轮询间隔（毫秒）；仅在无 callbackUrl 时生效 |
| `maxPollAttempts` | number | — | `60` | 最大轮询次数；超时后返回错误 |
| `sessionId` | string | — | — | 可复用的 Cursor session ID |
| `headers` | object | — | — | 额外的 HTTP 请求头 |

### Prompt 模板变量

| 变量 | 说明 |
|------|------|
| `{{agent.id}}` | Agent ID |
| `{{agent.name}}` | Agent 名称 |
| `{{runId}}` | 当前 Run ID |
| `{{companyId}}` | 公司 ID |
| `{{taskId}}` | 当前任务 ID（如果有） |
| `{{wakeReason}}` | 唤醒原因 |

### 环境变量（自动注入）

请求体中会自动包含以下 Paperclip 运行时变量：

- `runId` — 当前运行 ID
- `agentId` — Agent ID
- `companyId` — 公司 ID
- `taskId` — 当前任务/Issue ID
- `wakeReason` — 唤醒原因（`on_demand`、`scheduled`、`assignment` 等）
- `apiUrl` — Paperclip API 地址

---

## 端点响应格式

Cursor HTTP 端点应返回 JSON，推荐响应格式：

```json
{
  "status": "completed",
  "sessionId": "cursor-session-abc123",
  "summary": "完成了登录逻辑重构",
  "result": "...",
  "usage": {
    "inputTokens": 5000,
    "outputTokens": 2000,
    "cachedInputTokens": 3000
  },
  "costUsd": 0.015,
  "provider": "cursor",
  "model": "gpt-5.3-codex"
}
```

### 支持的 status 值

| status | 含义 |
|--------|------|
| `completed` / `done` / `success` | 成功完成 |
| `pending` / `running` / `accepted` | 运行中（adapter 会轮询或等待回调） |
| `failed` / `error` | 执行失败 |
| `timeout` / `timed_out` | 超时 |

### 错误格式

```json
{
  "status": "error",
  "error": "Cursor agent failed: permission denied on repository",
  "sessionId": "cursor-session-abc123"
}
```

---

## 执行模式

### 同步模式（无 callbackUrl）

1. 发送 HTTP POST 请求到 `url`
2. 如果响应 `status` 为 pending/running/accepted，立即进入轮询模式
3. 轮询 `GET <url>?runId=<runId>` 直到完成或超时
4. 解析结果并返回

### 回调模式（有 callbackUrl）

1. 发送 HTTP POST 请求到 `url`，带上 `callbackUrl`
2. 如果响应 status 为 pending/running/accepted，进入等待
3. adapter 在内部轮询直到收到回调或超时
4. Cursor 网关自行向 `callbackUrl` 发送完成通知

---

## Session 持久化

cursor_http adapter 支持 session 复用：

1. **首次运行**：端点返回的 `sessionId` 通过 `sessionCodec` 持久化到 Paperclip DB
2. **后续运行**：adapter 自动从 `runtime.sessionParams` 中取出 sessionId，附加到请求中
3. **端点支持**：Cursor 网关需要能够识别 `sessionId` 参数并恢复会话
4. **清理**：session 错误时 adapter 自动设置 `clearSession: true` 并重试

---

## 环境测试（Test Environment）

在 Paperclip UI 中点击 "Test environment" 按钮，adapter 会执行以下检查：

| 检查项 | 级别 | 说明 |
|--------|------|------|
| `CURSOR_HTTP_URL_CONFIGURED` | info | URL 已配置 |
| `CURSOR_HTTP_URL_SECURE` | info | 使用 HTTPS |
| `CURSOR_HTTP_URL_PLAINTEXT` | warn | 使用 HTTP（非生产推荐） |
| `CURSOR_HTTP_URL_MISSING` | error | URL 未配置 |
| `CURSOR_HTTP_URL_INVALID` | error | URL 格式无效 |
| `CURSOR_HTTP_AUTH_TOKEN` | info | Token 已配置 |
| `CURSOR_HTTP_NO_AUTH` | warn | 无认证 Token |
| `CURSOR_HTTP_CALLBACK` | info | 配置了回调 URL |
| `CURSOR_HTTP_TIMEOUT` | info | 显示超时设置 |

---

## 可用模型

以下模型 ID 可填入 `model` 字段：

### GPT Codex 系列
- `gpt-5.3-codex-high-fast`, `gpt-5.3-codex-high`, `gpt-5.3-codex-fast`, `gpt-5.3-codex`
- `gpt-5.3-codex-xhigh-fast`, `gpt-5.3-codex-xhigh`
- `gpt-5.3-codex-low-fast`, `gpt-5.3-codex-low`
- `gpt-5.3-codex-spark-preview`
- `gpt-5.2-codex-high-fast`, `gpt-5.2-codex-high`, `gpt-5.2-codex-fast`, `gpt-5.2-codex`
- `gpt-5.2-codex-xhigh-fast`, `gpt-5.2-codex-xhigh`
- `gpt-5.2-codex-low-fast`, `gpt-5.2-codex-low`
- `gpt-5.1-codex-max`, `gpt-5.1-codex-max-high`, `gpt-5.1-codex-mini`

### GPT 系列
- `gpt-5.2-high`, `gpt-5.1-high`

### Opus / Sonnet
- `opus-4.6-thinking`, `opus-4.6`, `opus-4.5-thinking`, `opus-4.5`
- `sonnet-4.6-thinking`, `sonnet-4.6`, `sonnet-4.5-thinking`, `sonnet-4.5`

### Gemini / 其他
- `gemini-3.1-pro`, `gemini-3-pro`, `gemini-3-flash`
- `grok`, `kimi-k2.5`

### Composer
- `composer-1.5`, `composer-1`

### 默认
- `auto` — 使用 Cursor 默认模型

---

## 实现文件

```
packages/adapters/cursor-http/
├── src/
│   ├── index.ts                 # 元数据（type, label, models, agentConfigurationDoc）
│   ├── server/
│   │   ├── index.ts            # 导出 execute, testEnvironment, sessionCodec
│   │   ├── execute.ts          # 核心执行逻辑（HTTP + 轮询）
│   │   ├── parse.ts            # 响应解析 + 错误检测
│   │   └── test.ts             # 环境诊断
│   ├── ui/
│   │   ├── index.ts            # UI 导出
│   │   ├── parse-stdout.ts     # TranscriptEntry 解析
│   │   └── build-config.ts      # CreateConfigValues -> adapterConfig
│   └── cli/
│       ├── index.ts            # CLI 导出
│       └── format-event.ts     # 终端格式化输出
└── package.json
```

---

## 相关文档

- 技术调研：[`doc/plans/2026-02-23-cursor-cloud-adapter.md`](../plans/2026-02-23-cursor-cloud-adapter.md)
- HTTP Adapter 参考：[`server/src/services/adapters/http.ts`](https://github.com/paperclipai/paperclip/blob/main/server/src/services/adapters/http.ts)
- Adapter 创建指南：[`.agents/skills/create-agent-adapter/SKILL.md`](https://github.com/paperclipai/paperclip/blob/main/.agents/skills/create-agent-adapter/SKILL.md)

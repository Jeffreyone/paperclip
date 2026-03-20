# Plugin 沙箱架构设计

> 文档状态：草案  
> 创建日期：2026-03-20  
> 关联任务：WLF-118, WLF-116  
> 验收：软件工程师可基于本文档开始实现

---

## 1. 概述

本文档定义 Paperclip Plugin 沙箱加固的详细架构设计方案，覆盖进程隔离、失败回滚、版本管理和权限边界四个核心主题。

### 1.1 设计目标

1. **隔离性**：单个 plugin 崩溃/异常不影响 host 和其他 plugin
2. **可靠性**：plugin 失败后可自动恢复或回滚到稳定状态
3. **可追溯性**：plugin 版本变更、状态迁移有完整审计日志
4. **安全性**：plugin 只能访问被明确授权的资源和 API

### 1.2 范围

本文档覆盖：

- ✅ 进程隔离方案（child_process vs worker_threads）
- ✅ Plugin 生命周期管理（启动、停止、重启）
- ✅ IPC 机制设计（JSON-RPC over stdio）
- ✅ 失败回滚策略（事务性安装/更新）
- ✅ 版本管理 schema 设计
- ✅ upgrade/downgrade 流程
- ✅ 权限边界（capability 白名单）
- ✅ 资源限制（CPU/内存/超时）

本文档**不覆盖**：

- ❌ Plugin UI 沙箱（前端隔离，属未来 scope）
- ❌ Plugin 市场/分发机制
- ❌ 多节点部署下的 plugin 同步

---

## 2. 进程隔离方案

### 2.1 方案对比

| 方案 | 隔离级别 | 通信开销 | 资源占用 | 调试难度 | 推荐场景 |
|------|---------|---------|---------|---------|---------|
| `child_process.fork()` | 进程级 | 中（序列化） | 高（独立 V8） | 低 | **生产环境默认** |
| `worker_threads` | 线程级 | 低（共享内存） | 中（共享 V8） | 中 | 计算密集型任务 |
| 独立进程（spawn） | 进程级 | 高（stdio/pipe） | 高 | 低 | 非 Node 插件 |
| VM 沙箱（vm2） | 上下文级 | 极低 | 低 | 高 | **开发/测试模式** |

### 2.2 推荐架构：**混合模式**

```
┌─────────────────────────────────────────────────────────┐
│                  Paperclip Host Process                  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Plugin Worker Manager                             │  │
│  │  - 进程池管理                                       │  │
│  │  - 健康检查                                         │  │
│  │  - 崩溃恢复                                         │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ JSON-RPC    │ │ JSON-RPC    │ │ JSON-RPC    │       │
│  │ 通道 1       │ │ 通道 2       │ │ 通道 3       │       │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘       │
└─────────┼───────────────┼───────────────┼──────────────┘
          │ stdio         │ stdio         │ stdio
┌─────────▼───────┐ ┌────▼──────────────┐ ┌▼──────────────┐
│ Plugin A Worker │ │ Plugin B Worker   │ │ Plugin C      │
│ (child_process) │ │ (child_process)   │ │ (VM sandbox)  │
│ 生产模式         │ │ 生产模式           │ │ 开发/测试模式  │
└─────────────────┘ └───────────────────┘ └───────────────┘
```

### 2.3 实现决策

**生产环境（默认）**：
- 使用 `child_process.fork()` 启动每个 plugin worker
- 每个 plugin 一个独立进程，互不影响
- JSON-RPC 2.0 over stdio 通信

**开发/测试模式**：
- 可选 VM 沙箱模式（通过 `plugin-runtime-sandbox.ts`）
- 用于快速迭代和调试
- **禁止在生产环境使用**

### 2.4 进程生命周期管理

```typescript
interface PluginWorkerLifecycle {
  // 1. 启动阶段
  spawn(): Promise<void>           // 启动进程
  initialize(): Promise<void>      // 发送 initialize RPC
  healthCheck(): Promise<boolean>  // 健康检查
  
  // 2. 运行阶段
  sendRequest<T>(method: string, params: unknown): Promise<T>
  sendNotification(method: string, params: unknown): void
  
  // 3. 停止阶段
  shutdown(graceful: boolean): Promise<void>  // 优雅关闭
  kill(): Promise<void>                       // 强制终止
  
  // 4. 监控
  onExit(callback: (code: number, signal: string) => void): void
  onError(callback: (error: Error) => void): void
}
```

### 2.5 IPC 协议：JSON-RPC 2.0

**Host → Worker 方法**：
- `initialize(params)` - 初始化
- `health()` - 健康检查
- `shutdown(params)` - 优雅关闭
- `onEvent(params)` - 事件通知
- `runJob(params)` - 执行定时任务
- `handleWebhook(params)` - Webhook 处理
- `getData(params)` - UI 数据请求
- `performAction(params)` - UI 动作执行
- `executeTool(params)` - Agent 工具执行

**Worker → Host 方法**：
- `state.get(key)` - 读取 plugin 状态
- `state.set(key, value)` - 写入 plugin 状态
- `events.emit(name, payload)` - 发出事件
- `secrets.resolve(ref)` - 解析 secret 引用
- `assets.read(id)` - 读取资产
- `assets.write(data)` - 写入资产

---

## 3. 失败回滚机制

### 3.1 失败场景分类

| 阶段 | 失败类型 | 恢复策略 | 回滚需求 |
|------|---------|---------|---------|
| 安装 | npm install 失败 | 清理 node_modules | ✅ 卸载包 |
| 启动 | worker spawn 失败 | 重试 3 次 | ✅ 标记 error |
| 初始化 | initialize 超时 | 重试 2 次 | ✅ 停止进程 |
| 运行 | 进程崩溃 | 指数退避重启 | ❌ 自动恢复 |
| 更新 | upgrade 失败 | 回滚到前一版本 | ✅ 版本回滚 |
| 配置 | config 验证失败 | 拒绝变更 | ✅ 恢复旧配置 |

### 3.2 事务性安装流程

```
1. 下载 plugin 包到临时目录
   └─> /tmp/paperclip-plugins/<plugin-id>-<timestamp>/

2. 运行 npm install --production
   └─> 失败：删除临时目录，返回错误
   └─> 成功：继续

3. 读取并验证 manifest
   └─> 失败：删除临时目录，返回错误
   └─> 成功：继续

4. 移动到目标目录
   └─> ~/.paperclip/instances/default/plugins/node_modules/<plugin-name>/

5. 数据库持久化（status: 'installed'）
   └─> 失败：删除目标目录，返回错误
   └─> 成功：继续

6. 启动 worker 并健康检查
   └─> 失败：status 标记 'error'，保留包以便调试
   └─> 成功：status 标记 'ready'
```

### 3.3 回滚策略实现

```typescript
interface RollbackStrategy {
  // 安装回滚
  rollbackInstall(pluginId: string): Promise<void>
  
  // 版本回滚（降级）
  rollbackVersion(pluginId: string, targetVersion: string): Promise<void>
  
  // 配置回滚
  rollbackConfig(pluginId: string): Promise<void>
  
  // 状态回滚（标记为 uninstalled）
  rollbackStatus(pluginId: string): Promise<void>
}

// 实现示例
async function rollbackInstall(pluginId: string) {
  const plugin = await registry.getById(pluginId);
  if (!plugin) throw notFound(`Plugin ${pluginId} not found`);
  
  // 1. 停止 worker
  await lifecycleManager.unload(pluginId);
  
  // 2. 删除包文件
  await fs.promises.rm(plugin.packagePath, { recursive: true, force: true });
  
  // 3. 软删除数据库记录
  await registry.update(pluginId, { status: 'uninstalled' });
  
  // 4. 记录审计日志
  await activityLog.log({
    action: 'plugin.rollback_install',
    entityType: 'plugin',
    entityId: pluginId,
    details: { reason: 'installation_failure' }
  });
}
```

### 3.4 错误边界设计

```typescript
// 插件级别的错误隔离
class PluginErrorBoundary {
  private readonly pluginId: string;
  private crashCount = 0;
  private lastCrashTime: number | null = null;
  
  async executeWithBoundary<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.crashCount++;
      this.lastCrashTime = Date.now();
      
      // 检查是否在崩溃窗口内
      if (this.isConsecutiveCrash()) {
        if (this.crashCount >= MAX_CONSECUTIVE_CRASHES) {
          // 超过阈值，标记为 error 状态
          await this.markError(error);
          throw new PluginCrExhaustedError(
            `Plugin ${this.pluginId} crashed ${this.crashCount} times`
          );
        }
      }
      
      // 记录错误但不影响 host
      logger.error(`Plugin ${this.pluginId} operation ${operation} failed`, error);
      throw error;
    }
  }
  
  private isConsecutiveCrash(): boolean {
    if (!this.lastCrashTime) return false;
    return Date.now() - this.lastCrashTime < CRASH_WINDOW_MS;
  }
}
```

---

## 4. 版本管理

### 4.1 数据模型

#### 4.1.1 `plugins` 表（现有）

```typescript
interface PluginRecord {
  id: string;                    // UUID
  pluginKey: string;             // 唯一标识（manifest.id）
  packageName: string;           // npm 包名
  version: string;               // 当前版本
  apiVersion: number;            // Plugin API 版本
  categories: PluginCategory[];  // 分类
  manifestJson: ManifestV1;      // 完整 manifest
  status: PluginStatus;          // 状态机
  installOrder: number;          // 安装顺序
  packagePath: string | null;    // 本地路径
  lastError: string | null;      // 最后错误信息
  installedAt: Date;
  updatedAt: Date;
}
```

#### 4.1.2 新增：`plugin_versions` 表

用于追踪历史版本，支持回滚：

```sql
CREATE TABLE plugin_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  package_path TEXT NOT NULL,
  manifest_json JSONB NOT NULL,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uninstalled_at TIMESTAMPTZ,
  uninstall_reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  
  -- 索引
  UNIQUE(plugin_id, version),
  INDEX idx_plugin_versions_active (plugin_id, is_active)
);
```

#### 4.1.3 新增：`plugin_config_revisions` 表

用于配置版本控制：

```sql
CREATE TABLE plugin_config_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  config_json JSONB NOT NULL,
  change_summary TEXT,
  changed_by_user_id UUID REFERENCES users(id),
  changed_by_agent_id UUID REFERENCES agents(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- 索引
  UNIQUE(plugin_id, revision_number),
  INDEX idx_plugin_config_plugin (plugin_id, created_at DESC)
);
```

### 4.2 Upgrade 流程

```
1. 下载新版本到临时目录
   └─> /tmp/paperclip-plugins/<plugin-id>-<new-version>/

2. 读取新版本 manifest，比较 capabilities
   └─> 新增 capability：标记 upgrade_pending，等待审批
   └─> 无新增：继续

3. 停止当前版本 worker（优雅关闭）
   └─> 发送 shutdown() RPC
   └─> 等待 10 秒
   └─> 未退出：SIGTERM → SIGKILL

4. 备份当前版本路径
   └─> 记录到 plugin_versions 表（is_active: false）

5. 移动新版本到目标目录

6. 启动新版本 worker
   └─> 失败：回滚到旧版本（步骤 7）
   └─> 成功：继续

7. 更新数据库
   └─> plugins.version = new_version
   └─> plugin_versions.is_active = true (new)
   └─> status = 'ready'

8. 清理旧版本（可选，保留最近 N 个版本）
```

### 4.3 Downgrade 流程

```
1. 从 plugin_versions 表查找目标版本
   └─> 不存在：报错（需重新安装）
   └─> 存在：继续

2. 停止当前版本 worker

3. 恢复目标版本的 package_path

4. 启动目标版本 worker

5. 更新数据库
   └─> plugins.version = target_version
   └─> plugin_versions.is_active = true (target)
```

### 4.4 状态迁移策略

```
┌─────────────┐
│ uninstalled │
└──────┬──────┘
       │ install
       ▼
┌─────────────┐
│  installed  │──────┐
└──────┬──────┘      │
       │ load        │ error
       ▼             │
┌─────────────┐      │
│    ready    │◄─────┘
└──┬─────┬────┘
   │      │ disable
   │      ▼
   │ ┌──────────┐
   │ │ disabled │
   │ └────┬─────┘
   │      │ enable
   │      ▼
   │ ┌──────────┐
   └─│  ready   │
     └──────────┘
```

---

## 5. 权限边界

### 5.1 Capability 白名单

Plugin 必须在 manifest 中声明所需 capabilities：

```json
{
  "id": "@paperclip/plugin-linear",
  "capabilities": [
    "issues.read",
    "issues.create",
    "issue.comments.create",
    "events.subscribe",
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register"
  ]
}
```

### 5.2 Capability 分类

| 类别 | Capabilities | 风险级别 |
|------|-------------|---------|
| **数据读取** | `issues.read`, `projects.read`, `agents.read`, `goals.read`, `activity.read`, `costs.read` | 低 |
| **数据写入** | `issues.create`, `issues.update`, `issue.comments.create`, `assets.write`, `activity.log.write` | 中 |
| **Plugin 状态** | `plugin.state.read`, `plugin.state.write` | 低 |
| **运行时** | `events.subscribe`, `events.emit`, `jobs.schedule`, `webhooks.receive`, `http.outbound`, `secrets.read-ref` | 高 |
| **Agent 工具** | `agent.tools.register` | 中 |
| **UI** | `instance.settings.register`, `ui.sidebar.register`, `ui.page.register`, `ui.detailTab.register`, `ui.dashboardWidget.register`, `ui.action.register` | 低 |

### 5.3 禁止的 Capabilities

以下 capabilities **永远不**对 plugin 开放：

- ❌ `approval.decide` - 审批决策
- ❌ `budget.override` - 预算覆盖
- ❌ `auth.bypass` - 认证绕过
- ❌ `issue.checkout.override` - 任务 checkout 覆盖
- ❌ `db.direct` - 直接数据库访问
- ❌ `agent.create` - 创建 agent
- ❌ `company.delete` - 删除公司

### 5.4 Capability  Enforcement

```typescript
// 在 plugin-worker-manager.ts 中实现
class PluginCapabilityValidator {
  private readonly manifest: ManifestV1;
  private readonly allowedCapabilities: Set<string>;
  
  constructor(manifest: ManifestV1) {
    this.manifest = manifest;
    this.allowedCapabilities = new Set(manifest.capabilities);
  }
  
  assertCapability(capability: string): void {
    if (!this.allowedCapabilities.has(capability)) {
      throw new CapabilityDeniedError(
        `Plugin ${this.manifest.id} does not have capability: ${capability}`
      );
    }
  }
  
  assertOperation(operation: string): void {
    const requiredCapability = this.getRequiredCapability(operation);
    this.assertCapability(requiredCapability);
  }
  
  private getRequiredCapability(operation: string): string {
    // 映射 operation 到 required capability
    const mapping: Record<string, string> = {
      'state.get': 'plugin.state.read',
      'state.set': 'plugin.state.write',
      'events.emit': 'events.emit',
      'http.request': 'http.outbound',
      'secrets.resolve': 'secrets.read-ref',
      // ...
    };
    return mapping[operation];
  }
}
```

### 5.5 资源限制

#### 5.5.1 CPU 限制

```typescript
// 使用 node:worker_threads 的 resourceLimits
const worker = new Worker(entryPath, {
  resourceLimits: {
    maxOldGenerationSizeMb: 512,      // 最大堆内存
    maxYoungGenerationSizeMb: 128,     // 新生代内存
    codeRangeSizeMb: 16,               // 代码区大小
  }
});

// 或使用 child_process + cgroups (Linux)
// 或使用 npm 包：cpulimit
```

#### 5.5.2 内存限制

```typescript
// 通过 NODE_OPTIONS 传递
const child = fork(entryPath, [], {
  env: {
    ...process.env,
    NODE_OPTIONS: '--max-old-space-size=512' // 512MB
  }
});

// 监控内存使用
setInterval(() => {
  if (child.memoryUsage.rss > MAX_MEMORY_BYTES) {
    logger.warn(`Plugin ${pluginId} exceeded memory limit, restarting...`);
    restartWorker();
  }
}, 30000);
```

#### 5.5.3 超时限制

```typescript
interface TimeoutConfig {
  initialize: 15000;      // 初始化超时
  rpc: 30000;             // 普通 RPC 超时
  job: 300000;            // 任务执行超时（5 分钟）
  webhook: 10000;         // Webhook 处理超时
  shutdown: 10000;        // 关闭超时
}

// 实现
async function sendWithTimeout<T>(
  method: string,
  params: unknown,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    this.sendRequest(method, params),
    timeout(timeoutMs).then(() => {
      throw new RpcTimeoutError(
        `Method ${method} timed out after ${timeoutMs}ms`
      );
    })
  ]);
}
```

#### 5.5.4 文件系统访问控制

```typescript
// 在 plugin-loader.ts 中实现
class PluginFileSystemSandbox {
  private readonly pluginRoot: string;
  private readonly allowedPaths: Set<string>;
  
  constructor(pluginRoot: string) {
    this.pluginRoot = realpathSync(pluginRoot);
    this.allowedPaths = new Set([
      this.pluginRoot,
      path.join(this.pluginRoot, 'data'),
    ]);
  }
  
  assertPathAllowed(targetPath: string): void {
    const realPath = realpathSync(targetPath);
    const isAllowed = Array.from(this.allowedPaths).some(root => 
      realPath === root || realPath.startsWith(root + path.sep)
    );
    
    if (!isAllowed) {
      throw new FileSystemAccessError(
        `Access denied to ${targetPath} - outside plugin root`
      );
    }
  }
}
```

---

## 6. 接口定义

### 6.1 Plugin Worker 接口

```typescript
// packages/plugins/sdk/src/worker-rpc-host.ts
// 注意：实际 SDK 使用高层钩子（setup, onHealth, onShutdown），
// 本文档使用底层 RPC 方法名以便理解协议层交互。
// 映射关系见 6.3 节。
export interface PluginWorker {
  // 生命周期
  initialize(input: InitializeInput): Promise<InitializeResult>;
  health(): Promise<HealthResult>;
  shutdown(input: ShutdownInput): Promise<void>;
  
  // 配置
  validateConfig?(input: ValidateConfigInput): Promise<ValidateConfigResult>;
  configChanged?(input: ConfigChangedInput): Promise<void>;
  
  // 事件
  onEvent(input: OnEventInput): Promise<void>;
  
  // 任务
  runJob(input: RunJobInput): Promise<RunJobResult>;
  
  // Webhook
  handleWebhook(input: HandleWebhookInput): Promise<HandleWebhookResult>;
  
  // UI
  getData(input: GetDataInput): Promise<GetDataResult>;
  performAction(input: PerformActionInput): Promise<PerformActionResult>;
  
  // Agent 工具
  executeTool?(input: ExecuteToolInput): Promise<ExecuteToolResult>;
}
```

### 6.2 Host Service 接口

```typescript
// packages/plugins/sdk/src/host-client-factory.ts
// Host services 通过 HostClient 提供给 plugin，
// 实际接口定义在 types.ts 中的 PluginHostServices 类型。
export interface PluginHostServices {
  // 状态管理
  state: {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<void>;
  };
  
  // 事件
  events: {
    emit(name: string, payload: unknown): Promise<void>;
    on(name: string, handler: EventHandler): Promise<void>;
    off(name: string, handler: EventHandler): Promise<void>;
  };
  
  // Secrets
  secrets: {
    resolve(ref: string): Promise<string>;
  };
  
  // 资产
  assets: {
    read(id: string): Promise<Asset>;
    write(data: Buffer, options: WriteOptions): Promise<Asset>;
  };
  
  // 日志
  logger: {
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    debug(message: string, ...args: unknown[]): void;
  };
}
```

### 6.3 接口映射关系：文档 vs 实际 SDK

本文档 6.1/6.2 节使用底层 RPC 方法名以便理解协议层交互，实际 SDK 使用高层钩子函数。映射关系如下：

| 文档方法 (RPC 层) | 实际 SDK 钩子 | 说明 |
|------------------|--------------|------|
| `initialize(params)` | `setup(context)` | 插件初始化，接收 host 上下文 |
| `health()` | `onHealth()` | 健康检查，返回插件状态 |
| `shutdown(params)` | `onShutdown(reason)` | 优雅关闭，接收关闭原因 |
| `onEvent(params)` | `onEvent(event)` | 事件处理 |
| `runJob(params)` | `onJob(job)` | 定时任务执行 |
| `handleWebhook(params)` | `onWebhook(webhook)` | Webhook 处理 |
| `getData(params)` | `onGetData(request)` | UI 数据请求 |
| `performAction(params)` | `onPerformAction(action)` | UI 动作执行 |
| `executeTool(params)` | `onExecuteTool(tool)` | Agent 工具执行 |

**SDK 文件结构**：
- `packages/plugins/sdk/src/types.ts` - 完整类型定义（PluginWorker, PluginHostServices 等）
- `packages/plugins/sdk/src/worker-rpc-host.ts` - Worker 侧 RPC 主机实现
- `packages/plugins/sdk/src/host-client-factory.ts` - Host 侧客户端工厂
- `packages/plugins/sdk/src/define-plugin.ts` - 插件定义辅助函数

### 6.4 CPU 限制跨平台策略

5.5.1 节的 CPU 限制实现在不同平台采用不同策略：

| 平台 | 实现方式 | 降级策略 |
|------|---------|---------|
| **Linux** | cgroups v2 (systemd) | 完整支持 |
| **macOS** | `process.nice()` + 资源限制 | 仅优先级控制，无硬限制 |
| **Windows** | `SetPriorityClass()` (通过 Node addon) | 仅优先级控制 |

**实现建议**：

```typescript
// 跨平台 CPU 限制抽象
class PluginCpuLimiter {
  async applyLimits(pluginId: string, limits: CpuLimits): Promise<void> {
    if (process.platform === 'linux') {
      // 使用 cgroups v2
      await this.applyCgroupsLimits(pluginId, limits);
    } else if (process.platform === 'darwin') {
      // macOS: 仅设置进程优先级
      await this.applyNiceLimits(pluginId, limits);
      logger.warn(`CPU limits on macOS are soft (priority-based only)`);
    } else {
      // Windows/其他：仅记录警告，不施加限制
      logger.warn(`CPU limits not available on ${process.platform}`);
    }
  }
  
  private async applyCgroupsLimits(pluginId: string, limits: CpuLimits): Promise<void> {
    // 使用 systemd-run 或 cgexec 包装进程
    // 或使用 npm 包：cgroup-v2
  }
  
  private async applyNiceLimits(pluginId: string, limits: CpuLimits): Promise<void> {
    // 使用 process.nice = value (需要 root/admin)
    // 或使用 npm 包：nice
  }
}
```

**配置建议**：

```typescript
interface PluginResourceLimits {
  cpuQuota?: {
    enabled: boolean;        // 是否启用 CPU 限制
    platform: 'linux' | 'darwin' | 'windows' | 'all';
    strategy: 'cgroups' | 'nice' | 'none';  // 自动根据平台选择
    quotaPercent?: number;   // CPU 配额百分比（Linux cgroups only）
    priority?: number;       // 进程优先级（macOS/Windows）
  };
  memoryLimitMb: number;     // 内存限制（所有平台）
  timeoutMs: TimeoutConfig;  // 超时限制（所有平台）
}
```

**风险评估**：
- ⚠️ **高风险**：cgroups 仅在 Linux 可用，macOS/Windows 用户可能遇到插件 CPU 占用过高问题
- ✅ **缓解措施**：
  1. 在生产部署文档中明确推荐 Linux 环境
  2. macOS/Windows 开发环境使用内存限制 + 超时作为替代保护
  3. 监控插件 CPU 使用率，异常时告警

---

## 7. 实现顺序建议

### 7.1 依赖关系图

```
┌──────────────────────────────────────────────────────────┐
│ Phase 1: 基础设施（1-2 周）                               │
├──────────────────────────────────────────────────────────┤
│ ✅ plugin-worker-manager.ts（已有，需加固）              │
│ ✅ plugin-runtime-sandbox.ts（已有，仅开发模式）         │
│ 🔲 plugin-capability-validator.ts（已有，需扩展）        │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│ Phase 2: 版本管理（1 周）                                 │
├──────────────────────────────────────────────────────────┤
│ 🔲 创建 plugin_versions 表迁移                            │
│ 🔲 创建 plugin_config_revisions 表迁移                   │
│ 🔲 实现 upgrade/downgrade 流程                           │
│ 🔲 实现回滚机制                                          │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│ Phase 3: 资源限制（1 周）                                 │
├──────────────────────────────────────────────────────────┤
│ 🔲 实现内存监控和限制                                     │
│ 🔲 实现 CPU 限制（Linux cgroups）                         │
│ 🔲 实现超时控制                                          │
│ 🔲 实现文件系统访问控制                                   │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│ Phase 4: 失败恢复（1 周）                                 │
├──────────────────────────────────────────────────────────┤
│ 🔲 实现崩溃检测和指数退避重启                             │
│ 🔲 实现事务性安装流程                                     │
│ 🔲 实现回滚策略                                          │
│ 🔲 添加错误边界                                          │
└──────────────────────────────────────────────────────────┘
```

### 7.2 可并行任务

| 任务组 | 可并行 | 依赖 |
|--------|--------|------|
| Phase 1 全部 | ✅ | 无 |
| `plugin_versions` 表创建 | ✅ | 无 |
| `plugin_config_revisions` 表创建 | ✅ | 无 |
| upgrade 流程实现 | ❌ | 需 `plugin_versions` 表 |
| downgrade 流程实现 | ❌ | 需 `plugin_versions` 表 |
| 内存限制 | ✅ | 无 |
| CPU 限制 | ✅ | 无 |
| 超时控制 | ✅ | 无 |
| 文件系统控制 | ✅ | 无 |
| 崩溃检测 | ❌ | 需 Phase 1 完成 |
| 事务性安装 | ❌ | 需 Phase 2 完成 |

### 7.3 建议实施顺序

1. **Week 1-2**: Phase 1（基础设施加固）
2. **Week 3**: Phase 2（版本管理）
3. **Week 4**: Phase 3（资源限制）
4. **Week 5**: Phase 4（失败恢复）
5. **Week 6**: 集成测试 + 文档

---

## 8. 风险评估

### 8.1 技术风险

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| child_process 内存泄漏 | 中 | 高 | 定期重启 worker，监控 RSS |
| JSON-RPC 序列化性能瓶颈 | 低 | 中 | 使用 Transferable，共享内存 |
| cgroups 兼容性（macOS/Windows） | 高 | 中 | 降级策略，仅 Linux 启用 CPU 限制 |
| 回滚失败导致数据不一致 | 中 | 高 | 事务性操作，审计日志 |

### 8.2 备选方案

**方案 A（推荐）**：child_process + JSON-RPC
- ✅ 成熟稳定
- ✅ 隔离性好
- ⚠️ 序列化开销

**方案 B**：worker_threads + SharedArrayBuffer
- ✅ 低延迟
- ✅ 共享内存
- ⚠️ 隔离性弱
- ⚠️ 调试困难

**方案 C**：独立容器（Docker）
- ✅ 最强隔离
- ✅ 资源限制原生支持
- ⚠️ 启动慢
- ⚠️ 运维复杂

---

## 9. 与现有系统兼容性

### 9.1 向后兼容

- ✅ 现有 plugin API 保持不变
- ✅ 现有 `plugins` 表结构不变（新增表，不修改）
- ✅ 现有 plugin worker 协议兼容

### 9.2 迁移路径

1. **阶段 1**：新安装使用新架构（默认 child_process）
2. **阶段 2**：现有 plugin 重启时迁移到新 worker 管理器
3. **阶段 3**：弃用 VM 沙箱生产模式（保留开发模式）

---

## 10. 验收标准

本文档完成的标准：

- [x] 软件工程师可基于文档开始实现
- [x] 方案与现有 plugin 系统兼容
- [x] 风险评估和备选方案说明
- [ ] 架构评审通过
- [ ] 实现任务分解到 JIRA/Paperclip issues

---

## 附录 A：术语表

| 术语 | 定义 |
|------|------|
| Host | Paperclip 主进程 |
| Worker | Plugin 工作进程 |
| Plugin Key | Plugin 唯一标识（manifest.id） |
| Capability | Plugin 权限声明 |
| JSON-RPC | 进程间通信协议 |

## 附录 B：参考文档

- [PLUGIN_SPEC.md](../plugins/PLUGIN_SPEC.md) - Plugin 系统完整规范
- [PLUGIN_SPEC.md §12](../plugins/PLUGIN_SPEC.md#12-runtime-model) - 运行时模型
- [PLUGIN_SPEC.md §15](../plugins/PLUGIN_SPEC.md#15-capability-system) - Capability 系统

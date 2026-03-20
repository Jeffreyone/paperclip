# Plugin 沙箱加固架构设计

> **文档状态**: 架构评审草案  
> **创建日期**: 2026-03-20  
> **关联任务**: WLF-116, WLF-107  
> **验收**: 软件工程师可基于本文档开始实现  
> **架构师**: @architect

---

## 1. 概述

本文档定义 Paperclip Plugin 沙箱加固的详细架构设计方案，覆盖**进程隔离**、**失败回滚**、**版本管理**和**权限边界**四个核心主题。

### 1.1 设计目标

1. **隔离性**: 单个 plugin 崩溃/异常不影响 host 和其他 plugin
2. **可靠性**: plugin 失败后可自动恢复或回滚到稳定状态
3. **可追溯性**: plugin 版本变更、状态迁移有完整审计日志
4. **安全性**: plugin 只能访问被明确授权的资源和 API

### 1.2 范围

**本文档覆盖**:
- ✅ 进程隔离方案（已有 `child_process.fork()`，需加固）
- ✅ Plugin 生命周期管理（启动、停止、重启）
- ✅ IPC 通信机制（JSON-RPC over stdio）
- ✅ 失败回滚策略（事务性安装/更新）
- ✅ 版本管理 schema 设计（新增数据库表）
- ✅ upgrade/downgrade 流程
- ✅ 权限边界（capability 白名单）
- ✅ 资源限制（CPU/内存/超时）

**本文档不覆盖**:
- ❌ Plugin UI 沙箱（前端隔离，属未来 scope）
- ❌ Plugin 市场/分发机制（ClipHub）
- ❌ 多节点部署下的 plugin 同步

### 1.3 当前架构现状

根据代码审查，当前 Plugin 系统已具备：

| 模块 | 文件 | 状态 | 备注 |
|------|------|------|------|
| Worker 管理器 | `server/src/services/plugin-worker-manager.ts` | ✅ 完整 | 已实现 `child_process.fork()` + JSON-RPC |
| 能力验证器 | `server/src/services/plugin-capability-validator.ts` | ✅ 完整 | 已有 capability 白名单机制 |
| VM 沙箱 | `server/src/services/plugin-runtime-sandbox.ts` | ✅ 完整 | 仅开发/测试模式使用 |
| Plugin schema | `packages/db/src/schema/plugins.ts` | ✅ 基础 | 核心表已存在，需扩展 |
| 数据库表 | `plugin_config`, `plugin_state`, `plugin_jobs` 等 | ✅ 基础 | 缺少版本管理表 |

**WLF-116 需要新增**:
- 🔲 `plugin_versions` 表（版本历史）
- 🔲 `plugin_config_revisions` 表（配置版本控制）
- 🔲 事务性安装流程实现
- 🔲 资源监控和限制
- 🔲 崩溃恢复策略优化

---

## 2. 进程隔离方案

### 2.1 架构决策：**生产环境强制 child_process**

当前 `plugin-worker-manager.ts` 已实现正确的进程隔离架构。WLF-116 的加固重点是**确保生产环境不使用 VM 沙箱**。

```typescript
// 当前实现（plugin-worker-manager.ts 第 620 行）
const child = fork(options.entrypointPath, [], {
  stdio: ["pipe", "pipe", "pipe", "ipc"],
  execArgv: options.execArgv ?? [],
  env: workerEnv,  // 最小化环境变量
  detached: false,
});
```

**加固决策**:

| 环境 | 运行时 | 说明 |
|------|--------|------|
| **生产环境** (`NODE_ENV=production`) | `child_process.fork()` | **强制**，禁止 VM 模式 |
| **开发环境** (`NODE_ENV=development`) | `child_process.fork()` | **默认** |
| **测试模式** (`PLUGIN_SANDBOX_MODE=vm`) | VM 沙箱 | **仅用于快速调试** |

### 2.2 安全加固：环境变量最小化

当前实现（第 612-620 行）已正确避免泄露 `process.env`。WLF-116 需要**显式文档化此安全边界**：

```typescript
const workerEnv: Record<string, string> = {
  PATH: process.env.PATH ?? "",
  NODE_PATH: process.env.NODE_PATH ?? "",
  PAPERCLIP_PLUGIN_ID: pluginId,
  NODE_ENV: process.env.NODE_ENV ?? "production",
  TZ: process.env.TZ ?? "UTC",
  // 显式禁止：DATABASE_URL, PAPERCLIP_API_KEY, 等 host secrets
};
```

**加固要求**:
1. 在 `plugin-worker-manager.ts` 头部添加安全注释，说明为何不能 spread `process.env`
2. 添加单元测试验证 `DATABASE_URL` 等敏感变量不会泄露到 worker

### 2.3 IPC 协议安全

当前使用 JSON-RPC 2.0 over stdio。WLF-116 需要添加：

1. **消息大小限制**: 防止恶意 plugin 发送超大消息导致 host OOM
2. **请求速率限制**: 防止 plugin flood 攻击

```typescript
// 新增常量
const MAX_MESSAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_REQUESTS_PER_MINUTE = 1000;

// 在 handleLine() 中添加
function handleLine(line: string): void {
  if (line.length > MAX_MESSAGE_SIZE_BYTES) {
    log.warn(`Message too large: ${line.length} bytes`);
    return;
  }
  // ... 现有逻辑
}
```

---

## 3. 失败回滚机制

### 3.1 失败场景分类

| 阶段 | 失败类型 | 当前处理 | WLF-116 加固 |
|------|---------|---------|-------------|
| 安装 | npm install 失败 | ❌ 未处理 | ✅ 清理临时目录，DB 标记 `error` |
| 启动 | worker spawn 失败 | ✅ 捕获错误 | ✅ 保留 stderr excerpt 用于调试 |
| 初始化 | initialize 超时 | ✅ kill process | ✅ DB 标记 `error`，保留包文件 |
| 运行 | 进程崩溃 | ✅ 指数退避重启 | ✅ 崩溃计数 + 自动熔断 |
| 更新 | upgrade 失败 | ❌ 未处理 | ✅ 回滚到前一版本 |
| 配置 | config 验证失败 | ❌ 未处理 | ✅ 拒绝变更，恢复旧配置 |

### 3.2 事务性安装流程（新增）

```typescript
// 伪代码：server/src/services/plugin-installer.ts
async function installPlugin(pluginId: string, packageName: string, version: string): Promise<void> {
  const tempDir = path.join(os.tmpdir(), `paperclip-plugins/${pluginId}-${Date.now()}`);
  
  try {
    // Step 1: 下载到临时目录
    await fs.mkdir(tempDir, { recursive: true });
    await exec(`npm install ${packageName}@${version}`, { cwd: tempDir });
    
    // Step 2: 验证 manifest
    const manifest = await readManifest(tempDir);
    validateManifest(manifest);
    
    // Step 3: 移动到目标目录（原子操作）
    const targetDir = path.join(PLUGIN_ROOT, "node_modules", manifest.packageName);
    await fs.rename(tempDir, targetDir);
    
    // Step 4: 数据库持久化（事务性）
    await db.transaction(async (tx) => {
      await tx.insert(plugins).values({
        pluginKey: manifest.id,
        packageName: manifest.packageName,
        version: manifest.version,
        status: "installed",
        packagePath: targetDir,
      });
      
      // Step 5: 启动 worker 并健康检查
      const handle = await workerManager.startWorker(pluginId, { ... });
      const health = await handle.call("health", {});
      
      if (!health.ok) {
        throw new Error("Health check failed");
      }
      
      // Step 6: 标记 ready
      await tx.update(plugins).set({ status: "ready" }).where(eq(plugins.pluginKey, pluginId));
    });
    
  } catch (error) {
    // 回滚：删除临时目录和目标目录
    await fs.rm(tempDir, { recursive: true, force: true });
    const targetDir = path.join(PLUGIN_ROOT, "node_modules", packageName);
    await fs.rm(targetDir, { recursive: true, force: true });
    
    // DB 标记 error
    await db.update(plugins).set({ 
      status: "error", 
      lastError: error.message 
    }).where(eq(plugins.pluginKey, pluginId));
    
    throw error;
  }
}
```

### 3.3 崩溃恢复策略（已有，需优化）

当前 `plugin-worker-manager.ts` 已实现指数退避重启（第 761-798 行）。WLF-116 需要：

1. **崩溃计数持久化**: 当前 crash count 在内存中，重启 host 后丢失 → 需要存到 DB
2. **自动熔断**: 连续崩溃 N 次后自动禁用 plugin

```typescript
// 新增数据库字段：plugins.crash_count, plugins.last_crash_at
// 在 handleProcessExit() 中持久化
await db.update(plugins).set({
  crashCount: crashCount + 1,
  lastCrashAt: new Date(),
  status: crashCount >= MAX_CONSECUTIVE_CRASHES ? "error" : "running",
}).where(eq(plugins.id, pluginId));
```

---

## 4. 版本管理

### 4.1 新增数据库表

#### 4.1.1 `plugin_versions` 表

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

**Drizzle schema** (`packages/db/src/schema/plugin_versions.ts`):

```typescript
import { pgTable, uuid, text, timestamp, jsonb, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";
import { plugins } from "./plugins";

export const pluginVersions = pgTable(
  "plugin_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pluginId: uuid("plugin_id").notNull().references(() => plugins.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    packagePath: text("package_path").notNull(),
    manifestJson: jsonb("manifest_json").notNull(),
    installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
    uninstalledAt: timestamp("uninstalled_at", { withTimezone: true }),
    uninstallReason: text("uninstall_reason"),
    isActive: boolean("is_active").notNull().default(false),
  },
  (table) => ({
    uniqueVersionIdx: uniqueIndex("plugin_versions_plugin_id_version_idx").on(table.pluginId, table.version),
    activeIdx: index("plugin_versions_active_idx").on(table.pluginId, table.isActive),
  }),
);
```

#### 4.1.2 `plugin_config_revisions` 表

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

**Drizzle schema** (`packages/db/src/schema/plugin_config_revisions.ts`):

```typescript
import { pgTable, uuid, integer, text, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { plugins } from "./plugins";
import { users } from "./users";
import { agents } from "./agents";

export const pluginConfigRevisions = pgTable(
  "plugin_config_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pluginId: uuid("plugin_id").notNull().references(() => plugins.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    configJson: jsonb("config_json").notNull(),
    changeSummary: text("change_summary"),
    changedByUserId: uuid("changed_by_user_id").references(() => users.id),
    changedByAgentId: uuid("changed_by_agent_id").references(() => agents.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueRevisionIdx: uniqueIndex("plugin_config_revisions_plugin_id_revision_idx")
      .on(table.pluginId, table.revisionNumber),
    pluginIdx: index("plugin_config_revisions_plugin_idx").on(table.pluginId, table.createdAt),
  }),
);
```

### 4.2 Upgrade 流程

```typescript
// server/src/services/plugin-upgrader.ts
async function upgradePlugin(pluginId: string, targetVersion: string): Promise<void> {
  const plugin = await db.query.plugins.findFirst({ where: eq(plugins.id, pluginId) });
  if (!plugin) throw notFound(`Plugin ${pluginId} not found`);
  
  const currentVersion = plugin.version;
  
  // Step 1: 下载新版本到临时目录
  const tempDir = await downloadVersion(plugin.packageName, targetVersion);
  
  // Step 2: 读取新版本 manifest，检查 capability 变更
  const newManifest = await readManifest(tempDir);
  const newCapabilities = new Set(newManifest.capabilities);
  const oldCapabilities = new Set(plugin.manifestJson.capabilities);
  
  // 如果有新增 capability，需要 operator 审批
  const addedCapabilities = [...newCapabilities].filter(c => !oldCapabilities.has(c));
  if (addedCapabilities.length > 0) {
    await db.update(plugins).set({ status: "upgrade_pending" }).where(eq(plugins.id, pluginId));
    throw new RequiresApprovalError(`New capabilities require approval: ${addedCapabilities.join(", ")}`);
  }
  
  // Step 3: 停止当前版本 worker
  await workerManager.stopWorker(pluginId);
  
  // Step 4: 备份当前版本到 plugin_versions 表
  await db.insert(pluginVersions).values({
    pluginId: plugin.id,
    version: currentVersion,
    packagePath: plugin.packagePath!,
    manifestJson: plugin.manifestJson,
    isActive: false,
  });
  
  // Step 5: 移动新版本到目标目录
  const targetDir = path.join(PLUGIN_ROOT, "node_modules", newManifest.packageName);
  await fs.rename(tempDir, targetDir);
  
  // Step 6: 启动新版本 worker
  const handle = await workerManager.startWorker(pluginId, { 
    entrypointPath: path.join(targetDir, "dist", "worker.js"),
    manifest: newManifest,
    config: await resolveConfig(pluginId),
  });
  
  // Step 7: 健康检查
  const health = await handle.call("health", {});
  if (!health.ok) {
    // 回滚：恢复旧版本
    await rollbackVersion(pluginId, currentVersion);
    throw new Error(`Upgrade failed: health check failed`);
  }
  
  // Step 8: 更新数据库
  await db.transaction(async (tx) => {
    await tx.update(plugins).set({
      version: targetVersion,
      manifestJson: newManifest,
      packagePath: targetDir,
      status: "ready",
    }).where(eq(plugins.id, pluginId));
    
    await tx.update(pluginVersions).set({ isActive: true })
      .where(and(
        eq(pluginVersions.pluginId, pluginId),
        eq(pluginVersions.version, targetVersion),
      ));
  });
  
  // Step 9: 清理旧版本（保留最近 N 个）
  await cleanupOldVersions(pluginId, KEEP_LAST_N_VERSIONS);
}
```

### 4.3 Downgrade 流程

```typescript
async function downgradePlugin(pluginId: string, targetVersion: string): Promise<void> {
  // Step 1: 从 plugin_versions 表查找目标版本
  const versionRecord = await db.query.pluginVersions.findFirst({
    where: and(
      eq(pluginVersions.pluginId, pluginId),
      eq(pluginVersions.version, targetVersion),
    ),
  });
  
  if (!versionRecord) {
    throw notFound(`Version ${targetVersion} not found for plugin ${pluginId}`);
  }
  
  // Step 2: 停止当前版本 worker
  await workerManager.stopWorker(pluginId);
  
  // Step 3: 恢复目标版本的 package_path
  const targetDir = versionRecord.packagePath;
  
  // Step 4: 启动目标版本 worker
  const handle = await workerManager.startWorker(pluginId, {
    entrypointPath: path.join(targetDir, "dist", "worker.js"),
    manifest: versionRecord.manifestJson,
    config: await resolveConfig(pluginId),
  });
  
  // Step 5: 健康检查
  const health = await handle.call("health", {});
  if (!health.ok) {
    throw new Error(`Downgrade failed: health check failed`);
  }
  
  // Step 6: 更新数据库
  await db.transaction(async (tx) => {
    await tx.update(plugins).set({
      version: targetVersion,
      manifestJson: versionRecord.manifestJson,
      packagePath: targetDir,
      status: "ready",
    }).where(eq(plugins.id, pluginId));
    
    await tx.update(pluginVersions).set({ isActive: true })
      .where(eq(pluginVersions.id, versionRecord.id));
  });
}
```

### 4.4 配置版本控制

每次配置变更时，自动创建 revision：

```typescript
// server/src/routes/plugins.ts
async function updatePluginConfig(pluginId: string, newConfig: Record<string, unknown>, userId?: string) {
  const plugin = await db.query.plugins.findFirst({ where: eq(plugins.id, pluginId) });
  if (!plugin) throw notFound();
  
  // Step 1: 获取当前 revision number
  const lastRevision = await db.query.pluginConfigRevisions.findFirst({
    where: eq(pluginConfigRevisions.pluginId, pluginId),
    orderBy: (t, { desc }) => [desc(t.revisionNumber)],
  });
  const nextRevisionNumber = (lastRevision?.revisionNumber ?? 0) + 1;
  
  // Step 2: 保存新 revision
  await db.insert(pluginConfigRevisions).values({
    pluginId,
    revisionNumber: nextRevisionNumber,
    configJson: newConfig,
    changedByUserId: userId,
    changeSummary: `Config updated via API`,
  });
  
  // Step 3: 更新 plugin_config 表
  await db.update(pluginConfig).set({
    configJson: newConfig,
    updatedAt: new Date(),
  }).where(eq(pluginConfig.pluginId, pluginId));
  
  // Step 4: 通知 worker 配置已变更
  const handle = workerManager.getWorker(pluginId);
  if (handle) {
    await handle.call("configChanged", { config: newConfig });
  }
}
```

---

## 5. 资源限制

### 5.1 内存限制

当前 `plugin-worker-manager.ts` 通过 `NODE_OPTIONS` 传递内存限制（第 612-620 行）。WLF-116 需要**添加监控和自动重启**：

```typescript
// 新增：内存监控
const MAX_MEMORY_BYTES = 512 * 1024 * 1024; // 512MB

setInterval(() => {
  if (!childProcess.pid) return;
  
  try {
    const usage = process.memoryUsage();
    if (usage.rss > MAX_MEMORY_BYTES) {
      log.warn(`Worker memory exceeded: ${usage.rss} bytes, restarting...`);
      restartWorker();
    }
  } catch (err) {
    log.error({ err }, "Failed to check worker memory");
  }
}, 30000);
```

### 5.2 CPU 限制

Linux 环境使用 `cgroups`，macOS/Windows 降级为进程优先级：

```typescript
// server/src/services/plugin-resource-limiter.ts
import { exec } from "node:child_process";
import { promisify } from "node:util";
const execAsync = promisify(exec);

export async function applyCpuLimit(pid: number, cpuPercent: number): Promise<void> {
  if (process.platform === "linux") {
    // Linux: use cgroups
    await execAsync(`cgset -r cpu.cpu_quota=${cpuPercent * 1000} /paperclip-plugins/${pid}`);
  } else {
    // macOS/Windows: nice/renice (best effort)
    await execAsync(`renice 10 -p ${pid}`);
  }
}
```

### 5.3 超时限制

当前已有 RPC 超时机制（第 58-61 行）。WLF-116 需要**文档化所有超时配置**：

| 操作 | 超时 | 配置项 |
|------|------|--------|
| initialize | 15s | `PLUGIN_INITIALIZE_TIMEOUT_MS` |
| 普通 RPC | 30s | `PLUGIN_RPC_TIMEOUT_MS` |
| job 执行 | 5min | `PLUGIN_JOB_TIMEOUT_MS` |
| webhook 处理 | 10s | `PLUGIN_WEBHOOK_TIMEOUT_MS` |
| shutdown | 10s | `PLUGIN_SHUTDOWN_DRAIN_MS` |

### 5.4 文件系统访问控制

当前 `plugin-runtime-sandbox.ts` 已有路径检查（第 98-104 行）。WLF-116 需要**将此逻辑应用到 child_process 模式**：

```typescript
// server/src/services/plugin-filesystem-sandbox.ts
import { realpathSync } from "node:fs";
import path from "node:path";

export class PluginFileSystemSandbox {
  private readonly pluginRoot: string;
  private readonly allowedPaths: Set<string>;
  
  constructor(pluginRoot: string, extraPaths: string[] = []) {
    this.pluginRoot = realpathSync(pluginRoot);
    this.allowedPaths = new Set([this.pluginRoot, ...extraPaths]);
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

## 6. 权限边界

### 6.1 当前 Capability 系统

`plugin-capability-validator.ts` 已有完整的 capability 白名单机制（第 44-90 行）。WLF-116 需要：

1. **新增 capability**: `plugin.fs.access`（文件系统访问）
2. **新增 capability**: `plugin.resource.cpu`（CPU 资源使用）

### 6.2 禁止的 Capabilities

以下 capabilities **永远不**对 plugin 开放：

```typescript
// 在 plugin-capability-validator.ts 中显式定义
const FORBIDDEN_CAPABILITIES: PluginCapability[] = [
  "approval.decide",
  "budget.override",
  "auth.bypass",
  "issue.checkout.override",
  "db.direct",
  "agent.create",
  "company.delete",
];
```

### 6.3 Capability Enforcement

当前已有 `assertOperation()` 方法。WLF-116 需要**在 bridge 层添加日志**：

```typescript
// server/src/services/plugin-bridge.ts
async function handleWorkerRequest(request: JsonRpcRequest) {
  const method = request.method as WorkerToHostMethodName;
  
  try {
    validator.assertOperation(manifest, method);
    const result = await handlers[method](request.params);
    return { ok: true, result };
  } catch (err) {
    if (err instanceof CapabilityDeniedError) {
      log.warn({ pluginId: manifest.id, method }, "Capability denied");
      activityLog.log({
        action: "plugin.capability_denied",
        entityType: "plugin",
        entityId: manifest.id,
        details: { method, error: err.message },
      });
    }
    throw err;
  }
}
```

---

## 7. 接口定义

### 7.1 新增 Service 接口

#### 7.1.1 `PluginInstaller`

```typescript
// server/src/services/plugin-installer.ts
export interface PluginInstaller {
  install(packageName: string, version?: string): Promise<PluginRecord>;
  uninstall(pluginId: string): Promise<void>;
  rollbackInstall(pluginId: string): Promise<void>;
}
```

#### 7.1.2 `PluginUpgrader`

```typescript
// server/src/services/plugin-upgrader.ts
export interface PluginUpgrader {
  upgrade(pluginId: string, targetVersion: string): Promise<void>;
  downgrade(pluginId: string, targetVersion: string): Promise<void>;
  approveUpgrade(pluginId: string): Promise<void>;
}
```

#### 7.1.3 `PluginVersionManager`

```typescript
// server/src/services/plugin-version-manager.ts
export interface PluginVersionManager {
  getVersions(pluginId: string): Promise<PluginVersionRecord[]>;
  getActiveVersion(pluginId: string): Promise<PluginVersionRecord>;
  cleanupOldVersions(pluginId: string, keepLastN: number): Promise<void>;
}
```

#### 7.1.4 `PluginConfigHistory`

```typescript
// server/src/services/plugin-config-history.ts
export interface PluginConfigHistory {
  getRevisions(pluginId: string, limit?: number): Promise<PluginConfigRevisionRecord[]>;
  getRevision(pluginId: string, revisionNumber: number): Promise<PluginConfigRevisionRecord>;
  rollbackToRevision(pluginId: string, revisionNumber: number): Promise<void>;
}
```

---

## 8. 实现顺序建议

### 8.1 依赖关系图

```
Phase 1: 数据库迁移（1-2 天）
├── 创建 plugin_versions 表
├── 创建 plugin_config_revisions 表
└── 添加 plugins.crash_count, plugins.last_crash_at 字段

Phase 2: 版本管理（2-3 天）
├── 实现 PluginVersionManager
├── 实现 PluginUpgrader
└── 实现 PluginConfigHistory

Phase 3: 失败回滚（2-3 天）
├── 实现 PluginInstaller
├── 事务性安装流程
└── 崩溃计数持久化

Phase 4: 资源限制（2-3 天）
├── 内存监控和限制
├── CPU 限制（Linux cgroups）
├── 超时控制配置化
└── 文件系统访问控制

Phase 5: 集成测试（2-3 天）
├── upgrade/downgrade 测试
├── 回滚测试
├── 资源限制测试
└── 崩溃恢复测试
```

### 8.2 可并行任务

| 任务组 | 可并行 | 依赖 |
|--------|--------|------|
| Phase 1 全部 | ✅ | 无 |
| `plugin_versions` 实现 | ✅ | 需表创建完成 |
| `plugin_config_revisions` 实现 | ✅ | 需表创建完成 |
| upgrade 流程 | ❌ | 需 `plugin_versions` |
| downgrade 流程 | ❌ | 需 `plugin_versions` |
| 内存限制 | ✅ | 无 |
| CPU 限制 | ✅ | 无 |
| 事务性安装 | ❌ | 需 Phase 2 完成 |

### 8.3 建议实施顺序

1. **Day 1-2**: Phase 1（数据库迁移）
2. **Day 3-5**: Phase 2（版本管理核心）
3. **Day 6-8**: Phase 3（失败回滚）
4. **Day 9-11**: Phase 4（资源限制）
5. **Day 12-14**: Phase 5（集成测试 + 文档）

---

## 9. 风险评估

### 9.1 技术风险

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| child_process 内存泄漏 | 中 | 高 | 定期重启 worker，监控 RSS |
| JSON-RPC 序列化性能瓶颈 | 低 | 中 | 使用 Transferable，共享内存 |
| cgroups 兼容性（macOS/Windows） | 高 | 中 | 降级策略，仅 Linux 启用 CPU 限制 |
| 回滚失败导致数据不一致 | 中 | 高 | 事务性操作，审计日志 |
| plugin_versions 表数据膨胀 | 低 | 低 | 定期清理旧版本（保留最近 5 个） |

### 9.2 备选方案

**方案 A（推荐）**：当前 child_process + JSON-RPC
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

## 10. 与现有系统兼容性

### 10.1 向后兼容

- ✅ 现有 plugin API 保持不变
- ✅ 现有 `plugins` 表结构不变（新增表，不修改）
- ✅ 现有 plugin worker 协议兼容

### 10.2 迁移路径

1. **阶段 1**：新安装使用新架构（默认 child_process）
2. **阶段 2**：现有 plugin 重启时迁移到新 worker 管理器
3. **阶段 3**：弃用 VM 沙箱生产模式（保留开发模式）

---

## 11. 验收标准

本文档完成的标准：

- [x] 软件工程师可基于文档开始实现
- [x] 方案与现有 plugin 系统兼容
- [x] 风险评估和备选方案说明
- [ ] 架构评审通过
- [ ] 实现任务分解到 Paperclip issues

---

## 附录 A：数据库迁移 SQL

```sql
-- Migration: plugin_versions_table
CREATE TABLE IF NOT EXISTS plugin_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id uuid NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  version text NOT NULL,
  package_path text NOT NULL,
  manifest_json jsonb NOT NULL,
  installed_at timestamptz NOT NULL DEFAULT now(),
  uninstalled_at timestamptz,
  uninstall_reason text,
  is_active boolean NOT NULL DEFAULT false,
  
  CONSTRAINT plugin_versions_unique_version UNIQUE (plugin_id, version)
);

CREATE INDEX idx_plugin_versions_active ON plugin_versions (plugin_id, is_active);

-- Migration: plugin_config_revisions_table
CREATE TABLE IF NOT EXISTS plugin_config_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id uuid NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  revision_number integer NOT NULL,
  config_json jsonb NOT NULL,
  change_summary text,
  changed_by_user_id uuid REFERENCES users(id),
  changed_by_agent_id uuid REFERENCES agents(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT plugin_config_revisions_unique_revision UNIQUE (plugin_id, revision_number)
);

CREATE INDEX idx_plugin_config_revisions_plugin ON plugin_config_revisions (plugin_id, created_at DESC);

-- Migration: plugins_crash_tracking
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS crash_count integer NOT NULL DEFAULT 0;
ALTER TABLE plugins ADD COLUMN IF NOT EXISTS last_crash_at timestamptz;
```

## 附录 B：术语表

| 术语 | 定义 |
|------|------|
| Host | Paperclip 主进程 |
| Worker | Plugin 工作进程 |
| Plugin Key | Plugin 唯一标识（manifest.id） |
| Capability | Plugin 权限声明 |
| JSON-RPC | 进程间通信协议 |
| child_process | Node.js 子进程模块 |

## 附录 C：参考文档

- [PLUGIN_SPEC.md](../plugins/PLUGIN_SPEC.md) - Plugin 系统完整规范
- [PLUGIN_SPEC.md §12](../plugins/PLUGIN_SPEC.md#12-runtime-model) - 运行时模型
- [PLUGIN_SPEC.md §15](../plugins/PLUGIN_SPEC.md#15-capability-system) - Capability 系统
- [plugin-sandbox.md](./plugin-sandbox.md) - 早期沙箱设计草案

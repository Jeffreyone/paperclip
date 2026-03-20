# Plugin API 参考文档

本文档面向已完成插件入门的开发者，提供完整的 Host Services API 说明。涵盖事件总线、配置读写、状态存储、HTTP 请求、密钥、Activity 日志等核心接口。

主题索引：

1. [Host Services 概述](#host-services-概述)
2. [Event Bridge（事件总线）](#event-bridge事件总线)
3. [Plugin Config（插件配置读写）](#plugin-config插件配置读写)
4. [Plugin State（键值状态存储）](#plugin-state键值状态存储)
5. [Plugin Entities（结构化实体）](#plugin-entities结构化实体)
6. [HTTP 请求（带 SSRF 防护）](#http-请求带-ssrf-防护)
7. [Secrets（密钥解析）](#secrets密钥解析)
8. [Activity 日志](#activity-日志)
9. [Logger（结构化日志）](#logger结构化日志)
10. [Metrics（指标写入）](#metrics指标写入)
11. [Domains API（公司、项目、Issue、Agent、Goal）](#domains-api公司项目issueagentgoal)
12. [UI Bridge Hooks](#ui-bridge-hooks)
13. [Agent Sessions（双向对话）](#agent-sessions双向对话)
14. [Agent Tools（注册 Agent 可用工具）](#agent-tools注册-agent-可用工具)
15. [Streams（实时推送）](#streams实时推送)
16. [常见错误与调试](#常见错误与调试)

---

## Host Services 概述

Worker 中通过 `ctx` 对象访问所有宿主服务。`ctx` 在 `setup(ctx)` 调用时传入。

```ts
import { definePlugin } from "@paperclipai/plugin-sdk";

const plugin = definePlugin({
  async setup(ctx) {
    // ctx.config      — 读取插件配置
    // ctx.events      — 订阅/发送事件
    // ctx.state       — 键值状态存储
    // ctx.entities    — 结构化实体
    // ctx.http        — HTTP 请求
    // ctx.secrets     — 密钥解析
    // ctx.activity    — Activity 日志
    // ctx.logger      — 结构化日志
    // ctx.metrics     — 指标写入
    // ctx.projects    — 项目和 workspace
    // ctx.companies   — 公司
    // ctx.issues      — Issue
    // ctx.agents      — Agent
    // ctx.goals       — Goal
    // ctx.data        — 注册 UI 数据端点
    // ctx.actions     — 注册 UI action
    // ctx.streams     — 实时推送
    // ctx.tools       — 注册 Agent tools
    // ctx.jobs        — 注册定时任务
    // ctx.manifest    — 当前 manifest 只读访问
  },
});
```

所有 Host Services 均通过 **Capability 门控**。如果 manifest 中未声明所需 capability，调用会抛出 `CapabilityDeniedError`。

---

## Event Bridge（事件总线）

### 订阅 Core Domain Events

```ts
// 接收所有 issue.created 事件
ctx.events.on("issue.created", async (event) => {
  ctx.logger.info("Issue created", {
    id: event.entityId,
    companyId: event.companyId,
    payload: event.payload,
  });
});

// 带过滤器：只接收特定 project 的 issue.created
ctx.events.on("issue.created", { projectId: "proj-abc123" }, async (event) => {
  // 只处理 proj-abc123 下的 issue
});
```

**过滤器字段**（可选，传第二个参数）：

| 字段 | 说明 |
|------|------|
| `projectId` | 仅接收特定项目的事件 |
| `companyId` | 仅接收特定公司的事件 |
| `agentId` | 仅接收特定 Agent 的事件 |

### 发送 Plugin-to-Plugin 事件

```ts
// 在某事件 handler 中，向其他插件发送通知
ctx.events.on("issue.updated", async (event) => {
  // 将事件名 "sync-done" 发送给所有订阅者
  // 实际 event type = "plugin.myscope.sync.push-detected"
  await ctx.events.emit("sync-push-detected", event.companyId, {
    issueId: event.entityId,
    projectId: event.payload?.projectId,
  });
});
```

> **规则**：不要在 `emit()` 的事件名中包含 `plugin.` 前缀，宿主会自动添加。

### 支持的 Core Event Types

| Event | 说明 |
|-------|------|
| `company.created` / `company.updated` | 公司变更 |
| `project.created` / `project.updated` | 项目变更 |
| `project.workspace_created` / `workspace_updated` / `workspace_deleted` | Workspace 变更 |
| `issue.created` / `issue.updated` / `issue.comment.created` | Issue 及评论 |
| `agent.created` / `agent.updated` / `agent.status_changed` | Agent 状态 |
| `agent.run.started` / `agent.run.finished` / `agent.run.failed` / `agent.run.cancelled` | Run 生命周期 |
| `goal.created` / `goal.updated` | Goal 变更 |
| `approval.created` / `approval.decided` | 审批流程 |
| `cost_event.created` | 成本事件 |
| `activity.logged` | Activity 记录 |

---

## Plugin Config（插件配置读写）

### 读取当前配置

```ts
async setup(ctx) {
  const config = await ctx.config.get();
  ctx.logger.info("Plugin config", config);

  // config 类型为 Record<string, unknown>
  const interval = (config.syncInterval as number) ?? 300;
}
```

`ctx.config.get()` 返回插件的当前配置对象（operator 在设置页面保存的值）。初始化时由宿主传入，也可以在 `onConfigChanged` 中重新获取。

---

## Plugin State（键值状态存储）

Plugin State 是插件的私有持久化键值存储，按 scope（作用域）分区。

### 5 部分复合键

| 组件 | 说明 |
|------|------|
| `scopeKind` | 作用域类型：`instance`、`company`、`project`、`project_workspace`、`agent`、`issue`、`goal`、`run` |
| `scopeId` | 对应实体的 UUID（`instance` 时为 null） |
| `namespace` | 命名空间，避免同一 scope 内 key 冲突 |
| `stateKey` | 具体的键名 |
| 值 | 任意 JSON 可序列化数据 |

### 基本操作

```ts
// 写入
await ctx.state.set(
  { scopeKind: "instance", stateKey: "last-sync" },
  new Date().toISOString()
);

// 带 scopeId 和 namespace
await ctx.state.set(
  { scopeKind: "company", scopeId: companyId, namespace: "linear", stateKey: "team-id" },
  "TEAM-123"
);

// 读取
const lastSync = await ctx.state.get({
  scopeKind: "instance",
  stateKey: "last-sync",
});

// 删除
await ctx.state.delete({
  scopeKind: "company",
  scopeId: companyId,
  namespace: "linear",
  stateKey: "team-id",
});
```

### 实用示例：Issue 同步状态

```ts
// 订阅 issue.created 事件，记录 Linear 外部 ID
ctx.events.on("issue.created", async (event) => {
  const externalId = await syncToExternalService(event.payload);
  await ctx.state.set(
    {
      scopeKind: "issue",
      scopeId: event.entityId,
      namespace: "sync",
      stateKey: "external-id",
    },
    externalId
  );
});

// 在 issue.updated 事件中查询外部 ID
ctx.events.on("issue.updated", async (event) => {
  const externalId = await ctx.state.get({
    scopeKind: "issue",
    scopeId: event.entityId,
    namespace: "sync",
    stateKey: "external-id",
  });
  if (externalId) {
    await pushUpdateToExternalService(externalId, event.payload);
  }
});
```

---

## Plugin Entities（结构化实体）

对于比简单键值更结构化的数据（如外部系统映射），使用 Entities 接口：

```ts
// 写入实体
await ctx.entities.upsert({
  entityType: "linear-issue",
  scopeKind: "issue",
  scopeId: issueId,
  externalId: "LINEAR-456",
  title: "Fix login bug",
  status: "in_progress",
  data: {
    assignee: "alice@example.com",
    labels: ["bug", "p1"],
  },
});

// 查询实体
const entities = await ctx.entities.list({
  entityType: "linear-issue",
  scopeKind: "company",
  externalId: "LINEAR-456",
  limit: 10,
});

// 结果
for (const entity of entities) {
  ctx.logger.info("Found entity", {
    id: entity.id,
    title: entity.title,
    status: entity.status,
    externalId: entity.externalId,
  });
}
```

---

## HTTP 请求（带 SSRF 防护）

`ctx.http.fetch` 是插件对外发起 HTTP 请求的唯一通道。宿主实现了完整的 SSRF（服务器端请求伪造）防护：

- **协议白名单**：仅允许 `http:` 和 `https:`
- **私有 IP 阻断**：拒绝解析到内网地址（RFC 1918、loopback、link-local 等）
- **DNS 重绑定防护**：解析一次 IP 并固定，后续请求不再重新解析
- **请求超时**：默认 30 秒超时

```ts
const response = await ctx.http.fetch({
  url: "https://api.example.com/v1/issues",
  init: {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ title: "New issue", body: "Description" }),
  },
});

ctx.logger.info("API response", {
  status: response.status,
  body: response.body.slice(0, 200),  // 日志中截断敏感数据
});
```

**响应对象**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | `number` | HTTP 状态码 |
| `statusText` | `string` | 状态文本 |
| `headers` | `Record<string, string>` | 响应头 |
| `body` | `string` | 响应体（最大 200MB） |

---

## Secrets（密钥解析）

插件不能直接存储密钥明文。使用 `secrets.resolve` 从 Paperclip 密钥管理系统解析：

```ts
const secrets = await ctx.secrets.resolve({
  keys: ["my-plugin.api-key", "my-plugin.webhook-secret"],
});

const apiKey = secrets["my-plugin.api-key"] as string;
const webhookSecret = secrets["my-plugin.webhook-secret"] as string;
```

> **安全规则**：密钥值永远不会写入日志、活动日志或 webhook 投递记录。

---

## Activity 日志

插件的写操作应该记录到 Paperclip 的 Activity 日志，以便operator 追踪：

```ts
await ctx.activity.log({
  companyId,
  message: "Synced 15 issues from Linear",
  entityType: "project",
  entityId: projectId,
  metadata: {
    syncedCount: 15,
    linearTeamId: "TEAM-123",
  },
});
```

---

## Logger（结构化日志）

```ts
ctx.logger.info("Sync completed", {
  duration: 1234,
  syncedCount: 42,
  failedCount: 1,
});

ctx.logger.warn("Rate limit approaching", { remaining: 5 });

ctx.logger.error("Sync failed", { error: err instanceof Error ? err.message : String(err) });

ctx.logger.debug("Processing item", { itemId: "item-1" });
```

日志通过宿主持久化，可在插件设置页面查看。

---

## Metrics（指标写入）

```ts
await ctx.metrics.write({
  name: "sync.issues.count",
  value: 42,
  tags: { team: "TEAM-123", status: "success" },
});
```

指标以 `"metric"` 日志级别写入 `plugin_logs` 表，可在插件设置页面查询。

---

## Domains API（公司、项目、Issue、Agent、Goal）

每个 Domain API 均需要对应的 read capability。

### Companies

```ts
// 列出所有公司
const companies = await ctx.companies.list();

// 获取特定公司
const company = await ctx.companies.get({ companyId });
```

### Projects

```ts
// 列出项目
const projects = await ctx.projects.list({
  companyId,
  limit: 20,
});

// 获取项目
const project = await ctx.projects.get({ companyId, projectId });

// 列出项目的 Workspaces
const workspaces = await ctx.projects.listWorkspaces({ companyId, projectId });

// 获取 Issue 对应的 Workspace
const ws = await ctx.projects.getWorkspaceForIssue({ companyId, issueId });
```

### Issues

```ts
// 列出 Issues
const issues = await ctx.issues.list({
  companyId,
  status: "todo",
  limit: 50,
});

// 获取 Issue
const issue = await ctx.issues.get({ companyId, issueId });

// 创建 Issue
const newIssue = await ctx.issues.create({
  companyId,
  title: "New issue from plugin",
  description: "...",
  status: "todo",
  priority: "high",
  projectId,
});

// 更新 Issue
await ctx.issues.update({
  companyId,
  issueId,
  patch: { status: "done" },
});

// 评论
const comments = await ctx.issues.listComments({ companyId, issueId });
await ctx.issues.createComment({ companyId, issueId, body: "Comment from plugin" });
```

### Agents

```ts
// 列出 Agents
const agents = await ctx.agents.list({ companyId, status: "active" });

// 获取 Agent
const agent = await ctx.agents.get({ companyId, agentId });

// 暂停/恢复 Agent
await ctx.agents.pause({ companyId, agentId });
await ctx.agents.resume({ companyId, agentId });

// 触发一次 Agent 运行
const { runId } = await ctx.agents.invoke({
  companyId,
  agentId,
  reason: "Triggered by plugin",
  prompt: "Analyze the latest sync report",
});
```

### Goals

```ts
// 列出 Goals
const goals = await ctx.goals.list({ companyId, level: "quarterly", status: "active" });

// 创建 Goal
const goal = await ctx.goals.create({
  companyId,
  title: "Q1 OKRs",
  level: "quarterly",
  status: "active",
});

// 更新 Goal
await ctx.goals.update({
  companyId,
  goalId,
  patch: { title: "Updated OKRs" },
});
```

---

## UI Bridge Hooks

UI 组件与 Worker 之间通过 Bridge 通信，不需要直接导入 SDK。

### `usePluginData(key, params?)`

```tsx
import { usePluginData } from "@paperclipai/plugin-sdk/ui";

const { data, loading, error, refresh } = usePluginData("sync-health", {
  companyId: context.companyId,
});

// data 的类型由 worker 端注册时的泛型参数决定
```

### `usePluginAction(key)`

```tsx
import { usePluginAction, type PluginBridgeError } from "@paperclipai/plugin-sdk/ui";

const resync = usePluginAction("resync");

async function handleClick() {
  try {
    await resync({ companyId: context.companyId });
  } catch (err) {
    const error = err as PluginBridgeError;
    alert(`Sync failed: ${error.message} (${error.code})`);
  }
}
```

### `usePluginStream(channel, options?)`

订阅 Worker 推送的 SSE 事件流：

```tsx
const { events, connected, error, close } = usePluginStream("chat", {
  companyId: context.companyId ?? undefined,
});

// events 是按时间顺序排列的推送事件数组
```

### `useHostContext()`

```tsx
import { useHostContext } from "@paperclipai/plugin-sdk/ui";

const { companyId, entityId, entityType } = useHostContext();
```

---

## Agent Sessions（双向对话）

插件可以与 Agent 建立多轮对话会话，支持流式输出：

```ts
// 创建会话
const session = await ctx.agents.sessions.create(agentId, companyId);

// 发送消息并接收流式响应
await ctx.agents.sessions.sendMessage(session.sessionId, companyId, {
  prompt: "Summarize the current project status",
  onEvent: (event) => {
    if (event.eventType === "chunk") {
      process.stdout.write(event.message ?? "");
    }
    if (event.eventType === "done") {
      ctx.logger.info("Agent response complete");
    }
    if (event.eventType === "error") {
      ctx.logger.error("Agent error", { message: event.message });
    }
  },
});

// 列出活跃会话
const sessions = await ctx.agents.sessions.list(agentId, companyId);

// 关闭会话
await ctx.agents.sessions.close(session.sessionId, companyId);
```

> **Capability 要求**：`agent.sessions.create`、`agent.sessions.list`、`agent.sessions.send`、`agent.sessions.close`。

---

## Agent Tools（注册 Agent 可用工具）

插件可以向 Agent 贡献工具，Agent 在运行时可以选择使用：

```ts
ctx.tools.register("search-issues", {
  displayName: "Search Issues",
  description: "Search for issues in the external system by keyword",
  parametersSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search keyword" },
      limit: { type: "number", default: 10 },
    },
    required: ["query"],
  },
}, async (params, runCtx) => {
  // params = { query: "...", limit: 10 }
  // runCtx = { runId, agentId, companyId, projectId }
  const results = await searchExternalIssues(params.query, params.limit);
  return {
    content: JSON.stringify(results),
    data: results,
  };
});
```

工具名称在运行时自动加上插件命名空间前缀（`myscope.hello-world:search-issues`），避免与核心工具或其他插件工具冲突。

> **Capability 要求**：`agent.tools.register`。

---

## Streams（实时推送）

Worker 可以向 UI 推送实时事件（不依赖 polling）：

```ts
// 在 action handler 中打开流
ctx.streams.open("sync-progress", companyId);

for (let i = 0; i < 100; i++) {
  await doWork(i);
  ctx.streams.emit("sync-progress", { progress: i, total: 100 });
}

ctx.streams.close("sync-progress");
```

UI 端通过 `usePluginStream("sync-progress", ...)` 订阅这些事件。

---

## 常见错误与调试

### Capability 被拒绝

```
CapabilityDeniedError: missing capability "http.outbound"
```

**解决方法**：在 manifest 的 `capabilities` 数组中添加缺失的 capability。

### HTTP 请求失败（SSRF 防护）

```
Error: All resolved IPs for localhost are in private/reserved ranges
```

**原因**：尝试访问内网地址。`ctx.http.fetch` 强制阻止私有 IP 访问。如果确实需要访问内网服务（如开发环境），请确认目标地址是可公开访问的 URL。

### State 操作报错

```
Error: Plugin not found
```

**原因**：`ctx.state.set()` 在 worker 未正确注册到宿主时调用。这通常发生在 `setup()` 之外的上下文中。

### Agent Sessions 超时

会话事件订阅有 30 分钟超时。如果会话需要更长时间，请将处理拆分为多个消息。

### Event 订阅未生效

- 确认 `events.subscribe` capability 声明
- 确认 event type 完全匹配（大小写敏感）
- 确认 `ctx.events.on()` 在 `setup()` 中调用，不是在其他 hook 中

### Webhook 未到达

1. 确认 webhook 在 manifest 中声明：`webhooks: [{ endpointKey: "push", ... }]`
2. 确认 `webhooks.receive` capability 存在
3. 确认 `onWebhook(input)` 方法已实现
4. 确认 endpointKey 匹配：请求的 URL 是 `POST /api/plugins/:pluginId/webhooks/push`，handler 中检查 `input.endpointKey === "push"`

### 数据不刷新

`usePluginData` 默认只在 `params` 变化时重新获取。如果需要在外部触发刷新，调用 `refresh()` 函数。Worker 端无需额外处理。

---

## 相关文档

- [DEVELOPING.md](./DEVELOPING.md) — Slot 定义、Lifecycle hooks、Config schema
- [PLUGIN_AUTHORING_GUIDE.md](./PLUGIN_AUTHORING_GUIDE.md) — 当前已实现的 alpha surface
- [PLUGIN_SPEC.md](./PLUGIN_SPEC.md) — 完整架构规范（包含未来路线）

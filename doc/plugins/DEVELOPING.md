# Plugin 开发者文档：入门指南

本文档面向想要为 Paperclip 开发插件的第三方作者。涵盖 slot 定义、lifecycle hooks、配置 schema，以及一个可直接运行的 Hello World 示例。完整 API 参考见 [API.md](./API.md)。

> **阅读顺序建议**：先通读本文档了解整体概念，再查阅 [API.md](./API.md) 深入特定主题。[PLUGIN_SPEC.md](./PLUGIN_SPEC.md) 是完整规范，面向未来的高级功能。PLUGIN_AUTHORING_GUIDE.md 仅覆盖当前已实现的部分。

---

## 目录

1. [核心概念](#核心概念)
2. [项目脚手架](#项目脚手架)
3. [Slot 定义（13 种 UI 挂载点）](#slot-定义13-种-ui-挂载点)
4. [Lifecycle Hooks（7 个阶段）](#lifecycle-hooks-7-个阶段)
5. [配置 Schema](#配置-schema)
6. [Hello World 示例](#hello-world-示例)
7. [Troubleshooting](#troubleshooting)

---

## 核心概念

| 概念 | 说明 |
|------|------|
| **插件包** | 一个 npm 包，包含 manifest、worker 入口和可选的 UI bundle |
| **Plugin Worker** | 独立 Node.js 进程，通过 JSON-RPC 与宿主通信 |
| **Plugin UI** | React 组件，打包进 `dist/ui/`，挂载到宿主 UI slot |
| **Capability** | 静态声明的权限集合，宿主在运行时强制执行 |
| **Slot** | 宿主 UI 中的挂载点，插件声明并填充 |
| **Bridge** | UI 组件与 worker 之间通信的桥梁，通过 `usePluginData`、`usePluginAction` 等钩子使用 |

### 信任模型（当前 alpha）

- Plugin Worker 和 Plugin UI 均视为**可信代码**
- Plugin UI 以 same-origin JavaScript 运行在 Paperclip 主应用内部
- Worker 端宿主 API 通过 capability 门控
- Plugin UI 的 capability 门控尚未实现（请勿依赖）

---

## 项目脚手架

### 快速创建

```bash
# 构建 scaffold 工具（首次需要）
pnpm --filter @paperclipai/create-paperclip-plugin build

# 在 monorepo 内创建插件
node packages/plugins/create-paperclip-plugin/dist/index.js @myscope/my-plugin \
  --output ./packages/plugins/examples

# 在 monorepo 外创建插件
node /path/to/create-paperclip-plugin/dist/index.js @myscope/my-plugin \
  --output /path/to/plugin-repos \
  --sdk-path /path/to/paperclip/packages/plugins/sdk
```

scaffold 生成以下文件：

```
src/
  manifest.ts      ← 插件清单（plugin ID、capabilities、slots）
  worker.ts        ← Worker 入口（lifecycle hooks、event handlers）
  ui/index.tsx     ← UI 组件（React 组件，导出 slot 组件）
tests/
  plugin.spec.ts   ← 测试文件
esbuild.config.mjs
rollup.config.mjs
```

### 本地开发工作流

```bash
# 在插件目录内
pnpm install
pnpm typecheck
pnpm test
pnpm build

# 安装到本地 Paperclip
curl -X POST http://127.0.0.1:3100/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"packageName": "/absolute/path/to/your-plugin", "isLocalPath": true}'

# 本地路径安装后，server 会自动监听文件变更并重启 worker
```

---

## Slot 定义（13 种 UI 挂载点）

Slot 声明了插件的 UI 组件挂载在宿主界面的哪个位置。每个 slot 需要在 manifest 中声明，并在 UI bundle 中导出对应名称的 React 组件。

### 全局 Slot（无需实体上下文）

| Slot 类型 | 说明 | Capability 要求 | 典型场景 |
|-----------|------|----------------|---------|
| `page` | 全页路由 | `ui.page.register` | 独立页面，如数据看板 |
| `settingsPage` | 自定义设置页 | `instance.settings.register` | 自定义配置 UI、OAuth 流程 |
| `sidebar` | 侧边栏导航项 | `ui.sidebar.register` | 轻量级导航链接 |
| `sidebarPanel` | 侧边栏内嵌面板 | `ui.sidebar.register` | 状态卡片、快速操作 |
| `dashboardWidget` | 仪表板 Widget | `ui.dashboardWidget.register` | KPI 卡片、状态指示器 |
| `globalToolbarButton` | 全局工具栏按钮 | `ui.action.register` | 顶栏操作按钮 |

### 实体上下文 Slot（需要关联实体）

| Slot 类型 | 说明 | Capability 要求 | 可用 entityTypes |
|-----------|------|----------------|----------------|
| `detailTab` | 实体详情页 Tab | `ui.detailTab.register` | `project`, `issue`, `agent`, `goal`, `run` |
| `taskDetailView` | 任务详情内嵌视图 | `ui.detailTab.register` | `issue` |
| `toolbarButton` | 实体工具栏按钮 | `ui.action.register` | 由宿主决定 |
| `projectSidebarItem` | 项目侧边栏项 | `ui.sidebar.register` | `project` |
| `contextMenuItem` | 右键菜单项 | `ui.action.register` | 由宿主决定 |
| `commentAnnotation` | 评论下方注释区 | `ui.commentAnnotation.register` | `comment` |
| `commentContextMenuItem` | 评论的更多菜单项 | `ui.action.register` | `comment` |

> **注意**：`commentAnnotation` 和 `commentContextMenuItem` 的 entityType 为 `"comment"`，而父实体（issue）信息通过 `parentEntityId` 和 `projectId` 传递。

### Manifest 中声明 Slot

```ts
// src/manifest.ts
import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "myscope.my-plugin",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "My Plugin",
  description: "What my plugin does",
  author: "Your Name <you@example.com>",
  categories: ["connector", "ui"],

  // 声明需要的 capabilities
  capabilities: [
    "ui.page.register",
    "ui.dashboardWidget.register",
    "events.subscribe",
    "http.outbound",
  ],

  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",       // 如果没有 UI，可以省略
  },

  // UI Slots 声明
  ui: {
    slots: [
      {
        type: "dashboardWidget",       // slot 类型
        id: "my-dashboard-widget",      // 插件内唯一 ID
        displayName: "My Widget",        // UI 中显示的名称
        exportName: "MyDashboardWidget", // UI bundle 中导出的组件名
      },
      {
        type: "page",
        id: "my-page",
        displayName: "My Page",
        exportName: "MyPage",
        routePath: "my-page",           // → /:companyPrefix/my-page
      },
    ],
  },
};

export default manifest;
```

### UI Bundle 中实现 Slot 组件

```tsx
// src/ui/index.tsx
import type {
  PluginWidgetProps,
  PluginPageProps,
  PluginDetailTabProps,
} from "@paperclipai/plugin-sdk/ui";
import { usePluginData, usePluginAction, useHostContext } from "@paperclipai/plugin-sdk/ui";

// Dashboard Widget 组件
export function MyDashboardWidget({ context }: PluginWidgetProps) {
  const { data, loading } = usePluginData<{ message: string }>("status", {
    companyId: context.companyId,
  });

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h3>My Plugin</h3>
      <p>{data?.message ?? "No data"}</p>
    </div>
  );
}

// Page 组件
export function MyPage({ context }: PluginPageProps) {
  const { companyId } = context;
  return <div>Plugin page for company {companyId}</div>;
}
```

### Slot 组件 Props

所有 slot 组件都接收类型化的 `context` 对象，结构如下：

```ts
// 基础 context（所有 slot 都有）
interface PluginHostContext {
  companyId: string;
  companyPrefix: string;
}

// dashboardWidget、page、sidebar 等全局 slot
type PluginWidgetProps = { context: PluginHostContext };

// detailTab、toolbarButton 等实体 slot
type PluginDetailTabProps = {
  context: PluginHostContext & {
    entityId: string;     // 当前实体 ID
    entityType: string;   // "project" | "issue" | "agent" | "goal" | "run"
  };
};
```

---

## Lifecycle Hooks（7 个阶段）

插件 Worker 的生命周期由宿主管理。以下是按调用顺序排列的所有 hook：

### 1. `setup(ctx)` — 必选，Worker 启动时调用一次

注册 event handlers、jobs、data/action handlers、tools 等。这是插件初始化的核心入口。

```ts
import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";

const plugin = definePlugin({
  async setup(ctx) {
    // 注册 event listener
    ctx.events.on("issue.created", async (event) => {
      ctx.logger.info("New issue", { id: event.entityId });
    });

    // 注册定时任务
    ctx.jobs.register("sync", async (job) => {
      await doSync(ctx);
    });

    // 注册 UI 数据提供者
    ctx.data.register("status", async ({ companyId }) => {
      return { message: "Plugin is running" };
    });

    // 注册 UI action
    ctx.actions.register("resync", async ({ companyId }) => {
      await doSync(ctx);
      return { ok: true };
    });

    // 注册 Agent Tool
    ctx.tools.register("hello", {
      displayName: "Hello",
      description: "Says hello",
      parametersSchema: { type: "object", properties: {} },
    }, async () => {
      return { content: "Hello from plugin!" };
    });
  },
});
```

### 2. `onHealth()` — 可选，健康检查

返回插件健康状态，宿主在健康检查端点调用。

```ts
const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info("Plugin starting...");
  },

  async onHealth() {
    return {
      status: "ok",
      message: "All systems operational",
    };
  },
});
```

### 3. `onValidateConfig(config)` — 可选，配置校验

在设置页面显示"Test Connection"按钮时，宿主调用此方法。

```ts
const plugin = definePlugin({
  async setup(ctx) {},

  async onValidateConfig(config) {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.apiKey) {
      errors.push("API key is required");
    }

    if (config.syncInterval && config.syncInterval < 60) {
      warnings.push("Sync interval less than 60s may cause rate limits");
    }

    return { ok: errors.length === 0, errors, warnings };
  },
});
```

### 4. `onConfigChanged(newConfig)` — 可选，配置变更热更新

如果插件实现了此方法，宿主在配置变更后调用它，Worker **不重启**。如果未实现，宿主会重启 Worker。

```ts
const plugin = definePlugin({
  async setup(ctx) {},

  async onConfigChanged(newConfig) {
    // 应用新配置，无需重启进程
    this.config = newConfig;
    ctx.logger.info("Config updated", newConfig);
  },
});
```

### 5. `onWebhook(input)` — 可选，处理入站 Webhook

需要声明 `webhooks.receive` capability。

```ts
// manifest 中声明 webhook
// manifest.ts
const manifest = {
  // ...
  capabilities: ["webhooks.receive", "http.outbound"],
  webhooks: [
    { endpointKey: "push", displayName: "Receive Push Events" },
  ],
};

// worker.ts
const plugin = definePlugin({
  async setup(ctx) {},

  async onWebhook(input) {
    if (input.endpointKey === "push") {
      ctx.logger.info("Webhook received", { payload: input.body });
      return { handled: true };
    }
    return { handled: false };
  },
});
```

### 6. `runJob(job)` — 定时任务执行入口

定时任务触发时，宿主找到 `manifest.jobs` 中声明的 job，调用对应的 handler。

```ts
// manifest 中声明 job
const manifest = {
  capabilities: ["jobs.schedule", "plugin.state.write"],
  jobs: [
    {
      jobKey: "hourly-sync",
      displayName: "Hourly Sync",
      description: "Syncs data every hour",
      schedule: "0 * * * *",   // 每小时整点
    },
  ],
};

// worker.ts
const plugin = definePlugin({
  async setup(ctx) {
    ctx.jobs.register("hourly-sync", async (job) => {
      ctx.logger.info("Job started", { runId: job.runId, trigger: job.trigger });
      await doSync(ctx);
      ctx.logger.info("Job done");
    });
  },
});
```

**Job handler 参数 (`PluginJobContext`)：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `jobKey` | `string` | 匹配 manifest 中的声明 |
| `runId` | `string` | 本次运行的 UUID |
| `trigger` | `"schedule" \| "manual" \| "retry"` | 触发来源 |
| `scheduledAt` | `string` | ISO 8601 计划执行时间 |

### 7. `onShutdown()` — 可选，优雅关闭

宿主关闭插件时发送信号，Worker 应在有限时间内（默认 10 秒）清理并退出。

```ts
const plugin = definePlugin({
  async setup(ctx) {},

  async onShutdown() {
    // 关闭数据库连接、取消 pending 请求等
    ctx.logger.info("Plugin shutting down gracefully");
  },
});
```

---

## 配置 Schema

插件的配置通过 JSON Schema 声明，宿主自动生成设置表单。

### 使用 Zod 定义 Schema（推荐）

```ts
import { z } from "@paperclipai/plugin-sdk";

const configSchema = z.object({
  apiToken: z.string().describe("API Token for the external service"),
  syncInterval: z
    .number()
    .min(30)
    .max(3600)
    .default(300)
    .describe("Sync interval in seconds (30–3600)"),
  workspaceMappings: z
    .array(
      z.object({
        companyId: z.string(),
        teamId: z.string().describe("External team ID"),
        enabled: z.boolean().default(true),
      }),
    )
    .default([])
    .describe("Map Paperclip companies to external teams"),
});
```

### 在 Manifest 中使用 Schema

```ts
const manifest: PaperclipPluginManifestV1 = {
  // ...
  capabilities: ["secrets.read-ref"],

  // JSON Schema（Zod schema 转换后的对象）
  instanceConfigSchema: configSchema.json_schema("8", {
    description: "Configuration for My Plugin",
  }).schema,
};
```

### 密钥引用

不要在配置中直接写入密钥值。使用 `"format": "secret-ref"` 标注密钥字段：

```ts
const configSchema = z.object({
  apiKey: z.string().openapi({ format: "secret-ref" }),
});
```

宿主会将此类字段渲染为密钥选择器，从 Paperclip 密钥管理系统解析。

---

## Hello World 示例

以下是一个最小可运行的插件，展示了：manifest 声明、setup hook、`onHealth` hook，以及一个 Dashboard Widget slot。

### 完整文件结构

```
my-hello-world-plugin/
├── src/
│   ├── manifest.ts
│   ├── worker.ts
│   └── ui/
│       └── index.tsx
├── tests/
│   └── plugin.spec.ts
├── package.json
└── tsconfig.json
```

### `src/manifest.ts`

```ts
import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "myscope.hello-world",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Hello World",
  description: "Minimal reference plugin showing the Paperclip plugin structure.",
  author: "Your Name <you@example.com>",
  categories: ["ui"],

  // 声明需要的权限
  capabilities: [
    "ui.dashboardWidget.register",
  ],

  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },

  // 声明 UI Slot
  ui: {
    slots: [
      {
        type: "dashboardWidget",
        id: "hello-world-widget",
        displayName: "Hello World",
        exportName: "HelloWorldWidget",
      },
    ],
  },
};

export default manifest;
```

### `src/worker.ts`

```ts
import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info("Hello World plugin started");

    // 注册 UI 数据端点
    ctx.data.register("status", async ({ companyId }) => {
      return {
        message: "Hello from the Hello World plugin!",
        companyId,
        timestamp: new Date().toISOString(),
      };
    });
  },

  async onHealth() {
    return {
      status: "ok",
      message: "Hello World plugin is healthy",
    };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
```

### `src/ui/index.tsx`

```tsx
import type { PluginWidgetProps } from "@paperclipai/plugin-sdk/ui";
import { usePluginData } from "@paperclipai/plugin-sdk/ui";

interface StatusData {
  message: string;
  companyId: string;
  timestamp: string;
}

export function HelloWorldWidget({ context }: PluginWidgetProps) {
  const { data, loading, error, refresh } = usePluginData<StatusData>("status", {
    companyId: context.companyId,
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: "red" }}>Error: {error.message}</div>;

  return (
    <div style={{ padding: "12px", border: "1px solid #ddd", borderRadius: "8px" }}>
      <h3 style={{ margin: "0 0 8px" }}>👋 Hello World</h3>
      <p style={{ margin: 0, fontSize: "14px" }}>{data?.message}</p>
      {data?.timestamp && (
        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#666" }}>
          Updated: {new Date(data.timestamp).toLocaleTimeString()}
        </p>
      )}
      <button
        onClick={refresh}
        style={{ marginTop: "8px", padding: "4px 8px", cursor: "pointer" }}
      >
        Refresh
      </button>
    </div>
  );
}
```

### 构建与安装

```bash
# 1. 构建插件
pnpm install
pnpm build

# 2. 安装到本地 Paperclip
curl -X POST http://127.0.0.1:3100/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"packageName": "/absolute/path/to/my-hello-world-plugin", "isLocalPath": true}'

# 3. 验证插件状态
curl http://127.0.0.1:3100/api/plugins
```

安装成功后，Hello World Widget 会出现在 Paperclip 仪表板上。

---

## Troubleshooting

### 插件安装后状态为 `error`

**症状**：插件状态显示为 `error`，worker 无法启动。

**排查步骤**：

1. **检查 Worker 入口文件是否存在**
   ```bash
   # 确认 dist/worker.js 存在
   ls dist/worker.js
   ```
   
   Worker 入口是 `manifest.entrypoints.worker` 指向的路径（如 `./dist/worker.js`）。本地安装后如果源码有修改，需要重新构建并**重新安装**插件。

2. **重新安装**
   ```bash
   # 卸载旧插件
   pnpm paperclipai plugin uninstall myscope.hello-world --force
   
   # 重新构建
   pnpm build
   
   # 重新安装
   pnpm paperclipai plugin install /path/to/my-plugin
   ```

3. **检查 worker 进程日志**
   查看 Paperclip 服务端日志中的 `plugin-worker` 相关输出，定位启动错误。

4. **验证 manifest JSON 有效**
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('./dist/manifest.js', 'utf8').match(/export default (\{.*\});\$/m)?.[1] || '{}')"
   ```

### 配置表单报错

**症状**：设置页面表单校验失败，或 "Test Connection" 报错。

**排查步骤**：

1. 确认 `instanceConfigSchema` 是合法的 JSON Schema（对象而非 Zod schema 本身）
2. 密钥字段必须标注 `"format": "secret-ref"`，而非直接写入密钥值
3. 实现 `onValidateConfig` hook 返回具体的 `errors` 和 `warnings`，便于调试

### Event handler 未触发

**症状**：订阅了某个 domain event，但 handler 没有被调用。

**排查步骤**：

1. 确认 `events.subscribe` 在 `capabilities` 中声明
2. 确认在 `setup(ctx)` 中注册了 handler（不是在 `onHealth` 等其他 hook 中）
3. 确认 event type 完全匹配（区分大小写），如 `"issue.created"` 而非 `"Issue.Created"`
4. 确认 companyId 正确——事件按 company 隔离，非该 company 的事件不会投递

### Worker 进程崩溃后无法恢复

**症状**：插件 worker 崩溃，状态卡在 `error`。

**排查步骤**：

1. 检查崩溃原因（查看日志中的 `plugin-worker` 条目）
2. 从 `error` 状态恢复：
   ```bash
   # 通过 API
   curl -X POST http://127.0.0.1:3100/api/plugins/{pluginId}/enable
   
   # 或通过 CLI
   pnpm paperclipai plugin enable myscope.my-plugin
   ```
3. 如果是配置问题导致的崩溃，先修复配置再启用

### UI Slot 组件不渲染

**症状**：Slot 已在 manifest 中声明，但前端不显示。

**排查步骤**：

1. 确认 `exportName` 与 UI bundle 中的导出名**完全一致**（区分大小写）
2. 确认 `entrypoints.ui` 指向的目录包含构建后的 bundle
3. 确认对应 capability 已声明（不同 slot 类型需要不同的 capability）
4. 检查浏览器控制台是否有 JS 错误（插件 UI bundle 加载失败）
5. 确认插件状态为 `ready`，不是 `error` 或 `disabled`

### 定时任务不执行

**排查步骤**：

1. 确认 `jobs.schedule` 在 `capabilities` 中声明
2. 确认 `manifest.jobs` 中声明了该 jobKey
3. 确认 `ctx.jobs.register(jobKey, fn)` 中的 key 与 manifest 中的 `jobKey` 一致
4. 检查 cron 表达式是否正确：`"0 * * * *"` = 每小时整点，`"*/5 * * * *"` = 每 5 分钟

### 跨插件通信不工作

**排查步骤**：

1. 发送方插件需要 `events.emit` capability
2. 接收方插件需要 `events.subscribe` capability
3. 事件名必须是 `plugin.<pluginId>.<eventName>` 格式（如 `plugin.myscope.sync.push`）
4. 在 `setup()` 中注册订阅，不要在 handler 内部注册
5. Plugin-to-plugin 事件需要指定 `companyId`，无法向所有 company 广播

### 常见错误码（来自 UI 桥接层）

| 错误码 | 含义 | 排查方向 |
|--------|------|---------|
| `WORKER_UNAVAILABLE` | Worker 进程未运行 | 检查插件状态是否为 `ready`，重启 worker |
| `CAPABILITY_DENIED` | 缺少所需 capability | 确认 manifest 中声明了对应 capability |
| `WORKER_ERROR` | Worker 内部处理出错 | 检查 worker 日志，查看 `onWebhook`/`getData`/`performAction` 实现 |
| `TIMEOUT` | Worker 响应超时 | Worker 处理时间过长，检查是否有阻塞操作 |
| `UNKNOWN` | 未知桥接层错误 | 查看服务端日志 |

---

## 下一步

- 查看 [API.md](./API.md) 了解完整的 Host Services API（event bridge、config 读写、state 存储等）
- 查看 [PLUGIN_SPEC.md](./PLUGIN_SPEC.md) 了解完整架构规范和未来路线
- 查看 `packages/plugins/examples/` 中的参考实现

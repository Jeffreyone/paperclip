import type { ServerAdapterModule } from "../types.js";
import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";

export const e2bAdapter: ServerAdapterModule = {
  type: "e2b",
  execute,
  testEnvironment,
  models: [],
  agentConfigurationDoc: `# e2b adapter configuration

Adapter: e2b

Use when: You want to run an agent in a cloud sandbox managed by E2B.

Don't use when: You need stdout capture and real-time run viewing (consider local adapters instead).

Core fields:
- template (string, optional): E2B sandbox template name/id. Defaults to base template.
- startupCommand (string, optional): Command to execute when the sandbox starts. Default: echo 'E2B sandbox ready'
- idleTimeoutMs (number, optional): Sandbox idle timeout in milliseconds. Default: 600000 (10 minutes)
- timeoutMs (number, optional): Per-command execution timeout in milliseconds. Default: 300000 (5 minutes)

Environment fields (via adapterConfig.env):
- E2B_API_KEY (required): E2B API key. Use a company secret reference.

The sandbox is reused across heartbeats. The sandbox ID is stored in the session, so subsequent
heartbeats connect to the same sandbox rather than creating a new one each time.

If the sandbox becomes unresponsive, a new one is created automatically.
`,
};

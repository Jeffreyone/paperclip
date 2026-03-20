export const type = "openclaw";
export const label = "OpenClaw";

export const models: { id: string; label: string }[] = [];

export const agentConfigurationDoc = `# openclaw agent configuration

Adapter: openclaw

Use when:
- You want Paperclip to invoke OpenClaw as a local subprocess on the host machine.
- OpenClaw is installed and accessible via the configured command (default: "openclaw").
- You need session persistence across runs (OpenClaw supports session resumption via --session-id).
- You want to use AGENTS.md instruction files with OpenClaw.

Don't use when:
- OpenClaw is only available via Gateway WebSocket (use "openclaw_gateway" adapter instead).
- Your deployment does not permit spawning local processes on the Paperclip server.

Core fields:
- command (string, optional): OpenClaw CLI command (default "openclaw")
- cwd (string, required): absolute working directory for the agent process
- instructionsFilePath (string, optional): absolute path to an AGENTS.md instruction file; contents are prepended to the prompt
- promptTemplate (string, optional): prompt template with {{agent.id}}, {{companyId}}, {{run.id}} substitution; default: "You are agent {{agent.id}} ({{agent.name}}). Continue your Paperclip work."
- model (string, optional): OpenClaw model/provider ID (e.g. "openai/gpt-4o")
- timeoutSec (number, optional): execution timeout in seconds (default 0 = no timeout)
- graceSec (number, optional): graceful shutdown period after timeout (default 15)
- env (object, optional): additional environment variables injected into the subprocess

Session management:
- Sessions are identified by --session-id; the adapter resumes a stored session if the cwd matches.
- If session resume fails with "unknown session", the adapter retries with a fresh session.

AGENTS.md support:
- Set instructionsFilePath to an absolute path to an AGENTS.md file.
- The file is read at runtime and its contents are prepended to the prompt.
- Relative file references in AGENTS.md are resolved against the file's directory.
`;

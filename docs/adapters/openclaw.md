---
title: OpenClaw Adapter
summary: Configure OpenClaw as a local subprocess agent in Paperclip
---

The `openclaw` adapter runs OpenClaw as a local subprocess on the Paperclip server host.

## Requirements

- `openclaw` CLI must be installed and accessible in the PATH
- The Paperclip server must have filesystem access to the working directory

## Configuration

| Field | Required | Description |
|-------|----------|-------------|
| `command` | No | OpenClaw CLI command (default: `openclaw`) |
| `cwd` | Yes | Absolute path to the working directory |
| `instructionsFilePath` | No | Absolute path to an `AGENTS.md` instruction file; contents are prepended to every prompt |
| `promptTemplate` | No | Prompt template with `{{agent.id}}`, `{{companyId}}`, `{{run.id}}` substitution |
| `timeoutSec` | No | Execution timeout in seconds (default: 0 = no timeout) |
| `graceSec` | No | Graceful shutdown period after timeout (default: 15) |
| `env` | No | Additional environment variables injected into the subprocess |

## AGENTS.md Support

Set `instructionsFilePath` to the absolute path of an `AGENTS.md` file. The adapter reads the file at runtime and prepends its contents to the prompt. Relative file references in `AGENTS.md` are resolved against the file's directory.

## Session Persistence

The adapter uses OpenClaw's `--session-id` flag to maintain conversation context across runs. Sessions are stored in OpenClaw's default session directory (`~/.openclaw/sessions/`).

If a stored session cannot be resumed (e.g., the working directory has changed), the adapter retries with a fresh session.

## Environment Variables

The adapter injects standard Paperclip variables into the subprocess:

| Variable | Description |
|----------|-------------|
| `PAPERCLIP_RUN_ID` | Current run ID |
| `PAPERCLIP_AGENT_ID` | Agent ID |
| `PAPERCLIP_COMPANY_ID` | Company ID |
| `PAPERCLIP_API_URL` | Paperclip API base URL |
| `PAPERCLIP_TASK_ID` | Current task/issue ID |
| `PAPERCLIP_WAKE_REASON` | Wake trigger reason |
| `PAPERCLIP_API_KEY` | Agent's API key (for calling Paperclip APIs) |

## Output Format

The adapter parses JSON Lines output from OpenClaw's stdout. For best results, ensure OpenClaw is configured to output structured JSON.

## When to Use This vs. openclaw_gateway

- Use **`openclaw`** when OpenClaw is installed on the same host as the Paperclip server and you want direct subprocess execution.
- Use **`openclaw_gateway`** when OpenClaw runs on a different host or requires Gateway WebSocket authentication.

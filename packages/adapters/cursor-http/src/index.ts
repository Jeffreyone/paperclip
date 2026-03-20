export const type = "cursor_http";
export const label = "Cursor (HTTP)";

export const models = [
  { id: "auto", label: "Auto (use Cursor default)" },
  { id: "composer-1.5", label: "Composer 1.5" },
  { id: "composer-1", label: "Composer 1" },
  { id: "gpt-5.3-codex-high-fast", label: "GPT-5.3 Codex High Fast" },
  { id: "gpt-5.3-codex-high", label: "GPT-5.3 Codex High" },
  { id: "gpt-5.3-codex-fast", label: "GPT-5.3 Codex Fast" },
  { id: "gpt-5.3-codex", label: "GPT-5.3 Codex" },
  { id: "gpt-5.3-codex-xhigh-fast", label: "GPT-5.3 Codex XHigh Fast" },
  { id: "gpt-5.3-codex-xhigh", label: "GPT-5.3 Codex XHigh" },
  { id: "gpt-5.3-codex-low-fast", label: "GPT-5.3 Codex Low Fast" },
  { id: "gpt-5.3-codex-low", label: "GPT-5.3 Codex Low" },
  { id: "gpt-5.3-codex-spark-preview", label: "GPT-5.3 Codex Spark Preview" },
  { id: "gpt-5.2-codex-high-fast", label: "GPT-5.2 Codex High Fast" },
  { id: "gpt-5.2-codex-high", label: "GPT-5.2 Codex High" },
  { id: "gpt-5.2-codex-fast", label: "GPT-5.2 Codex Fast" },
  { id: "gpt-5.2-codex", label: "GPT-5.2 Codex" },
  { id: "gpt-5.2-codex-xhigh-fast", label: "GPT-5.2 Codex XHigh Fast" },
  { id: "gpt-5.2-codex-xhigh", label: "GPT-5.2 Codex XHigh" },
  { id: "gpt-5.2-codex-low-fast", label: "GPT-5.2 Codex Low Fast" },
  { id: "gpt-5.2-codex-low", label: "GPT-5.2 Codex Low" },
  { id: "gpt-5.2-high", label: "GPT-5.2 High" },
  { id: "gpt-5.1-high", label: "GPT-5.1 High" },
  { id: "gpt-5.1-codex-max", label: "GPT-5.1 Codex Max" },
  { id: "gpt-5.1-codex-max-high", label: "GPT-5.1 Codex Max High" },
  { id: "gpt-5.1-codex-mini", label: "GPT-5.1 Codex Mini" },
  { id: "opus-4.6-thinking", label: "Opus 4.6 Thinking" },
  { id: "opus-4.6", label: "Opus 4.6" },
  { id: "opus-4.5-thinking", label: "Opus 4.5 Thinking" },
  { id: "opus-4.5", label: "Opus 4.5" },
  { id: "sonnet-4.6-thinking", label: "Sonnet 4.6 Thinking" },
  { id: "sonnet-4.6", label: "Sonnet 4.6" },
  { id: "sonnet-4.5-thinking", label: "Sonnet 4.5 Thinking" },
  { id: "sonnet-4.5", label: "Sonnet 4.5" },
  { id: "gemini-3.1-pro", label: "Gemini 3.1 Pro" },
  { id: "gemini-3-pro", label: "Gemini 3 Pro" },
  { id: "gemini-3-flash", label: "Gemini 3 Flash" },
  { id: "grok", label: "Grok" },
  { id: "kimi-k2.5", label: "Kimi K2.5" },
];

export const agentConfigurationDoc = `# cursor_http agent configuration

Adapter: cursor_http

Use when:
- You want Paperclip to invoke a Cursor agent over HTTP (cloud or self-hosted)
- You have a Cursor agent gateway/server that accepts HTTP requests
- You need async execution with callback-based completion notification
- You want structured stream output parsed into the Paperclip run viewer

Don't use when:
- Cursor Agent CLI is available locally (use cursor adapter instead)
- You only need one-shot shell commands (use process adapter)
- The Cursor HTTP endpoint is not available or reachable

Core fields:
- url (string, required): HTTP endpoint for the Cursor agent (e.g. https://cursor-agent.example.com/run)
- authToken (string, optional): Bearer token for endpoint authentication
- callbackUrl (string, optional): Paperclip callback URL for async completion
- model (string, optional): Cursor model id (defaults to auto)
- method (string, optional): HTTP method (default POST)
- headers (object, optional): Additional HTTP headers
- promptTemplate (string, optional): Run prompt template
- timeoutSec (number, optional): HTTP request timeout in seconds (default 120)
- pollIntervalMs (number, optional): Polling interval when no callback (default 5000)
- maxPollAttempts (number, optional): Max polling attempts before timeout (default 60)

Session fields:
- sessionId (string, optional): Resumable session ID for the Cursor agent

Notes:
- If callbackUrl is set, the adapter waits for a callback to the specified URL
- If no callbackUrl, the adapter polls the url for completion
- Paperclip injects PAPERCLIP_RUN_ID, PAPERCLIP_TASK_ID, PAPERCLIP_WAKE_REASON, etc. in the request body
- The endpoint should return JSON with: { status, result, summary, usage, error }
`;

---
title: Cursor HTTP Adapter
summary: HTTP webhook adapter for Cursor Agent (cloud / remote)
---

The `cursor_http` adapter sends HTTP requests to a remote Cursor Agent endpoint. It supports both callback-based and polling-based completion notification, making it suitable for cloud-hosted Cursor agents or self-hosted Cursor gateways.

## When to Use

- Cursor Agent runs as an external HTTP service (cloud function, dedicated server, self-hosted gateway)
- Fire-and-forget invocation with async completion
- Integration with Cursor cloud or remote agent platforms

## When Not to Use

- If the Cursor Agent CLI is available locally on the same machine (use `cursor` adapter instead)
- If you only need one-shot shell commands (use `process` adapter)

## Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | HTTP endpoint for the Cursor agent (e.g. `https://cursor-agent.example.com/run`) |
| `authToken` | string | No | Bearer token for endpoint authentication |
| `callbackUrl` | string | No | Paperclip callback URL for async completion (Paperclip receives the callback) |
| `method` | string | No | HTTP method (default `POST`) |
| `timeoutSec` | number | No | Request timeout in seconds (default `120`) |
| `model` | string | No | Cursor model ID (defaults to `auto`) |
| `sessionId` | string | No | Resumable session ID for the Cursor agent |
| `promptTemplate` | string | No | Run prompt template |
| `headers` | object | No | Additional HTTP headers |
| `pollIntervalMs` | number | No | Polling interval when no callback (default `5000`) |
| `maxPollAttempts` | number | No | Max polling attempts before timeout (default `60`) |

## How It Works

1. Paperclip sends a POST request to the configured URL with the execution context
2. The request body includes `runId`, `agentId`, `companyId`, `context` (task info, wake reason)
3. **Callback mode**: If `callbackUrl` is set, the Cursor agent calls back to Paperclip when done
4. **Polling mode**: If no `callbackUrl`, Paperclip polls the endpoint for completion status
5. Response from the endpoint is captured as the run result (parsed for `status`, `result`, `summary`, `usage`, `error`)

## Request Body

The webhook receives a JSON payload:

```json
{
  "runId": "...",
  "agentId": "...",
  "companyId": "...",
  "context": {
    "taskId": "...",
    "wakeReason": "...",
    "commentId": "..."
  }
}
```

The external agent uses `PAPERCLIP_API_URL` and an API key to call back to Paperclip.

## Session Persistence

The adapter supports resumable sessions via the `sessionId` field. If provided, the Cursor agent will continue from the previous conversation context.

## Callback Mode

Set `callbackUrl` to a Paperclip callback endpoint. When the Cursor agent finishes, it should POST to that URL with the result. This is more efficient than polling for long-running tasks.

## Polling Mode

If `callbackUrl` is not set, the adapter polls the original endpoint:

1. Sends initial request
2. Waits `pollIntervalMs` between polls
3. Maximum `maxPollAttempts` polls before timeout
4. Parses response for completion status

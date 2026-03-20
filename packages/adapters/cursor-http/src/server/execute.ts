import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import {
  asString,
  asNumber,
  asBoolean,
  parseObject,
  buildPaperclipEnv,
  renderTemplate,
} from "@paperclipai/adapter-utils/server-utils";
import { parseCursorHttpResponse, isCursorHttpError } from "./parse.js";

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveAuthToken(config: Record<string, unknown>): string | null {
  return nonEmpty(config.authToken) ?? nonEmpty(config.token) ?? null;
}

function resolveSessionId(config: Record<string, unknown>, runtimeSessionId: string | null): string | null {
  const configured = nonEmpty(config.sessionId);
  if (configured) return configured;
  return runtimeSessionId && runtimeSessionId.trim().length > 0 ? runtimeSessionId.trim() : null;
}

function buildRequestBody(
  ctx: AdapterExecutionContext,
  promptText: string,
  sessionId: string | null,
): Record<string, unknown> {
  const { runId, agent, context } = ctx;

  const paperclipPayload: Record<string, unknown> = {
    runId,
    agentId: agent.id,
    companyId: agent.companyId,
    taskId: nonEmpty(context.taskId) ?? nonEmpty(context.issueId),
    issueId: nonEmpty(context.issueId),
    wakeReason: nonEmpty(context.wakeReason),
    wakeCommentId: nonEmpty(context.wakeCommentId) ?? nonEmpty(context.commentId),
    approvalId: nonEmpty(context.approvalId),
    approvalStatus: nonEmpty(context.approvalStatus),
    apiUrl: process.env.PAPERCLIP_API_URL ?? null,
  };

  const payloadTemplate = parseObject(ctx.config.payloadTemplate);

  return {
    ...payloadTemplate,
    ...paperclipPayload,
    message: promptText,
    ...(sessionId ? { sessionId } : {}),
  };
}

function buildPrompt(ctx: AdapterExecutionContext, sessionId: string | null): string {
  const promptTemplate = asString(
    ctx.config.promptTemplate,
    "You are agent {{agent.id}} ({{agent.name}}). Continue your Paperclip work.",
  );
  const templateData = {
    agentId: ctx.agent.id,
    companyId: ctx.agent.companyId,
    runId: ctx.runId,
    company: { id: ctx.agent.companyId },
    agent: ctx.agent,
    run: { id: ctx.runId, source: "on_demand" },
    context: ctx.context,
  };
  const renderedPrompt = renderTemplate(promptTemplate, templateData);

  const sessionNote = sessionId
    ? `\n\nNote: Resuming existing Cursor session: ${sessionId}`
    : "";

  const envVars = buildPaperclipEnv(ctx.agent);
  const paperclipKeys = Object.keys(envVars)
    .filter((k) => k.startsWith("PAPERCLIP_"))
    .sort();

  const envNote = paperclipKeys.length > 0
    ? `\n\nPaperclip runtime variables available: ${paperclipKeys.join(", ")}`
    : "";

  const wakeNote = ctx.context.taskId || ctx.context.issueId
    ? `\n\nCurrent task/issue: ${ctx.context.taskId ?? ctx.context.issueId}\nWake reason: ${ctx.context.wakeReason ?? "on_demand"}`
    : "";

  return `${renderedPrompt}${sessionNote}${envNote}${wakeNote}`;
}

async function httpRequest(
  url: string,
  method: string,
  body: unknown,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    let data: unknown = null;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        data = await res.json();
      } catch {
        data = await res.text();
      }
    } else {
      data = await res.text();
    }

    return {
      ok: res.ok,
      status: res.status,
      data,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function pollForCompletion(
  url: string,
  runId: string,
  headers: Record<string, string>,
  pollIntervalMs: number,
  maxAttempts: number,
  onLog: AdapterExecutionContext["onLog"],
): Promise<unknown> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

    try {
      await onLog("stdout", `[cursor-http] polling attempt ${attempt + 1}/${maxAttempts}\n`);

      const res = await httpRequest(url, "GET", { runId }, headers, 10_000);
      if (res.ok && typeof res.data === "object" && res.data !== null) {
        const data = res.data as Record<string, unknown>;
        const status = String(data.status ?? "").toLowerCase();
        if (status === "completed" || status === "done" || status === "success") {
          return data;
        }
        if (status === "failed" || status === "error") {
          return data;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await onLog("stderr", `[cursor-http] poll error: ${message}\n`);
    }
  }

  throw new Error(`Polling timed out after ${maxAttempts} attempts`);
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, runtime, config, context, onLog, onMeta } = ctx;

  const url = asString(config.url, "").trim();
  if (!url) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "Cursor HTTP adapter missing url",
      errorCode: "cursor_http_url_missing",
    };
  }

  const method = asString(config.method, "POST").toUpperCase();
  const timeoutSec = Math.max(0, Math.floor(asNumber(config.timeoutSec, 120)));
  const timeoutMs = timeoutSec * 1000;
  const callbackUrl = asString(config.callbackUrl, "").trim();
  const pollIntervalMs = Math.max(1000, Math.floor(asNumber(config.pollIntervalMs, 5000)));
  const maxPollAttempts = Math.max(1, Math.floor(asNumber(config.maxPollAttempts, 60)));
  const model = asString(config.model, "auto").trim();

  const authToken = resolveAuthToken(parseObject(config));
  const headers: Record<string, string> = {};
  if (authToken) {
    headers.authorization = `Bearer ${authToken}`;
  }
  const extraHeaders = parseObject(config.headers) as Record<string, string>;
  for (const [k, v] of Object.entries(extraHeaders)) {
    if (typeof v === "string") headers[k] = v;
  }

  // Resolve session
  const runtimeSessionParams = parseObject(runtime.sessionParams);
  const runtimeSessionId = asString(runtimeSessionParams.sessionId, runtime.sessionId ?? "");
  const sessionId = resolveSessionId(parseObject(config), runtimeSessionId);

  // Build prompt
  const promptText = buildPrompt(ctx, sessionId);

  // Build request body
  const body = buildRequestBody(ctx, promptText, sessionId);

  if (model && model !== "auto") {
    (body as Record<string, unknown>).model = model;
  }

  if (onMeta) {
    await onMeta({
      adapterType: "cursor_http",
      command: method,
      context: ctx.context,
    });
  }

  await onLog("stdout", `[cursor-http] invoking ${method} ${url}\n`);
  if (sessionId) {
    await onLog("stdout", `[cursor-http] session: ${sessionId}\n`);
  }
  if (callbackUrl) {
    await onLog("stdout", `[cursor-http] callback: ${callbackUrl}\n`);
  }

  let resultData: unknown;
  let httpStatus = 0;

  try {
    const res = await httpRequest(url, method, body, headers, timeoutMs);
    httpStatus = res.status;

    if (!res.ok) {
      const errorBody = typeof res.data === "object" && res.data !== null
        ? JSON.stringify(res.data)
        : String(res.data);
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: `HTTP invoke failed with status ${res.status}: ${errorBody}`,
        errorCode: "cursor_http_request_failed",
        resultJson: res.data as Record<string, unknown> | null,
      };
    }

    // If async (callback mode), wait for callback or poll
    if (callbackUrl && typeof res.data === "object" && res.data !== null) {
      const data = res.data as Record<string, unknown>;
      const status = String(data.status ?? "").toLowerCase();

      if (status === "pending" || status === "running" || status === "accepted") {
        await onLog("stdout", `[cursor-http] run accepted, waiting for callback or polling\n`);

        if (callbackUrl) {
          // In callback mode, the adapter would need a server endpoint to receive callbacks.
          // For now, fall back to polling the original URL.
          resultData = await pollForCompletion(
            url,
            runId,
            headers,
            pollIntervalMs,
            maxPollAttempts,
            onLog,
          );
        } else {
          resultData = data;
        }
      } else {
        resultData = data;
      }
    } else {
      resultData = res.data;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const timedOut = message.includes("aborted") || message.includes("timeout");
    return {
      exitCode: 1,
      signal: null,
      timedOut,
      errorMessage: message,
      errorCode: timedOut ? "cursor_http_timeout" : "cursor_http_request_failed",
    };
  }

  // Parse result
  const parsed = parseCursorHttpResponse(resultData);
  const parsedError = isCursorHttpError(resultData);

  const resolvedSessionId = parsed.sessionId ?? sessionId;
  const resolvedSessionParams = resolvedSessionId
    ? ({ sessionId: resolvedSessionId } as Record<string, unknown>)
    : null;

  const errorMessage =
    parsed.errorMessage ??
    (parsedError ? String(resultData) : null);

  return {
    exitCode: errorMessage ? 1 : 0,
    signal: null,
    timedOut: parsed.timedOut ?? false,
    errorMessage,
    usage: parsed.usage,
    sessionId: resolvedSessionId,
    sessionParams: resolvedSessionParams,
    sessionDisplayId: resolvedSessionId,
    provider: parsed.provider ?? "cursor",
    model: model !== "auto" ? model : (parsed.model ?? null),
    costUsd: parsed.costUsd,
    resultJson: typeof resultData === "object" && resultData !== null
      ? resultData as Record<string, unknown>
      : null,
    summary: parsed.summary ?? null,
    clearSession: false,
  };
}

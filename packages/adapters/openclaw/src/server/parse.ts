import type { UsageSummary } from "@paperclipai/adapter-utils";
import { asNumber, asString, parseJson } from "@paperclipai/adapter-utils/server-utils";

export function parseOpenClawJsonl(stdout: string) {
  let sessionId: string | null = null;
  const messages: string[] = [];
  const errors: string[] = [];
  const usage: UsageSummary = {
    inputTokens: 0,
    outputTokens: 0,
  };
  let costUsd = 0;
  let provider: string | null = null;
  let model: string | null = null;

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const event = parseJson(line);
    if (!event) continue;

    const currentSessionId = asString(event.sessionId, "").trim();
    if (currentSessionId) sessionId = currentSessionId;

    const type = asString(event.type, "");

    if (type === "session") {
      const sid = asString(event.sessionId, "").trim();
      if (sid) sessionId = sid;
      const m = asString(event.model, "").trim();
      if (m) model = m;
      continue;
    }

    if (type === "text" || type === "assistant") {
      const text = asString(event.text ?? event.content, "").trim();
      if (text) messages.push(text);
      continue;
    }

    if (type === "result" || type === "finish") {
      const tokens = event.usage;
      if (typeof tokens === "object" && tokens !== null) {
        usage.inputTokens += asNumber((tokens as Record<string, unknown>).inputTokens, 0);
        usage.outputTokens += asNumber((tokens as Record<string, unknown>).outputTokens, 0);
        usage.cachedInputTokens = asNumber((tokens as Record<string, unknown>).cachedInputTokens, 0);
      }
      const cost = asNumber(event.costUsd ?? event.cost, 0);
      if (cost > 0) costUsd = cost;
      const text = asString(event.text ?? event.result ?? event.summary, "").trim();
      if (text && !messages.includes(text)) messages.push(text);
      const prov = asString(event.provider, "").trim();
      if (prov) provider = prov;
      const mdl = asString(event.model, "").trim();
      if (mdl) model = mdl;
      continue;
    }

    if (type === "error") {
      const text = asString(event.message ?? event.error, "").trim();
      if (text) errors.push(text);
      continue;
    }
  }

  return {
    sessionId,
    summary: messages.join("\n\n").trim(),
    usage,
    costUsd,
    errorMessage: errors.length > 0 ? errors.join("\n") : null,
    provider,
    model,
  };
}

export function isOpenClawUnknownSessionError(stdout: string, stderr: string): boolean {
  const haystack = `${stdout}\n${stderr}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

  return /unknown\s+session|session\b.*\bnot\s+found|session.*not\s+exist|no session/i.test(haystack);
}

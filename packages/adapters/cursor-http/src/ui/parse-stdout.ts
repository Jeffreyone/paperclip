import type { TranscriptEntry } from "@paperclipai/adapter-utils";

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function parseCursorHttpStdoutLine(line: string, ts: string): TranscriptEntry[] {
  if (!line.trim()) return [];

  const parsed = asRecord(safeJsonParse(line));
  if (!parsed) {
    return [{ kind: "stdout", ts, text: line }];
  }

  const type = asString(parsed.type);

  if (type === "init" || type === "session") {
    return [{
      kind: "init",
      ts,
      model: asString(parsed.model, "cursor"),
      sessionId: asString(parsed.sessionId ?? parsed.session_id, undefined),
    }];
  }

  if (type === "assistant" || type === "message") {
    const message = parsed.message ?? parsed.text ?? parsed.content;
    if (typeof message === "string") {
      const text = message.trim();
      return text ? [{ kind: "assistant", ts, text }] : [];
    }
    return [{ kind: "assistant", ts, text: asString(message) }];
  }

  if (type === "thinking" || type === "thought") {
    const text = asString(parsed.text ?? parsed.content).trim();
    return text ? [{ kind: "thinking", ts, text }] : [];
  }

  if (type === "tool_call" || type === "toolCall") {
    const name = asString(parsed.name ?? parsed.tool ?? "tool");
    return [{
      kind: "tool_call",
      ts,
      name,
      input: parsed.input ?? parsed.arguments ?? parsed.args ?? {},
    }];
  }

  if (type === "tool_result" || type === "toolResult") {
    const rawOutput = parsed.output ?? parsed.result ?? parsed.text;
    const content =
      typeof rawOutput === "string"
        ? rawOutput
        : JSON.stringify(rawOutput ?? parsed);
    const isError = parsed.isError === true || parsed.is_error === true || parsed.error !== undefined;
    return [{
      kind: "tool_result",
      ts,
      toolUseId: asString(parsed.callId ?? parsed.call_id, "tool_result"),
      content,
      isError,
    }];
  }

  if (type === "result" || type === "completed") {
    const usage = asRecord(parsed.usage);
    const errors = Array.isArray(parsed.errors)
      ? parsed.errors.map((v) => String(v)).filter(Boolean)
      : [];
    const status = asString(parsed.status).toLowerCase();
    const isError = status === "error" || status === "failed" || parsed.isError === true;

    return [{
      kind: "result",
      ts,
      text: asString(parsed.summary ?? parsed.result ?? parsed.text),
      inputTokens: asNumber(usage?.inputTokens ?? usage?.input_tokens, 0),
      outputTokens: asNumber(usage?.outputTokens ?? usage?.output_tokens, 0),
      cachedTokens: asNumber(usage?.cachedInputTokens ?? usage?.cached_input_tokens, 0),
      costUsd: asNumber(parsed.costUsd ?? parsed.cost_usd ?? parsed.cost, 0),
      subtype: status || asString(parsed.type, "result"),
      isError,
      errors,
    }];
  }

  if (type === "error") {
    return [{ kind: "stderr", ts, text: asString(parsed.message ?? parsed.error, line) }];
  }

  if (type === "log" || type === "stdout" || type === "system") {
    const text = asString(parsed.message ?? parsed.text ?? parsed.content, "").trim();
    return text ? [{ kind: "system", ts, text }] : [];
  }

  return [{ kind: "stdout", ts, text: line }];
}

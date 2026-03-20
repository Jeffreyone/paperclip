import type { TranscriptEntry } from "@paperclipai/adapter-utils";
import { asString, parseJson } from "@paperclipai/adapter-utils/json-utils";

function parseOpenClawJsonLine(line: string): TranscriptEntry | null {
  const event = parseJson(line);
  if (!event) return null;

  const type = asString(event.type, "");
  const ts = new Date().toISOString();

  if (type === "session" || type === "init") {
    const model = asString(event.model, "");
    const sessionId = asString(event.sessionId, "");
    if (model || sessionId) {
      return { kind: "init", ts, model, sessionId };
    }
    return null;
  }

  if (type === "text" || type === "assistant") {
    const text = asString(event.text ?? event.content, "").trim();
    if (text) {
      return { kind: "assistant", ts, text, delta: true };
    }
    return null;
  }

  if (type === "tool_call") {
    const name = asString(event.name ?? event.tool, "");
    const input = event.input ?? event.arguments;
    return { kind: "tool_call", ts, name, input: input as Record<string, unknown> };
  }

  if (type === "tool_result" || type === "tool") {
    const content = asString(event.content ?? event.result, "");
    const isError = asString(event.isError, "").toLowerCase() === "true" ||
      asString(event.status, "").toLowerCase() === "error";
    const toolUseId = asString(event.toolUseId ?? event.id ?? event.tool_call_id, content.slice(0, 32));
    return { kind: "tool_result", ts, toolUseId, content, isError };
  }

  if (type === "error") {
    const text = asString(event.message ?? event.error, "").trim();
    if (text) {
      return { kind: "stderr", ts, text };
    }
  }

  return null;
}

export function parseOpenClawStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[openclaw]")) {
    const text = trimmed.replace(/^\[openclaw\]\s*/, "");
    return [{ kind: "system", ts, text }];
  }

  const parsed = parseOpenClawJsonLine(trimmed);
  if (parsed) return [parsed];

  return [{ kind: "stdout", ts, text: trimmed }];
}

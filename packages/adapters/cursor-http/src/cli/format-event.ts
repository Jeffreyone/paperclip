import pc from "picocolors";

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

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function printCursorHttpStreamEvent(raw: string, _debug: boolean): void {
  if (!raw.trim()) return;

  const parsed = asRecord(safeJsonParse(raw));
  if (!parsed) {
    console.log(raw);
    return;
  }

  const type = asString(parsed.type);

  if (type === "init" || type === "session") {
    console.log(pc.blue(`Cursor HTTP session: ${asString(parsed.sessionId ?? parsed.session_id, "initialized")}`));
    return;
  }

  if (type === "assistant" || type === "message") {
    const text = asString(parsed.message ?? parsed.text).trim();
    if (text) console.log(pc.green(`assistant: ${text}`));
    return;
  }

  if (type === "thinking" || type === "thought") {
    const text = asString(parsed.text).trim();
    if (text) console.log(pc.gray(`thinking: ${text}`));
    return;
  }

  if (type === "tool_call") {
    const name = asString(parsed.name ?? parsed.tool, "tool");
    console.log(pc.yellow(`tool_call: ${name}`));
    return;
  }

  if (type === "tool_result") {
    const output = asString(parsed.output ?? parsed.result);
    const isError = parsed.isError === true || parsed.is_error === true;
    if (output) console.log((isError ? pc.red : pc.cyan)(`tool_result: ${output}`));
    return;
  }

  if (type === "result" || type === "completed") {
    const usage = asRecord(parsed.usage);
    const input = asNumber(usage?.inputTokens ?? usage?.input_tokens, 0);
    const output = asNumber(usage?.outputTokens ?? usage?.output_tokens, 0);
    const cost = asNumber(parsed.costUsd ?? parsed.cost_usd, 0);
    const summary = asString(parsed.summary ?? parsed.result).trim();
    const status = asString(parsed.status).toLowerCase();
    const isError = status === "error" || status === "failed";

    console.log(pc.blue(`result: ${status || "completed"}`));
    if (input || output) console.log(pc.blue(`tokens: in=${input} out=${output} cost=$${cost.toFixed(6)}`));
    if (summary) console.log((isError ? pc.red : pc.green)(`assistant: ${summary}`));
    return;
  }

  if (type === "error") {
    console.log(pc.red(`error: ${asString(parsed.message ?? parsed.error, raw)}`));
    return;
  }

  console.log(raw);
}

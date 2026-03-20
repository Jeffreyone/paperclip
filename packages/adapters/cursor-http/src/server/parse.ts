import type { UsageSummary } from "@paperclipai/adapter-utils";

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

export type ParsedCursorHttpResult = {
  sessionId: string | null;
  summary: string | null;
  errorMessage: string | null;
  timedOut: boolean | null;
  usage: UsageSummary | undefined;
  costUsd: number | null;
  provider: string | null;
  model: string | null;
};

export function parseCursorHttpResponse(data: unknown): ParsedCursorHttpResult {
  const record = asRecord(data);
  if (!record) {
    return {
      sessionId: null,
      summary: null,
      errorMessage: null,
      timedOut: null,
      usage: undefined,
      costUsd: null,
      provider: null,
      model: null,
    };
  }

  const status = String(record.status ?? "").toLowerCase();
  const timedOut =
    status === "timeout" ||
    status === "timed_out" ||
    status === "timedout" ||
    asBoolean(record.timedOut) ||
    asBoolean(record.timed_out) ||
    null;

  const errorMessage = (() => {
    const rawError = record.error ?? record.errorMessage ?? record.message;
    if (typeof rawError === "string" && rawError.trim().length > 0) return rawError.trim();
    if (status === "failed" || status === "error") {
      const summary = asString(record.summary);
      if (summary) return summary;
    }
    return null;
  })();

  const usage = (() => {
    const rawUsage = record.usage ?? record.usageStats;
    if (!rawUsage || typeof rawUsage !== "object") return undefined;
    const u = rawUsage as Record<string, unknown>;
    const inputTokens = asNumber(u.inputTokens ?? u.input_tokens, 0);
    const outputTokens = asNumber(u.outputTokens ?? u.output_tokens, 0);
    const cachedInputTokens = asNumber(
      u.cachedInputTokens ?? u.cached_input_tokens ?? u.cacheRead ?? u.cache_read ?? 0,
      0,
    );
    if (inputTokens <= 0 && outputTokens <= 0 && cachedInputTokens <= 0) return undefined;
    return {
      inputTokens,
      outputTokens,
      ...(cachedInputTokens > 0 ? { cachedInputTokens } : {}),
    };
  })();

  const costUsd = asNumber(record.costUsd ?? record.cost_usd ?? record.cost, 0) || null;

  const sessionId = (() => {
    const raw = record.sessionId ?? record.session_id ?? record.sessionID;
    return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
  })();

  const summary = (() => {
    const raw = record.summary ?? record.result ?? record.text ?? record.message;
    if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();
    if (typeof raw === "object" && raw !== null) {
      const obj = raw as Record<string, unknown>;
      const text = asString(obj.text).trim();
      if (text) return text;
    }
    return null;
  })();

  const provider = asString(record.provider, undefined);
  const model = asString(record.model, undefined);

  return {
    sessionId,
    summary,
    errorMessage,
    timedOut,
    usage,
    costUsd,
    provider,
    model,
  };
}

export function isCursorHttpError(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const record = data as Record<string, unknown>;
  const status = String(record.status ?? "").toLowerCase();
  if (status === "error" || status === "failed") return true;
  if (record.error || record.errorMessage) return true;
  return false;
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    return lower === "true" || lower === "1";
  }
  return false;
}

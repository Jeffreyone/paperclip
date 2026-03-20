export { execute } from "./execute.js";
export { testEnvironment } from "./test.js";
export { parseCursorHttpResponse, isCursorHttpError } from "./parse.js";

import type { AdapterSessionCodec } from "@paperclipai/adapter-utils";

export const sessionCodec: AdapterSessionCodec = {
  deserialize(raw: unknown) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const record = raw as Record<string, unknown>;
    const sessionId =
      typeof record.sessionId === "string" && record.sessionId.trim().length > 0
        ? record.sessionId.trim()
        : typeof record.session_id === "string" && record.session_id.trim().length > 0
          ? record.session_id.trim()
          : null;
    if (!sessionId) return null;
    return { sessionId };
  },
  serialize(params: Record<string, unknown> | null) {
    if (!params) return null;
    const sessionId =
      typeof params.sessionId === "string" && params.sessionId.trim().length > 0
        ? params.sessionId.trim()
        : null;
    if (!sessionId) return null;
    return { sessionId };
  },
  getDisplayId(params: Record<string, unknown> | null) {
    if (!params) return null;
    const sessionId =
      typeof params.sessionId === "string" && params.sessionId.trim().length > 0
        ? params.sessionId.trim()
        : null;
    return sessionId;
  },
};

import { describe, expect, it } from "vitest";
import {
  parseCursorHttpResponse,
  isCursorHttpError,
} from "@paperclipai/adapter-cursor-http/server";

describe("cursor-http parse", () => {
  it("parses successful result", () => {
    const result = parseCursorHttpResponse({
      status: "completed",
      summary: "Fixed the authentication bug",
      usage: { inputTokens: 1000, outputTokens: 500 },
      costUsd: 0.0015,
      sessionId: "cursor-session-123",
      provider: "cursor",
      model: "gpt-5.3-codex",
    });
    expect(result.summary).toBe("Fixed the authentication bug");
    expect(result.sessionId).toBe("cursor-session-123");
    expect(result.usage?.inputTokens).toBe(1000);
    expect(result.usage?.outputTokens).toBe(500);
    expect(result.costUsd).toBe(0.0015);
    expect(result.provider).toBe("cursor");
    expect(result.errorMessage).toBeNull();
  });

  it("parses error result", () => {
    const result = parseCursorHttpResponse({
      status: "error",
      error: "Cursor agent failed: permission denied",
    });
    expect(result.errorMessage).toBe("Cursor agent failed: permission denied");
    expect(result.timedOut).toBeNull();
  });

  it("parses result with nested summary", () => {
    const result = parseCursorHttpResponse({
      result: { text: "Updated the API endpoint" },
    });
    expect(result.summary).toBe("Updated the API endpoint");
  });

  it("handles null input", () => {
    const result = parseCursorHttpResponse(null);
    expect(result.sessionId).toBeNull();
    expect(result.summary).toBeNull();
    expect(result.errorMessage).toBeNull();
  });

  it("detects error status", () => {
    expect(isCursorHttpError({ status: "error" })).toBe(true);
    expect(isCursorHttpError({ status: "failed" })).toBe(true);
    expect(isCursorHttpError({ error: "something went wrong" })).toBe(true);
    expect(isCursorHttpError({})).toBe(false);
    expect(isCursorHttpError(null)).toBe(false);
  });

  it("parses usage with various token field names", () => {
    const result = parseCursorHttpResponse({
      usage: { input_tokens: 2000, output_tokens: 1000, cached_input_tokens: 500 },
    });
    expect(result.usage?.inputTokens).toBe(2000);
    expect(result.usage?.outputTokens).toBe(1000);
    expect(result.usage?.cachedInputTokens).toBe(500);
  });
});

describe("cursor-http session codec", () => {
  it("round-trips session id", async () => {
    const { sessionCodec } = await import("@paperclipai/adapter-cursor-http/server");
    const params = { sessionId: "cursor-http-session-1" };
    const serialized = sessionCodec.serialize(params);
    const deserialized = sessionCodec.deserialize(serialized);
    expect(serialized).toEqual(params);
    expect(deserialized).toEqual(params);
  });

  it("returns null for empty session", async () => {
    const { sessionCodec } = await import("@paperclipai/adapter-cursor-http/server");
    expect(sessionCodec.deserialize(null)).toBeNull();
    expect(sessionCodec.serialize(null)).toBeNull();
    expect(sessionCodec.deserialize({})).toBeNull();
    expect(sessionCodec.serialize({})).toBeNull();
  });

  it("extracts display id", async () => {
    const { sessionCodec } = await import("@paperclipai/adapter-cursor-http/server");
    expect(sessionCodec.getDisplayId?.({ sessionId: "my-session" })).toBe("my-session");
    expect(sessionCodec.getDisplayId?.(null)).toBeNull();
  });
});

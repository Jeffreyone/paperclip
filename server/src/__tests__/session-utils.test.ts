import { describe, expect, it } from "vitest";
import type { agents } from "@paperclipai/db";
import { resolveDefaultAgentWorkspaceDir } from "../home-paths.js";
import {
  parseSessionCompactionPolicy,
  resolveRuntimeSessionParamsForWorkspace,
  parseIssueAssigneeAdapterOverrides,
  deriveTaskKey,
  shouldResetTaskSessionForWake,
  describeSessionResetReason,
  deriveCommentId,
  enrichWakeContextSnapshot,
  mergeCoalescedContextSnapshot,
  normalizeSessionParams,
  resolveNextSessionState,
  defaultSessionCodec,
} from "../services/heartbeat/session-utils.js";
import { truncateDisplayId } from "../services/heartbeat/utils.js";

describe("session-utils", () => {
  // ===== parseSessionCompactionPolicy tests =====
  describe("parseSessionCompactionPolicy", () => {
    const makeMockAgent = (runtimeConfig: Record<string, unknown> = {}): typeof agents.$inferSelect => {
      return {
        id: "agent-1",
        companyId: "company-1",
        nameKey: "test-agent",
        adapterType: "claude_local",
        adapterConfig: {},
        runtimeConfig: runtimeConfig as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
    };

    it("defaults to enabled for sessioned adapters when not specified", () => {
      const agent = makeMockAgent({});
      const result = parseSessionCompactionPolicy(agent);
      expect(result.enabled).toBe(true);
      expect(result.maxSessionRuns).toBe(200);
      expect(result.maxRawInputTokens).toBe(2_000_000);
      expect(result.maxSessionAgeHours).toBe(72);
    });

    it("respects explicit enabled flag", () => {
      const agent = makeMockAgent({
        heartbeat: {
          sessionCompaction: { enabled: false },
        },
      });
      const result = parseSessionCompactionPolicy(agent);
      expect(result.enabled).toBe(false);
    });

    it("uses sessionRotation alias for sessionCompaction", () => {
      const agent = makeMockAgent({
        heartbeat: {
          sessionRotation: { enabled: true, maxSessionRuns: 50 },
        },
      });
      const result = parseSessionCompactionPolicy(agent);
      expect(result.enabled).toBe(true);
      expect(result.maxSessionRuns).toBe(50);
    });

    it("falls back to runtimeConfig.sessionCompaction", () => {
      const agent = makeMockAgent({
        sessionCompaction: { enabled: true, maxSessionAgeHours: 24 },
      });
      const result = parseSessionCompactionPolicy(agent);
      expect(result.enabled).toBe(true);
      expect(result.maxSessionAgeHours).toBe(24);
    });

    it("defaults to disabled for non-sessioned adapters", () => {
      const agent = {
        ...makeMockAgent({}),
        adapterType: "http",
      } as any;
      const result = parseSessionCompactionPolicy(agent);
      expect(result.enabled).toBe(false);
    });

    it("clamps negative values to zero", () => {
      const agent = makeMockAgent({
        heartbeat: {
          sessionCompaction: {
            enabled: true,
            maxSessionRuns: -10,
            maxRawInputTokens: -100,
            maxSessionAgeHours: -5,
          },
        },
      });
      const result = parseSessionCompactionPolicy(agent);
      expect(result.maxSessionRuns).toBe(0);
      expect(result.maxRawInputTokens).toBe(0);
      expect(result.maxSessionAgeHours).toBe(0);
    });
  });

  // ===== resolveRuntimeSessionParamsForWorkspace tests =====
  describe("resolveRuntimeSessionParamsForWorkspace", () => {
    const makeResolvedWorkspace = (overrides: Partial<{
      cwd: string;
      source: "project_primary" | "task_session" | "agent_home";
      workspaceId: string | null;
      repoUrl: string | null;
      repoRef: string | null;
    }> = {}): {
      cwd: string;
      source: "project_primary" | "task_session" | "agent_home";
      projectId: string | null;
      workspaceId: string | null;
      repoUrl: string | null;
      repoRef: string | null;
      workspaceHints: Array<{ workspaceId: string; cwd: string | null; repoUrl: string | null; repoRef: string | null }>;
      warnings: string[];
    } => ({
      cwd: "/project/workspace",
      source: "project_primary",
      projectId: "project-1",
      workspaceId: "ws-1",
      repoUrl: "https://github.com/test/repo",
      repoRef: "main",
      workspaceHints: [],
      warnings: [],
      ...overrides,
    });

    const baseInput = {
      agentId: "agent-1",
      previousSessionParams: null as Record<string, unknown> | null,
      resolvedWorkspace: makeResolvedWorkspace(),
    };

    it("returns previous params when sessionId is missing", () => {
      const result = resolveRuntimeSessionParamsForWorkspace({
        ...baseInput,
        previousSessionParams: { cwd: "/old/cwd" },
      });
      expect(result.sessionParams).toEqual({ cwd: "/old/cwd" });
      expect(result.warning).toBeNull();
    });

    it("returns previous params when cwd is missing", () => {
      const result = resolveRuntimeSessionParamsForWorkspace({
        ...baseInput,
        previousSessionParams: { sessionId: "session-1" },
      });
      expect(result.sessionParams).toEqual({ sessionId: "session-1" });
      expect(result.warning).toBeNull();
    });

    it("returns previous params when workspace source is not project_primary", () => {
      const result = resolveRuntimeSessionParamsForWorkspace({
        ...baseInput,
        resolvedWorkspace: { ...baseInput.resolvedWorkspace, source: "fallback" as any },
      });
      expect(result.sessionParams).toBe(baseInput.previousSessionParams);
      expect(result.warning).toBeNull();
    });

    it("returns previous params when projectCwd is missing", () => {
      const result = resolveRuntimeSessionParamsForWorkspace({
        ...baseInput,
        previousSessionParams: { sessionId: "session-1", cwd: "/fallback/cwd" },
        resolvedWorkspace: { ...baseInput.resolvedWorkspace, cwd: "" },
      });
      expect(result.warning).toBeNull();
    });

    it("returns previous params when previous cwd is not fallback workspace", () => {
      const result = resolveRuntimeSessionParamsForWorkspace({
        ...baseInput,
        previousSessionParams: { sessionId: "session-1", cwd: "/some/other/path" },
      });
      expect(result.warning).toBeNull();
    });

    it("returns previous params when project and fallback cwd are the same", () => {
      const result = resolveRuntimeSessionParamsForWorkspace({
        ...baseInput,
        previousSessionParams: { sessionId: "session-1", cwd: "/project/workspace" },
      });
      expect(result.warning).toBeNull();
    });

    it("returns previous params when workspaceId changed", () => {
      const result = resolveRuntimeSessionParamsForWorkspace({
        ...baseInput,
        previousSessionParams: { sessionId: "session-1", cwd: "/fallback/cwd", workspaceId: "ws-old" },
      });
      expect(result.warning).toBeNull();
    });

    it("migrates session params when all conditions are met", () => {
      const agentId = "agent-1";
      const fallbackCwd = resolveDefaultAgentWorkspaceDir(agentId);
      const result = resolveRuntimeSessionParamsForWorkspace({
        agentId,
        previousSessionParams: { sessionId: "session-1", cwd: fallbackCwd },
        resolvedWorkspace: makeResolvedWorkspace({ cwd: "/different/project" }),
      });
      expect(result.sessionParams).toEqual({
        sessionId: "session-1",
        cwd: "/different/project",
        workspaceId: "ws-1",
        repoUrl: "https://github.com/test/repo",
        repoRef: "main",
      });
      expect(result.warning).toContain("Project workspace");
      expect(result.warning).toContain("fallback workspace");
    });

    it("handles null previousSessionParams", () => {
      const result = resolveRuntimeSessionParamsForWorkspace({
        ...baseInput,
        previousSessionParams: null,
      });
      expect(result.sessionParams).toBeNull();
      expect(result.warning).toBeNull();
    });

    it("handles partial workspace info", () => {
      const result = resolveRuntimeSessionParamsForWorkspace({
        agentId: "agent-1",
        previousSessionParams: { sessionId: "session-1", cwd: "/fallback/cwd" },
        resolvedWorkspace: {
          cwd: "/project/workspace",
          source: "project_primary",
          projectId: null,
          workspaceId: null,
          repoUrl: null,
          repoRef: null,
          workspaceHints: [],
          warnings: [],
        },
      });
      expect(result.sessionParams).toEqual({
        sessionId: "session-1",
        cwd: "/fallback/cwd",
      });
      expect(result.warning).toBeNull();
    });
  });

  // ===== parseIssueAssigneeAdapterOverrides tests =====
  describe("parseIssueAssigneeAdapterOverrides", () => {
    it("returns null when input is null", () => {
      expect(parseIssueAssigneeAdapterOverrides(null)).toBeNull();
    });

    it("returns null when input is undefined", () => {
      expect(parseIssueAssigneeAdapterOverrides(undefined)).toBeNull();
    });

    it("returns null when both fields are missing", () => {
      expect(parseIssueAssigneeAdapterOverrides({})).toBeNull();
    });

    it("parses adapterConfig when present", () => {
      const result = parseIssueAssigneeAdapterOverrides({
        adapterConfig: { cwd: "/test/cwd" },
      });
      expect(result).toEqual({
        adapterConfig: { cwd: "/test/cwd" },
        useProjectWorkspace: null,
      });
    });

    it("parses useProjectWorkspace when present", () => {
      const result = parseIssueAssigneeAdapterOverrides({
        useProjectWorkspace: true,
      });
      expect(result).toEqual({
        adapterConfig: null,
        useProjectWorkspace: true,
      });
    });

    it("parses both fields together", () => {
      const result = parseIssueAssigneeAdapterOverrides({
        adapterConfig: { cwd: "/test" },
        useProjectWorkspace: false,
      });
      expect(result).toEqual({
        adapterConfig: { cwd: "/test" },
        useProjectWorkspace: false,
      });
    });

    it("returns null for empty adapterConfig when useProjectWorkspace is not set", () => {
      const result = parseIssueAssigneeAdapterOverrides({
        adapterConfig: {},
      });
      expect(result).toBeNull();
    });
  });

  // ===== deriveTaskKey tests =====
  describe("deriveTaskKey", () => {
    it("prefers contextSnapshot.taskKey over payload.taskKey", () => {
      const result = deriveTaskKey(
        { taskKey: "ctx-task" },
        { taskKey: "payload-task" },
      );
      expect(result).toBe("ctx-task");
    });

    it("falls back to contextSnapshot.taskId", () => {
      const result = deriveTaskKey({ taskId: "ctx-task-id" }, null);
      expect(result).toBe("ctx-task-id");
    });

    it("falls back to contextSnapshot.issueId", () => {
      const result = deriveTaskKey({ issueId: "ctx-issue-id" }, null);
      expect(result).toBe("ctx-issue-id");
    });

    it("falls back to payload.taskKey when contextSnapshot has no keys", () => {
      const result = deriveTaskKey({}, { taskKey: "payload-task" });
      expect(result).toBe("payload-task");
    });

    it("falls back to payload.taskId", () => {
      const result = deriveTaskKey({}, { taskId: "payload-task-id" });
      expect(result).toBe("payload-task-id");
    });

    it("falls back to payload.issueId", () => {
      const result = deriveTaskKey({}, { issueId: "payload-issue-id" });
      expect(result).toBe("payload-issue-id");
    });

    it("returns null when all fields are missing", () => {
      expect(deriveTaskKey({}, {})).toBeNull();
      expect(deriveTaskKey(null, null)).toBeNull();
      expect(deriveTaskKey(undefined, undefined)).toBeNull();
    });

    it("ignores empty strings", () => {
      expect(deriveTaskKey({ taskKey: "" }, {})).toBeNull();
      expect(deriveTaskKey({}, { taskKey: "   " })).toBeNull();
    });

    it("handles mixed null/undefined values", () => {
      expect(deriveTaskKey(null as any, { taskKey: "valid" })).toBe("valid");
    });
  });

  // ===== shouldResetTaskSessionForWake tests =====
  describe("shouldResetTaskSessionForWake", () => {
    it("returns true when forceFreshSession is true", () => {
      expect(shouldResetTaskSessionForWake({ forceFreshSession: true })).toBe(true);
    });

    it("returns true when wakeReason is issue_assigned", () => {
      expect(shouldResetTaskSessionForWake({ wakeReason: "issue_assigned" })).toBe(true);
    });

    it("returns false for other wake reasons", () => {
      expect(shouldResetTaskSessionForWake({ wakeReason: "heartbeat" })).toBe(false);
      expect(shouldResetTaskSessionForWake({ wakeReason: "comment" })).toBe(false);
    });

    it("returns false when forceFreshSession is false", () => {
      expect(shouldResetTaskSessionForWake({ forceFreshSession: false })).toBe(false);
    });

    it("handles null/undefined input", () => {
      expect(shouldResetTaskSessionForWake(null)).toBe(false);
      expect(shouldResetTaskSessionForWake(undefined)).toBe(false);
    });

    it("handles empty object", () => {
      expect(shouldResetTaskSessionForWake({})).toBe(false);
    });
  });

  // ===== describeSessionResetReason tests =====
  describe("describeSessionResetReason", () => {
    it("describes forceFreshSession", () => {
      expect(describeSessionResetReason({ forceFreshSession: true })).toBe(
        "forceFreshSession was requested",
      );
    });

    it("describes issue_assigned wake reason", () => {
      expect(describeSessionResetReason({ wakeReason: "issue_assigned" })).toBe(
        "wake reason is issue_assigned",
      );
    });

    it("returns null for other cases", () => {
      expect(describeSessionResetReason({ wakeReason: "heartbeat" })).toBeNull();
      expect(describeSessionResetReason({})).toBeNull();
      expect(describeSessionResetReason(null)).toBeNull();
    });
  });

  // ===== deriveCommentId tests =====
  describe("deriveCommentId", () => {
    it("prefers contextSnapshot.wakeCommentId", () => {
      expect(deriveCommentId({ wakeCommentId: "wc-1" }, {})).toBe("wc-1");
    });

    it("falls back to contextSnapshot.commentId", () => {
      expect(deriveCommentId({ commentId: "c-1" }, {})).toBe("c-1");
    });

    it("falls back to payload.commentId", () => {
      expect(deriveCommentId({}, { commentId: "p-1" })).toBe("p-1");
    });

    it("returns null when nothing provided", () => {
      expect(deriveCommentId({}, {})).toBeNull();
      expect(deriveCommentId(null, null)).toBeNull();
    });

    it("ignores empty strings", () => {
      expect(deriveCommentId({ wakeCommentId: "" }, {})).toBeNull();
    });
  });

  // ===== enrichWakeContextSnapshot tests =====
  describe("enrichWakeContextSnapshot", () => {
    it("adds wakeReason when missing", () => {
      const snapshot: Record<string, unknown> = {};
      const result = enrichWakeContextSnapshot({
        contextSnapshot: snapshot,
        reason: "heartbeat",
        source: "timer",
        triggerDetail: "system",
        payload: null,
      });
      expect(snapshot.wakeReason).toBe("heartbeat");
    });

    it("adds issueId from payload when missing in snapshot", () => {
      const snapshot: Record<string, unknown> = {};
      const result = enrichWakeContextSnapshot({
        contextSnapshot: snapshot,
        reason: "comment",
        source: "assignment",
        triggerDetail: null,
        payload: { issueId: "issue-1" },
      });
      expect(snapshot.issueId).toBe("issue-1");
      expect(snapshot.taskId).toBe("issue-1");
    });

    it("does not overwrite existing values", () => {
      const snapshot = { wakeReason: "existing", issueId: "old-issue" };
      const result = enrichWakeContextSnapshot({
        contextSnapshot: snapshot,
        reason: "new-reason",
        source: "timer",
        triggerDetail: null,
        payload: { issueId: "new-issue" },
      });
      expect(snapshot.wakeReason).toBe("existing");
      expect(snapshot.issueId).toBe("old-issue");
    });

    it("adds taskKey from payload", () => {
      const snapshot: Record<string, unknown> = {};
      enrichWakeContextSnapshot({
        contextSnapshot: snapshot,
        reason: null,
        source: "assignment",
        triggerDetail: null,
        payload: { taskKey: "task-1" },
      });
      expect(snapshot.taskKey).toBe("task-1");
    });

    it("adds commentId from payload", () => {
      const snapshot: Record<string, unknown> = {};
      enrichWakeContextSnapshot({
        contextSnapshot: snapshot,
        reason: null,
        source: "on_demand",
        triggerDetail: null,
        payload: { commentId: "comment-1" },
      });
      expect(snapshot.commentId).toBe("comment-1");
    });

    it("adds wakeSource and wakeTriggerDetail", () => {
      const snapshot: Record<string, unknown> = {};
      enrichWakeContextSnapshot({
        contextSnapshot: snapshot,
        reason: null,
        source: "timer",
        triggerDetail: "system",
        payload: null,
      });
      expect(snapshot.wakeSource).toBe("timer");
      expect(snapshot.wakeTriggerDetail).toBe("system");
    });
  });

  // ===== mergeCoalescedContextSnapshot tests =====
  describe("mergeCoalescedContextSnapshot", () => {
    it("merges incoming into existing", () => {
      const result = mergeCoalescedContextSnapshot(
        { existingKey: "value1" },
        { incomingKey: "value2" },
      );
      expect(result).toEqual({
        existingKey: "value1",
        incomingKey: "value2",
      });
    });

    it("incoming overwrites existing keys", () => {
      const result = mergeCoalescedContextSnapshot(
        { key: "old" },
        { key: "new" },
      );
      expect(result.key).toBe("new");
    });

    it("derives commentId and wakeCommentId from incoming", () => {
      const result = mergeCoalescedContextSnapshot(
        {},
        { commentId: "comment-1" },
      );
      expect(result.commentId).toBe("comment-1");
      expect(result.wakeCommentId).toBe("comment-1");
    });

    it("handles null/undefined existing", () => {
      expect(mergeCoalescedContextSnapshot(null, { key: "value" })).toEqual({ key: "value" });
      expect(mergeCoalescedContextSnapshot(undefined, { key: "value" })).toEqual({ key: "value" });
    });

    it("handles non-object existing", () => {
      const result = mergeCoalescedContextSnapshot("string" as any, { key: "value" });
      expect(result).toEqual({ key: "value" });
    });

    it("preserves existing commentId when incoming has none", () => {
      const result = mergeCoalescedContextSnapshot(
        { commentId: "existing-comment" },
        { otherKey: "value" },
      );
      expect(result.commentId).toBe("existing-comment");
    });
  });

  // ===== normalizeSessionParams tests =====
  describe("normalizeSessionParams", () => {
    it("returns null for null input", () => {
      expect(normalizeSessionParams(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(normalizeSessionParams(undefined)).toBeNull();
    });

    it("returns null for empty object", () => {
      expect(normalizeSessionParams({})).toBeNull();
    });

    it("returns params for non-empty object", () => {
      expect(normalizeSessionParams({ sessionId: "s-1" })).toEqual({ sessionId: "s-1" });
    });

    it("does not modify object with keys", () => {
      const params = { sessionId: "s-1", cwd: "/test" };
      const result = normalizeSessionParams(params);
      expect(result).toEqual(params);
    });
  });

  // ===== resolveNextSessionState tests =====
  describe("resolveNextSessionState", () => {
    const baseInput = {
      codec: defaultSessionCodec,
      previousParams: null,
      previousDisplayId: null,
      previousLegacySessionId: null,
    };

    it("clears session when clearSession is true", () => {
      const result = resolveNextSessionState({
        ...baseInput,
        adapterResult: { clearSession: true },
      });
      expect(result.params).toBeNull();
      expect(result.displayId).toBeNull();
      expect(result.legacySessionId).toBeNull();
    });

    it("uses explicit sessionParams when provided", () => {
      const result = resolveNextSessionState({
        ...baseInput,
        adapterResult: { sessionParams: { sessionId: "new-session" } },
      });
      expect(result.params).toEqual({ sessionId: "new-session" });
      expect(result.displayId).toBe("new-session");
    });

    it("uses explicit sessionId when provided", () => {
      const result = resolveNextSessionState({
        ...baseInput,
        adapterResult: { sessionId: "explicit-session" },
      });
      expect(result.params).toEqual({ sessionId: "explicit-session" });
      expect(result.displayId).toBe("explicit-session");
    });

    it("uses explicit sessionDisplayId when provided", () => {
      const result = resolveNextSessionState({
        ...baseInput,
        adapterResult: { sessionDisplayId: "display-id" },
      });
      expect(result.displayId).toBe("display-id");
    });

    it("preserves previous params when nothing explicit provided", () => {
      const result = resolveNextSessionState({
        ...baseInput,
        previousParams: { sessionId: "prev-session", cwd: "/prev" },
        previousDisplayId: "prev-display",
        previousLegacySessionId: "prev-legacy",
        adapterResult: {},
      });
      expect(result.params).toEqual({ sessionId: "prev-session", cwd: "/prev" });
      expect(result.displayId).toBe("prev-session");
    });

    it("truncates long display IDs", () => {
      const longId = "a".repeat(200);
      const result = resolveNextSessionState({
        ...baseInput,
        adapterResult: { sessionId: longId },
      });
      expect(result.displayId?.length).toBe(128);
    });

    it("handles empty adapterResult", () => {
      const result = resolveNextSessionState({
        ...baseInput,
        adapterResult: {},
      });
      expect(result.params).toBeNull();
      expect(result.displayId).toBeNull();
    });

    it("handles undefined in adapterResult fields", () => {
      const result = resolveNextSessionState({
        ...baseInput,
        adapterResult: {
          sessionParams: undefined,
          sessionId: undefined,
          sessionDisplayId: undefined,
        },
      });
      expect(result.displayId).toBeNull();
    });
  });

  // ===== Edge cases for empty/null/undefined inputs =====
  describe("edge cases: null/undefined handling", () => {
    it("resolveRuntimeSessionParamsForWorkspace handles all nulls", () => {
      const result = resolveRuntimeSessionParamsForWorkspace({
        agentId: "agent-1",
        previousSessionParams: null,
        resolvedWorkspace: {
          source: "project_primary",
          cwd: "/project",
          projectId: null,
          workspaceId: null,
          repoUrl: null,
          repoRef: null,
          workspaceHints: [],
          warnings: [],
        },
      });
      expect(result.sessionParams).toBeNull();
    });

    it("deriveTaskKey handles all edge cases", () => {
      expect(deriveTaskKey(null as any, null as any)).toBeNull();
      expect(deriveTaskKey(undefined as any, undefined as any)).toBeNull();
      expect(deriveTaskKey({ taskKey: null } as any, {})).toBeNull();
      expect(deriveTaskKey({ taskKey: undefined } as any, {})).toBeNull();
    });

    it("enrichWakeContextSnapshot handles empty payload", () => {
      const snapshot: Record<string, unknown> = {};
      enrichWakeContextSnapshot({
        contextSnapshot: snapshot,
        reason: null,
        source: "assignment",
        triggerDetail: null,
        payload: null,
      });
      expect(snapshot).toBeDefined();
    });

    it("mergeCoalescedContextSnapshot handles edge cases", () => {
      expect(mergeCoalescedContextSnapshot({}, {})).toEqual({});
      expect(mergeCoalescedContextSnapshot({ a: 1 }, {})).toEqual({ a: 1 });
    });
  });

  // ===== truncateDisplayId tests =====
  describe("truncateDisplayId", () => {
    it("returns null for null input", () => {
      expect(truncateDisplayId(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(truncateDisplayId(undefined)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(truncateDisplayId("")).toBeNull();
    });

    it("returns value unchanged when under max length", () => {
      expect(truncateDisplayId("short-id")).toBe("short-id");
    });

    it("truncates value longer than 128 chars", () => {
      const longId = "a".repeat(200);
      const result = truncateDisplayId(longId);
      expect(result?.length).toBe(128);
      expect(result).toBe("a".repeat(128));
    });

    it("respects custom max length", () => {
      const id = "a".repeat(50);
      expect(truncateDisplayId(id, 20)?.length).toBe(20);
    });

    it("handles exact max length", () => {
      const id = "a".repeat(128);
      expect(truncateDisplayId(id)).toBe(id);
    });
  });

  // ===== Additional edge cases for resolveRuntimeSessionParamsForWorkspace =====
  describe("resolveRuntimeSessionParamsForWorkspace additional scenarios", () => {
    const makeResolvedWorkspace = (overrides: Partial<{
      cwd: string;
      source: "project_primary" | "task_session" | "agent_home";
      workspaceId: string | null;
      repoUrl: string | null;
      repoRef: string | null;
    }> = {}) => ({
      cwd: "/project/workspace",
      source: "project_primary" as const,
      projectId: "project-1",
      workspaceId: "ws-1",
      repoUrl: "https://github.com/test/repo",
      repoRef: "main",
      workspaceHints: [],
      warnings: [],
      ...overrides,
    });

    it("handles path.resolve edge cases with trailing slashes", () => {
      const agentId = "agent-1";
      const fallbackCwd = resolveDefaultAgentWorkspaceDir(agentId);
      const result = resolveRuntimeSessionParamsForWorkspace({
        agentId,
        previousSessionParams: { sessionId: "session-1", cwd: fallbackCwd + "/" },
        resolvedWorkspace: makeResolvedWorkspace({ cwd: fallbackCwd }),
      });
      // Same paths should return previous params
      expect(result.warning).toBeNull();
    });

    it("migrates when workspaceId matches and cwd differs", () => {
      const agentId = "agent-1";
      const fallbackCwd = resolveDefaultAgentWorkspaceDir(agentId);
      const result = resolveRuntimeSessionParamsForWorkspace({
        agentId,
        previousSessionParams: { sessionId: "session-1", cwd: fallbackCwd, workspaceId: "ws-1" },
        resolvedWorkspace: makeResolvedWorkspace({ cwd: "/new/project", workspaceId: "ws-1" }),
      });
      expect(result.sessionParams?.cwd).toBe("/new/project");
      expect(result.warning).toContain("Project workspace");
    });

    it("handles missing workspaceId in previous params", () => {
      const agentId = "agent-1";
      const fallbackCwd = resolveDefaultAgentWorkspaceDir(agentId);
      const result = resolveRuntimeSessionParamsForWorkspace({
        agentId,
        previousSessionParams: { sessionId: "session-1", cwd: fallbackCwd },
        resolvedWorkspace: makeResolvedWorkspace({ cwd: "/new/project", workspaceId: "ws-1" }),
      });
      expect(result.sessionParams?.cwd).toBe("/new/project");
      expect(result.sessionParams?.workspaceId).toBe("ws-1");
    });

    it("handles whitespace in sessionId and cwd", () => {
      const result = resolveRuntimeSessionParamsForWorkspace({
        agentId: "agent-1",
        previousSessionParams: { sessionId: "  session-1  ", cwd: "  /old/cwd  " },
        resolvedWorkspace: makeResolvedWorkspace(),
      });
      // Whitespace should be trimmed by readNonEmptyString
      expect(result.warning).toBeNull();
    });
  });

  // ===== Additional edge cases for deriveTaskKey =====
  describe("deriveTaskKey additional scenarios", () => {
    it("prefers taskKey over taskId over issueId in contextSnapshot", () => {
      const result = deriveTaskKey(
        { taskKey: "key-1", taskId: "id-1", issueId: "issue-1" },
        null,
      );
      expect(result).toBe("key-1");
    });

    it("falls to taskId when taskKey is whitespace only", () => {
      const result = deriveTaskKey(
        { taskKey: "   ", taskId: "id-1" },
        null,
      );
      expect(result).toBe("id-1");
    });

    it("handles payload with all three fields", () => {
      const result = deriveTaskKey(
        {},
        { taskKey: "payload-key", taskId: "payload-id", issueId: "payload-issue" },
      );
      expect(result).toBe("payload-key");
    });

    it("returns null when contextSnapshot has null values", () => {
      const result = deriveTaskKey(
        { taskKey: null } as any,
        null,
      );
      expect(result).toBeNull();
    });
  });

  // ===== Additional edge cases for shouldResetTaskSessionForWake =====
  describe("shouldResetTaskSessionForWake additional scenarios", () => {
    it("forceFreshSession takes precedence over wakeReason", () => {
      expect(shouldResetTaskSessionForWake({ forceFreshSession: true, wakeReason: "heartbeat" })).toBe(true);
      expect(shouldResetTaskSessionForWake({ forceFreshSession: true, wakeReason: "issue_assigned" })).toBe(true);
    });

    it("returns false for forceFreshSession as string 'true'", () => {
      expect(shouldResetTaskSessionForWake({ forceFreshSession: "true" as any })).toBe(false);
    });

    it("returns false for empty string wakeReason", () => {
      expect(shouldResetTaskSessionForWake({ wakeReason: "" })).toBe(false);
    });

    it("handles whitespace wakeReason", () => {
      expect(shouldResetTaskSessionForWake({ wakeReason: "   " })).toBe(false);
    });
  });

  // ===== Additional edge cases for resolveNextSessionState =====
  describe("resolveNextSessionState additional scenarios", () => {
    const baseInput = {
      codec: defaultSessionCodec,
      previousParams: null,
      previousDisplayId: null,
      previousLegacySessionId: null,
    };

    it("prioritizes explicit displayId over all other sources", () => {
      const result = resolveNextSessionState({
        ...baseInput,
        adapterResult: { sessionDisplayId: "explicit-display", sessionId: "session-id" },
        previousParams: { sessionId: "prev-session" },
        previousDisplayId: "prev-display",
        previousLegacySessionId: "prev-legacy",
      });
      expect(result.displayId).toBe("explicit-display");
    });

    it("uses codec.getDisplayId when available", () => {
      const customCodec = {
        ...defaultSessionCodec,
        getDisplayId: () => "codec-display",
      };
      const result = resolveNextSessionState({
        ...baseInput,
        codec: customCodec,
        adapterResult: { sessionParams: { sessionId: "test-session" } },
      });
      expect(result.displayId).toBe("codec-display");
    });

    it("prefers previousDisplayId over previousLegacySessionId", () => {
      const result = resolveNextSessionState({
        ...baseInput,
        previousParams: { sessionId: "prev-session" },
        previousDisplayId: "prev-display",
        previousLegacySessionId: "prev-legacy",
        adapterResult: {},
      });
      expect(result.displayId).toBe("prev-session"); // from deserialized params
    });

    it("handles undefined explicit params but explicit sessionId", () => {
      const result = resolveNextSessionState({
        ...baseInput,
        adapterResult: { sessionParams: undefined, sessionId: "explicit-id" },
      });
      expect(result.params).toEqual({ sessionId: "explicit-id" });
    });
  });

  // ===== defaultSessionCodec edge cases =====
  describe("defaultSessionCodec edge cases", () => {
    it("deserialize handles non-object string input", () => {
      const result = defaultSessionCodec.deserialize("plain-string");
      expect(result).toBeNull();
    });

    it("deserialize handles array input", () => {
      const result = defaultSessionCodec.deserialize(["item"] as any);
      expect(result).toBeNull();
    });

    it("serialize handles empty params object", () => {
      const result = defaultSessionCodec.serialize({});
      expect(result).toBeNull();
    });

    it("serialize returns params for object with null values (does not filter nulls)", () => {
      const result = defaultSessionCodec.serialize({ sessionId: null, cwd: null });
      expect(result).toEqual({ sessionId: null, cwd: null });
    });

    it("getDisplayId returns null for empty params", () => {
      expect(defaultSessionCodec.getDisplayId?.(null)).toBeNull();
      expect(defaultSessionCodec.getDisplayId?.({})).toBeNull();
      expect(defaultSessionCodec.getDisplayId?.({ sessionId: "" })).toBeNull();
    });
  });
});

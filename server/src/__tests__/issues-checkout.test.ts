import { describe, expect, it, vi } from "vitest";
import { issueService, deriveIssueUserContext } from "../services/issues.ts";

vi.mock("@paperclipai/db", async () => {
  const actual = await vi.importActual("@paperclipai/db");
  return {
    ...actual as any,
    companies: { $inferSelect: { id: "", issueCounter: 1, issuePrefix: "TEST" } },
    goals: {},
    projects: {},
    labels: {},
    issueLabels: {},
    heartbeatRuns: {},
  };
});

describe("deriveIssueUserContext", () => {
  it("正确计算未读状态", () => {
    const now = new Date();
    const issue = {
      createdByUserId: "user-1",
      assigneeUserId: "user-1",
      createdAt: new Date(now.getTime() - 3600000),
      updatedAt: new Date(now.getTime() - 1800000),
    };

    const stats = {
      myLastCommentAt: new Date(now.getTime() - 900000),
      myLastReadAt: new Date(now.getTime() - 2700000),
      lastExternalCommentAt: new Date(now.getTime() - 600000),
    };

    const result = deriveIssueUserContext(issue, "user-1", stats);
    expect(result.isUnreadForMe).toBe(true);
    expect(result.lastExternalCommentAt).toEqual(stats.lastExternalCommentAt);
  });

  it("当没有新评论时 isUnreadForMe 为 false", () => {
    const now = new Date();
    const issue = {
      createdByUserId: "user-1",
      assigneeUserId: "user-1",
      createdAt: new Date(now.getTime() - 3600000),
      updatedAt: new Date(now.getTime() - 1800000),
    };

    const stats = {
      myLastCommentAt: new Date(now.getTime() - 900000),
      myLastReadAt: new Date(now.getTime() - 600000),
      lastExternalCommentAt: new Date(now.getTime() - 1200000),
    };

    const result = deriveIssueUserContext(issue, "user-1", stats);
    expect(result.isUnreadForMe).toBe(false);
  });

  it("处理 null stats", () => {
    const issue = {
      createdByUserId: "user-1",
      assigneeUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = deriveIssueUserContext(issue, "user-1", null);
    expect(result.isUnreadForMe).toBe(false);
  });

  it("处理 undefined stats", () => {
    const issue = {
      createdByUserId: "user-1",
      assigneeUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = deriveIssueUserContext(issue, "user-1", undefined);
    expect(result.isUnreadForMe).toBe(false);
  });
});

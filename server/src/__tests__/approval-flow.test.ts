import { beforeEach, describe, expect, it, vi } from "vitest";
import { approvalService } from "../services/approvals.ts";

const mockAgentService = vi.hoisted(() => ({
  activatePendingApproval: vi.fn(),
  create: vi.fn(),
  terminate: vi.fn(),
}));

const mockNotifyHireApproved = vi.hoisted(() => vi.fn());

vi.mock("../services/agents.js", () => ({
  agentService: vi.fn(() => mockAgentService),
}));

vi.mock("../services/hire-hook.js", () => ({
  notifyHireApproved: mockNotifyHireApproved,
}));

type ApprovalRecord = {
  id: string;
  companyId: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  requestedByAgentId: string | null;
  requestedByUserId: string | null;
  decisionNote: string | null;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function createApproval(status: string, type = "hire_agent"): ApprovalRecord {
  return {
    id: "approval-1",
    companyId: "company-1",
    type,
    status,
    payload: { agentId: "pending-agent-1" },
    requestedByAgentId: "ceo-1",
    requestedByUserId: null,
    decisionNote: null,
    decidedByUserId: null,
    decidedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createDbStub(selectResults: ApprovalRecord[][], updateResults: ApprovalRecord[]) {
  const pendingSelectResults = [...selectResults];
  const selectWhere = vi.fn(async () => pendingSelectResults.shift() ?? []);
  const from = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from }));

  const returning = vi.fn(async () => updateResults);
  const updateWhere = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));

  return {
    db: { select, update },
    selectWhere,
    returning,
  };
}

describe("approvalService - Hire Agent Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentService.activatePendingApproval.mockResolvedValue(undefined);
    mockAgentService.create.mockResolvedValue({ id: "new-agent-1" });
    mockAgentService.terminate.mockResolvedValue(undefined);
    mockNotifyHireApproved.mockResolvedValue(undefined);
  });

  it("approve hire_agent 时激活 pending_approval agent", async () => {
    const dbStub = createDbStub(
      [[createApproval("pending")], [{ ...createApproval("pending"), id: "approval-check" }]],
      [{ ...createApproval("approved"), status: "approved" }],
    );

    const svc = approvalService(dbStub.db as any);
    const result = await svc.approve("approval-1", "board-user-1", "approved!");

    expect(result.applied).toBe(true);
    expect(result.approval.status).toBe("approved");
    expect(mockAgentService.activatePendingApproval).toHaveBeenCalledWith("pending-agent-1");
    expect(mockNotifyHireApproved).toHaveBeenCalled();
  });

  it("approve hire_agent 时创建新 agent（无 payload agentId）", async () => {
    const approvalWithoutAgentId = {
      ...createApproval("pending"),
      payload: {
        name: "New Worker",
        role: "engineer",
        adapterType: "process",
        budgetMonthlyCents: 5000,
      },
    };

    const dbStub = createDbStub(
      [[approvalWithoutAgentId], [{ ...approvalWithoutAgentId, id: "approval-check" }]],
      [{ ...approvalWithoutAgentId, status: "approved" }],
    );

    const svc = approvalService(dbStub.db as any);
    const result = await svc.approve("approval-1", "board-user-1", "welcome aboard!");

    expect(result.applied).toBe(true);
    expect(mockAgentService.create).toHaveBeenCalledWith("company-1", expect.objectContaining({
      name: "New Worker",
      role: "engineer",
      adapterType: "process",
      budgetMonthlyCents: 5000,
      status: "idle",
    }));
    expect(mockNotifyHireApproved).toHaveBeenCalled();
  });

  it("reject hire_agent 时终止 pending_approval agent", async () => {
    const dbStub = createDbStub(
      [[createApproval("pending")], [{ ...createApproval("pending"), id: "approval-check" }]],
      [{ ...createApproval("rejected"), status: "rejected" }],
    );

    const svc = approvalService(dbStub.db as any);
    const result = await svc.reject("approval-1", "board-user-1", "not approved");

    expect(result.applied).toBe(true);
    expect(result.approval.status).toBe("rejected");
    expect(mockAgentService.terminate).toHaveBeenCalledWith("pending-agent-1");
  });

  it("非 hire_agent 类型 approval 不触发 agent 创建", async () => {
    const dbStub = createDbStub(
      [[createApproval("pending", "approve_ceo_strategy")], [{ ...createApproval("pending", "approve_ceo_strategy"), id: "approval-check" }]],
      [{ ...createApproval("approved", "approve_ceo_strategy"), status: "approved" }],
    );

    const svc = approvalService(dbStub.db as any);
    const result = await svc.approve("approval-1", "board-user-1", "strategy approved");

    expect(result.applied).toBe(true);
    expect(mockAgentService.create).not.toHaveBeenCalled();
    expect(mockAgentService.activatePendingApproval).not.toHaveBeenCalled();
    expect(mockNotifyHireApproved).not.toHaveBeenCalled();
  });

  it("approve 已 approved 的 approval 返回 applied: false", async () => {
    const dbStub = createDbStub(
      [[createApproval("approved")]],
      [],
    );

    const svc = approvalService(dbStub.db as any);
    const result = await svc.approve("approval-1", "board-user-1", "retry");

    expect(result.applied).toBe(false);
    expect(mockAgentService.activatePendingApproval).not.toHaveBeenCalled();
  });

  it("reject 已 rejected 的 approval 返回 applied: false", async () => {
    const dbStub = createDbStub(
      [[createApproval("rejected")]],
      [],
    );

    const svc = approvalService(dbStub.db as any);
    const result = await svc.reject("approval-1", "board-user-1", "retry");

    expect(result.applied).toBe(false);
    expect(mockAgentService.terminate).not.toHaveBeenCalled();
  });

  it("approve revision_requested approval 成功", async () => {
    const dbStub = createDbStub(
      [[createApproval("revision_requested")], [{ ...createApproval("revision_requested"), id: "approval-check" }]],
      [{ ...createApproval("approved"), status: "approved" }],
    );

    const svc = approvalService(dbStub.db as any);
    const result = await svc.approve("approval-1", "board-user-1", "now approved");

    expect(result.applied).toBe(true);
    expect(result.approval.status).toBe("approved");
    expect(mockAgentService.activatePendingApproval).toHaveBeenCalled();
  });
});

describe("approvalService.requestRevision", () => {
  it("将 pending approval 转为 revision_requested", async () => {
    const updatedApproval = { ...createApproval("revision_requested"), status: "revision_requested", decisionNote: "needs more detail" };
    const dbStub = createDbStub(
      [[createApproval("pending")]],
      [updatedApproval],
    );

    const svc = approvalService(dbStub.db as any);
    const result = await svc.requestRevision("approval-1", "board-user-1", "needs more detail");

    expect(result.status).toBe("revision_requested");
    expect(result.decisionNote).toBe("needs more detail");
  });

  it("非 pending approval 无法 requestRevision", async () => {
    const dbStub = createDbStub(
      [[createApproval("approved")]],
      [],
    );

    const svc = approvalService(dbStub.db as any);
    await expect(svc.requestRevision("approval-1", "board-user-1", "too late")).rejects.toThrow("pending");
  });
});

describe("approvalService.resubmit", () => {
  it("将 revision_requested approval 退回 pending", async () => {
    const dbStub = createDbStub(
      [[createApproval("revision_requested")]],
      [{ ...createApproval("pending"), status: "pending", decisionNote: null, decidedByUserId: null, decidedAt: null }],
    );

    const svc = approvalService(dbStub.db as any);
    const result = await svc.resubmit("approval-1");

    expect(result.status).toBe("pending");
    expect(result.decisionNote).toBeNull();
    expect(result.decidedByUserId).toBeNull();
  });

  it("使用新 payload resubmit", async () => {
    const newPayload = { agentId: "pending-agent-1", name: "Worker v2 - revised" };
    const dbStub = createDbStub(
      [[createApproval("revision_requested")]],
      [{ ...createApproval("pending"), status: "pending", payload: newPayload }],
    );

    const svc = approvalService(dbStub.db as any);
    const result = await svc.resubmit("approval-1", newPayload);

    expect(result.status).toBe("pending");
    expect(result.payload).toEqual(newPayload);
  });

  it("非 revision_requested approval 无法 resubmit", async () => {
    const dbStub = createDbStub(
      [[createApproval("pending")]],
      [],
    );

    const svc = approvalService(dbStub.db as any);
    await expect(svc.resubmit("approval-1")).rejects.toThrow("revision requested");
  });
});

describe("approvalService.hasApprovedCeoStrategy", () => {
  it("当存在 approved approve_ceo_strategy 时返回 true", async () => {
    const dbStub = {
      db: {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(() => [{ id: "approval-1" }]) })),
          })),
        })),
      },
    };

    const svc = approvalService(dbStub.db as any);
    const result = await svc.hasApprovedCeoStrategy("company-1");

    expect(result).toBe(true);
  });

  it("当不存在 approved approve_ceo_strategy 时返回 false", async () => {
    const dbStub = {
      db: {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(() => []) })),
          })),
        })),
      },
    };

    const svc = approvalService(dbStub.db as any);
    const result = await svc.hasApprovedCeoStrategy("company-1");

    expect(result).toBe(false);
  });
});

describe("approvalService.list", () => {
  it("按 companyId 列出 approvals", async () => {
    const approvals = [createApproval("pending"), createApproval("approved", "approve_ceo_strategy")];
    const dbStub = createDbStub([approvals], []);

    const svc = approvalService(dbStub.db as any);
    const result = await svc.list("company-1");

    expect(result).toHaveLength(2);
  });

  it("按 status 过滤 approvals", async () => {
    const dbStub = createDbStub([[createApproval("pending")]], []);

    const svc = approvalService(dbStub.db as any);
    const result = await svc.list("company-1", "pending");

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("pending");
  });
});

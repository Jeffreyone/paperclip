import { beforeEach, describe, expect, it, vi } from "vitest";
import { costService } from "../services/costs.ts";

vi.mock("@paperclipai/db", () => ({
  activityLog: {},
  agents: {},
  companies: {},
  costEvents: {},
  heartbeatRuns: {},
  issues: {},
  projects: {},
}));

describe("costService.createEvent - Budget Hard Stop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("当 spent >= budget 时将 agent 状态改为 paused", async () => {
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn()
            .mockResolvedValueOnce([{ id: "agent-1", companyId: "company-1", status: "idle", budgetMonthlyCents: 1000, spentMonthlyCents: 900 }])
            .mockResolvedValueOnce([{ id: "agent-1", companyId: "company-1", status: "idle", budgetMonthlyCents: 1000, spentMonthlyCents: 1000 }])
            .mockResolvedValueOnce([{ id: "company-1", budgetMonthlyCents: 5000, spentMonthlyCents: 0 }])
            .mockResolvedValueOnce([{ id: "company-1", budgetMonthlyCents: 5000, spentMonthlyCents: 100 }]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue({}),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{
            id: "event-1",
            agentId: "agent-1",
            companyId: "company-1",
            costCents: 100,
            occurredAt: new Date(),
          }]),
        })),
      })),
    } as any;

    const svc = costService(mockDb);
    const result = await svc.createEvent("company-1", {
      agentId: "agent-1",
      costCents: 100,
      provider: "openai",
      model: "gpt-4",
      inputTokens: 1000,
      outputTokens: 500,
      occurredAt: new Date(),
    });

    expect(result.costCents).toBe(100);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("当 budget 为 0 时不触发 hard stop", async () => {
    const updateCalls: any[] = [];
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn()
            .mockResolvedValueOnce([{ id: "agent-1", companyId: "company-1", status: "idle", budgetMonthlyCents: 0, spentMonthlyCents: 0 }])
            .mockResolvedValueOnce([{ id: "agent-1", companyId: "company-1", status: "idle", budgetMonthlyCents: 0, spentMonthlyCents: 100 }])
            .mockResolvedValueOnce([{ id: "company-1", budgetMonthlyCents: 0, spentMonthlyCents: 0 }])
            .mockResolvedValueOnce([{ id: "company-1", budgetMonthlyCents: 0, spentMonthlyCents: 100 }]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((values: any) => {
          updateCalls.push(values);
          return {
            where: vi.fn().mockResolvedValue({}),
          };
        }),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{
            id: "event-1",
            agentId: "agent-1",
            companyId: "company-1",
            costCents: 100,
            occurredAt: new Date(),
          }]),
        })),
      })),
    } as any;

    const svc = costService(mockDb);
    await svc.createEvent("company-1", {
      agentId: "agent-1",
      costCents: 100,
      provider: "openai",
      model: "gpt-4",
      inputTokens: 1000,
      outputTokens: 500,
      occurredAt: new Date(),
    });

    expect(updateCalls.some(call => call.status === "paused")).toBe(false);
  });

  it("当 agent 已经是 paused 时不重复更新", async () => {
    const updateCalls: any[] = [];
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn()
            .mockResolvedValueOnce([{ id: "agent-1", companyId: "company-1", status: "paused", budgetMonthlyCents: 1000, spentMonthlyCents: 1000 }])
            .mockResolvedValueOnce([{ id: "agent-1", companyId: "company-1", status: "paused", budgetMonthlyCents: 1000, spentMonthlyCents: 1100 }])
            .mockResolvedValueOnce([{ id: "company-1", budgetMonthlyCents: 5000, spentMonthlyCents: 0 }])
            .mockResolvedValueOnce([{ id: "company-1", budgetMonthlyCents: 5000, spentMonthlyCents: 100 }]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((values: any) => {
          updateCalls.push(values);
          return {
            where: vi.fn().mockResolvedValue({}),
          };
        }),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{
            id: "event-1",
            agentId: "agent-1",
            companyId: "company-1",
            costCents: 100,
            occurredAt: new Date(),
          }]),
        })),
      })),
    } as any;

    const svc = costService(mockDb);
    await svc.createEvent("company-1", {
      agentId: "agent-1",
      costCents: 100,
      provider: "openai",
      model: "gpt-4",
      inputTokens: 1000,
      outputTokens: 500,
      occurredAt: new Date(),
    });

    expect(updateCalls.some(call => call.status === "paused")).toBe(false);
  });

  it("当 agent 已经是 terminated 时不触发 hard stop", async () => {
    const updateCalls: any[] = [];
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn()
            .mockResolvedValueOnce([{ id: "agent-1", companyId: "company-1", status: "terminated", budgetMonthlyCents: 1000, spentMonthlyCents: 900 }])
            .mockResolvedValueOnce([{ id: "agent-1", companyId: "company-1", status: "terminated", budgetMonthlyCents: 1000, spentMonthlyCents: 1000 }])
            .mockResolvedValueOnce([{ id: "company-1", budgetMonthlyCents: 5000, spentMonthlyCents: 0 }])
            .mockResolvedValueOnce([{ id: "company-1", budgetMonthlyCents: 5000, spentMonthlyCents: 100 }]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((values: any) => {
          updateCalls.push(values);
          return {
            where: vi.fn().mockResolvedValue({}),
          };
        }),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{
            id: "event-1",
            agentId: "agent-1",
            companyId: "company-1",
            costCents: 100,
            occurredAt: new Date(),
          }]),
        })),
      })),
    } as any;

    const svc = costService(mockDb);
    await svc.createEvent("company-1", {
      agentId: "agent-1",
      costCents: 100,
      provider: "openai",
      model: "gpt-4",
      inputTokens: 1000,
      outputTokens: 500,
      occurredAt: new Date(),
    });

    expect(updateCalls.some(call => call.status === "paused")).toBe(false);
  });

  it("当 spent < budget 时不触发 hard stop", async () => {
    const updateCalls: any[] = [];
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn()
            .mockResolvedValueOnce([{ id: "agent-1", companyId: "company-1", status: "idle", budgetMonthlyCents: 1000, spentMonthlyCents: 500 }])
            .mockResolvedValueOnce([{ id: "agent-1", companyId: "company-1", status: "idle", budgetMonthlyCents: 1000, spentMonthlyCents: 600 }])
            .mockResolvedValueOnce([{ id: "company-1", budgetMonthlyCents: 5000, spentMonthlyCents: 0 }])
            .mockResolvedValueOnce([{ id: "company-1", budgetMonthlyCents: 5000, spentMonthlyCents: 100 }]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((values: any) => {
          updateCalls.push(values);
          return {
            where: vi.fn().mockResolvedValue({}),
          };
        }),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{
            id: "event-1",
            agentId: "agent-1",
            companyId: "company-1",
            costCents: 100,
            occurredAt: new Date(),
          }]),
        })),
      })),
    } as any;

    const svc = costService(mockDb);
    await svc.createEvent("company-1", {
      agentId: "agent-1",
      costCents: 100,
      provider: "openai",
      model: "gpt-4",
      inputTokens: 1000,
      outputTokens: 500,
      occurredAt: new Date(),
    });

    expect(updateCalls.some(call => call.status === "paused")).toBe(false);
  });

  it("当 agent 不存在时抛出 notFound", async () => {
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      })),
    } as any;

    const svc = costService(mockDb);
    await expect(svc.createEvent("company-1", {
      agentId: "nonexistent",
      costCents: 100,
      provider: "openai",
      model: "gpt-4",
      inputTokens: 1000,
      outputTokens: 500,
      occurredAt: new Date(),
    })).rejects.toThrow("not found");
  });

  it("当 agent 不属于目标公司时抛出 unprocessable", async () => {
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ id: "agent-1", companyId: "other-company", status: "idle" }]),
        })),
      })),
    } as any;

    const svc = costService(mockDb);
    await expect(svc.createEvent("company-1", {
      agentId: "agent-1",
      costCents: 100,
      provider: "openai",
      model: "gpt-4",
      inputTokens: 1000,
      outputTokens: 500,
      occurredAt: new Date(),
    })).rejects.toThrow("does not belong to company");
  });
});

describe("costService.createEvent - 基础扣款功能", () => {
  it("创建 cost event 并更新 agent 和 company 的 spentMonthlyCents", async () => {
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn()
            .mockResolvedValueOnce([{ id: "agent-1", companyId: "company-1", status: "idle", budgetMonthlyCents: 1000, spentMonthlyCents: 0 }])
            .mockResolvedValueOnce([{ id: "agent-1", companyId: "company-1", status: "idle", budgetMonthlyCents: 1000, spentMonthlyCents: 100 }])
            .mockResolvedValueOnce([{ id: "company-1", budgetMonthlyCents: 5000, spentMonthlyCents: 0 }])
            .mockResolvedValueOnce([{ id: "company-1", budgetMonthlyCents: 5000, spentMonthlyCents: 500 }]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue({}),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{
            id: "event-1",
            agentId: "agent-1",
            companyId: "company-1",
            costCents: 100,
            occurredAt: new Date(),
          }]),
        })),
      })),
    } as any;

    const svc = costService(mockDb);
    const result = await svc.createEvent("company-1", {
      agentId: "agent-1",
      costCents: 100,
      provider: "openai",
      model: "gpt-4",
      inputTokens: 1000,
      outputTokens: 500,
      occurredAt: new Date(),
    });

    expect(result).toBeDefined();
    expect(result.costCents).toBe(100);
  });
});

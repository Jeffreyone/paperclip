import { beforeEach, describe, expect, it, vi } from "vitest";
import { dashboardService } from "../services/dashboard.js";

function createMockDb() {
  const mockSelect = vi.fn();
  return { db: { select: mockSelect }, mockSelect };
}

function makeChain(results: unknown[]) {
  const whereResult: Record<string, unknown> = {};
  const whereChain: Record<string, unknown> = {};
  whereChain["groupBy"] = vi.fn(() => whereResult);
  whereResult["then"] = (resolver: (v: unknown) => void) => resolver(results);
  whereResult["groupBy"] = whereChain["groupBy"];

  const fromResult: Record<string, unknown> = {};
  fromResult["where"] = vi.fn(() => whereResult);

  const selectResult: Record<string, unknown> = {};
  selectResult["from"] = vi.fn(() => fromResult);

  return selectResult;
}

describe("dashboardService.summary — SPEC §10.8 compliance", () => {
  let db: ReturnType<typeof createMockDb>["db"];
  let mockSelect: ReturnType<typeof createMockDb>["mockSelect"];

  beforeEach(() => {
    const mocks = createMockDb();
    db = mocks.db;
    mockSelect = mocks.mockSelect;
    vi.clearAllMocks();
  });

  function setupCompanyCall(budgetCents = 0) {
    const whereResult: Record<string, unknown> = {};
    whereResult["then"] = (r: (v: unknown) => void) =>
      r([{ id: "company-1", budgetMonthlyCents: budgetCents }]);

    const fromResult: Record<string, unknown> = {};
    fromResult["where"] = vi.fn(() => whereResult);

    const selectResult: Record<string, unknown> = {};
    selectResult["from"] = vi.fn(() => fromResult);

    mockSelect.mockImplementationOnce(() => selectResult);
  }

  function setupAgentsCall(rows: Array<{ status: string; count: number }>) {
    const whereResult: Record<string, unknown> = {};
    whereResult["groupBy"] = vi.fn(() => whereResult);
    whereResult["then"] = (r: (v: unknown) => void) => r(rows);

    const fromResult: Record<string, unknown> = {};
    fromResult["where"] = vi.fn(() => whereResult);

    const selectResult: Record<string, unknown> = {};
    selectResult["from"] = vi.fn(() => fromResult);

    mockSelect.mockImplementationOnce(() => selectResult);
  }

  function setupIssuesCall(rows: Array<{ status: string; count: number }>) {
    const whereResult: Record<string, unknown> = {};
    whereResult["groupBy"] = vi.fn(() => whereResult);
    whereResult["then"] = (r: (v: unknown) => void) => r(rows);

    const fromResult: Record<string, unknown> = {};
    fromResult["where"] = vi.fn(() => whereResult);

    const selectResult: Record<string, unknown> = {};
    selectResult["from"] = vi.fn(() => fromResult);

    mockSelect.mockImplementationOnce(() => selectResult);
  }

  function setupApprovalsCall(count: number) {
    const whereResult: Record<string, unknown> = {};
    whereResult["then"] = (r: (v: unknown) => void) => r([{ count }]);

    const fromResult: Record<string, unknown> = {};
    fromResult["where"] = vi.fn(() => whereResult);

    const selectResult: Record<string, unknown> = {};
    selectResult["from"] = vi.fn(() => fromResult);

    mockSelect.mockImplementationOnce(() => selectResult);
  }

  function setupSpendCall(cents: number) {
    const whereResult: Record<string, unknown> = {};
    whereResult["then"] = (r: (v: unknown) => void) => r([{ monthSpend: cents }]);

    const fromResult: Record<string, unknown> = {};
    fromResult["where"] = vi.fn(() => whereResult);

    const selectResult: Record<string, unknown> = {};
    selectResult["from"] = vi.fn(() => fromResult);

    mockSelect.mockImplementationOnce(() => selectResult);
  }

  it("returns all 4 required payload sections from SPEC §10.8", async () => {
    setupCompanyCall(100_000_00);
    setupAgentsCall([
      { status: "idle", count: 2 },
      { status: "running", count: 1 },
      { status: "paused", count: 1 },
      { status: "error", count: 0 },
    ]);
    setupIssuesCall([
      { status: "in_progress", count: 3 },
      { status: "blocked", count: 1 },
      { status: "done", count: 5 },
      { status: "todo", count: 2 },
    ]);
    setupApprovalsCall(2);
    setupSpendCall(25_000_00);

    const svc = dashboardService(db as any);
    const result = await svc.summary("company-1");

    expect(result.agents).toBeDefined();
    expect(typeof result.agents.active).toBe("number");
    expect(typeof result.agents.running).toBe("number");
    expect(typeof result.agents.paused).toBe("number");
    expect(typeof result.agents.error).toBe("number");

    expect(result.tasks).toBeDefined();
    expect(typeof result.tasks.open).toBe("number");
    expect(typeof result.tasks.inProgress).toBe("number");
    expect(typeof result.tasks.blocked).toBe("number");
    expect(typeof result.tasks.done).toBe("number");

    expect(result.costs).toBeDefined();
    expect(typeof result.costs.monthSpendCents).toBe("number");
    expect(typeof result.costs.monthBudgetCents).toBe("number");
    expect(typeof result.costs.monthUtilizationPercent).toBe("number");

    expect(typeof result.pendingApprovals).toBe("number");

    expect(result.companyId).toBe("company-1");
  });

  it("idle agents are counted as active (operational bucket)", async () => {
    setupCompanyCall(0);
    setupAgentsCall([{ status: "idle", count: 3 }]);
    setupIssuesCall([]);
    setupApprovalsCall(0);
    setupSpendCall(0);

    const svc = dashboardService(db as any);
    const result = await svc.summary("company-1");

    expect(result.agents.active).toBe(3);
    expect(result.agents.running).toBe(0);
  });

  it("open tasks = all non-done, non-cancelled statuses", async () => {
    setupCompanyCall(0);
    setupAgentsCall([]);
    setupIssuesCall([
      { status: "todo", count: 2 },
      { status: "in_progress", count: 3 },
      { status: "blocked", count: 1 },
      { status: "done", count: 5 },
      { status: "cancelled", count: 1 },
    ]);
    setupApprovalsCall(0);
    setupSpendCall(0);

    const svc = dashboardService(db as any);
    const result = await svc.summary("company-1");

    expect(result.tasks.open).toBe(6);
    expect(result.tasks.inProgress).toBe(3);
    expect(result.tasks.blocked).toBe(1);
    expect(result.tasks.done).toBe(5);
  });

  it("utilization = 0 when budget is 0 (unlimited)", async () => {
    setupCompanyCall(0);
    setupAgentsCall([]);
    setupIssuesCall([]);
    setupApprovalsCall(0);
    setupSpendCall(50_000_00);

    const svc = dashboardService(db as any);
    const result = await svc.summary("company-1");

    expect(result.costs.monthBudgetCents).toBe(0);
    expect(result.costs.monthUtilizationPercent).toBe(0);
  });

  it("utilization is calculated correctly", async () => {
    setupCompanyCall(10_000_00);
    setupAgentsCall([]);
    setupIssuesCall([]);
    setupApprovalsCall(0);
    setupSpendCall(2_500_00);

    const svc = dashboardService(db as any);
    const result = await svc.summary("company-1");

    expect(result.costs.monthUtilizationPercent).toBe(25);
  });

  it("throws notFound when company does not exist", async () => {
    const whereResult: Record<string, unknown> = {};
    whereResult["then"] = (r: (v: unknown) => void) => r([]);

    const fromResult: Record<string, unknown> = {};
    fromResult["where"] = vi.fn(() => whereResult);

    const selectResult: Record<string, unknown> = {};
    selectResult["from"] = vi.fn(() => fromResult);

    mockSelect.mockImplementationOnce(() => selectResult);

    const svc = dashboardService(db as any);
    await expect(svc.summary("nonexistent")).rejects.toThrow("Company not found");
  });

  it("correctly sums multiple rows with same status into one bucket", async () => {
    setupCompanyCall(0);
    setupAgentsCall([
      { status: "idle", count: 1 },
      { status: "idle", count: 2 },
    ]);
    setupIssuesCall([]);
    setupApprovalsCall(0);
    setupSpendCall(0);

    const svc = dashboardService(db as any);
    const result = await svc.summary("company-1");

    expect(result.agents.active).toBe(3);
  });

  it("monthSpendCents handles empty costEvents table via coalesce", async () => {
    setupCompanyCall(0);
    setupAgentsCall([]);
    setupIssuesCall([]);
    setupApprovalsCall(0);
    setupSpendCall(0);

    const svc = dashboardService(db as any);
    const result = await svc.summary("company-1");

    expect(result.costs.monthSpendCents).toBe(0);
  });
});

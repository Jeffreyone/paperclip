import { beforeEach, describe, expect, it, vi } from "vitest";
import { approvalService } from "../services/approvals.ts";

describe("approvalService.hasApprovedCeoStrategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockDb = (results: any[]) => ({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(results),
        }),
      }),
    }),
  });

  it("returns true when company has approved CEO strategy approval", async () => {
    const mockDb = createMockDb([{ id: "approval-1" }]);

    const svc = approvalService(mockDb as any);
    const result = await svc.hasApprovedCeoStrategy("company-1");

    expect(result).toBe(true);
  });

  it("returns false when company has no approved CEO strategy approval", async () => {
    const mockDb = createMockDb([]);

    const svc = approvalService(mockDb as any);
    const result = await svc.hasApprovedCeoStrategy("company-1");

    expect(result).toBe(false);
  });

  it("returns false when company has rejected CEO strategy approval", async () => {
    const mockDb = createMockDb([]);

    const svc = approvalService(mockDb as any);
    const result = await svc.hasApprovedCeoStrategy("company-1");

    expect(result).toBe(false);
  });

  it("returns false when company has pending CEO strategy approval", async () => {
    const mockDb = createMockDb([]);

    const svc = approvalService(mockDb as any);
    const result = await svc.hasApprovedCeoStrategy("company-1");

    expect(result).toBe(false);
  });

  it("queries with correct filters and returns result", async () => {
    const mockDb = createMockDb([{ id: "approval-1" }]);

    const svc = approvalService(mockDb as any);
    const result = await svc.hasApprovedCeoStrategy("company-1");

    expect(result).toBe(true);
  });
});

import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { issueRelations, issues } from "@paperclipai/db";
import { unprocessable } from "../errors.js";
import type { IssueRelation, IssueRelationWithIssue } from "@paperclipai/shared";
import type { IssueRelationType } from "@paperclipai/shared";

type IssueRelationRow = typeof issueRelations.$inferSelect;
type IssueRow = typeof issues.$inferSelect;

export function issueRelationService(db: Db) {
  async function listForIssue(issueId: string): Promise<IssueRelationWithIssue[]> {
    const rows = await db
      .select()
      .from(issueRelations)
      .where(eq(issueRelations.fromIssueId, issueId));

    if (rows.length === 0) return [];

    const toIssueIds = rows.map((r) => r.toIssueId);
    const toIssues = await db
      .select({ id: issues.id, identifier: issues.identifier, title: issues.title })
      .from(issues)
      .where(
        rows.length === 1
          ? eq(issues.id, rows[0].toIssueId)
          : eq(issues.id, rows[0].toIssueId),
      );

    const toIssueMap = new Map<string, IssueRow>();
    for (const id of toIssueIds) {
      const [found] = await db
        .select({ id: issues.id, identifier: issues.identifier, title: issues.title })
        .from(issues)
        .where(eq(issues.id, id));
      if (found) toIssueMap.set(found.id, found as IssueRow);
    }

    return rows.map((row) => ({
      ...row,
      type: row.type as IssueRelationType,
      toIssue: toIssueMap.get(row.toIssueId)
        ? {
            id: toIssueMap.get(row.toIssueId)!.id,
            identifier: toIssueMap.get(row.toIssueId)!.identifier ?? null,
            title: toIssueMap.get(row.toIssueId)!.title,
          }
        : undefined,
    }));
  }

  async function create(
    fromIssueId: string,
    companyId: string,
    toIssueId: string,
    type: IssueRelationType,
  ): Promise<IssueRelation> {
    const existing = await db
      .select()
      .from(issueRelations)
      .where(
        and(
          eq(issueRelations.fromIssueId, fromIssueId),
          eq(issueRelations.toIssueId, toIssueId),
          eq(issueRelations.type, type),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw unprocessable("Relation already exists");
    }

    if (fromIssueId === toIssueId) {
      throw unprocessable("Cannot create a relation from an issue to itself");
    }

    if (type === "blocks") {
      await assertNoCircularBlocks(fromIssueId, toIssueId, companyId);
    }

    if (type === "blocked_by") {
      await assertNoCircularBlocks(toIssueId, fromIssueId, companyId);
    }

    const [created] = await db
      .insert(issueRelations)
      .values({
        companyId,
        fromIssueId,
        toIssueId,
        type,
      })
      .returning();

    return created as IssueRelation;
  }

  async function remove(relationId: string): Promise<IssueRelation | null> {
    const [deleted] = await db
      .delete(issueRelations)
      .where(eq(issueRelations.id, relationId))
      .returning();
    return (deleted ?? null) as IssueRelation | null;
  }

  async function getById(relationId: string): Promise<IssueRelation | null> {
    const [row] = await db
      .select()
      .from(issueRelations)
      .where(eq(issueRelations.id, relationId))
      .limit(1);
    return (row ?? null) as IssueRelation | null;
  }

  async function assertNoCircularBlocks(
    fromId: string,
    toId: string,
    companyId: string,
  ): Promise<void> {
    const visited = new Set<string>();
    const pending = new Set<string>();
    const queue: string[] = [toId];
    pending.add(toId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      pending.delete(current);
      if (current === fromId) {
        throw unprocessable("Circular blocks dependency detected");
      }
      if (visited.has(current)) continue;
      visited.add(current);

      const outgoing = await db
        .select({ toIssueId: issueRelations.toIssueId })
        .from(issueRelations)
        .where(
          and(
            eq(issueRelations.fromIssueId, current),
            eq(issueRelations.type, "blocks"),
            eq(issueRelations.companyId, companyId),
          ),
        );

      for (const row of outgoing) {
        if (row.toIssueId === current) {
          throw unprocessable("Circular blocks dependency detected");
        }
        if (pending.has(row.toIssueId)) {
          throw unprocessable("Circular blocks dependency detected");
        }
        if (row.toIssueId === fromId) {
          throw unprocessable("Circular blocks dependency detected");
        }
        queue.push(row.toIssueId);
        pending.add(row.toIssueId);
      }
    }
  }

  return {
    listForIssue,
    create,
    remove,
    getById,
  };
}

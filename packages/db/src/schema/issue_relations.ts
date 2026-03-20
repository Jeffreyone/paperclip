import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";

export const issueRelations = pgTable(
  "issue_relations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    fromIssueId: uuid("from_issue_id").notNull().references(() => issues.id),
    toIssueId: uuid("to_issue_id").notNull().references(() => issues.id),
    type: text("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    fromIssueIdx: index("issue_relations_from_issue_idx").on(table.fromIssueId),
    toIssueIdx: index("issue_relations_to_issue_idx").on(table.toIssueId),
    typeIdx: index("issue_relations_type_idx").on(table.type),
    fromToTypeUniq: uniqueIndex("issue_relations_from_to-type_uniq").on(
      table.fromIssueId,
      table.toIssueId,
      table.type,
    ),
  }),
);

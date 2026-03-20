import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { plugins } from "./plugins.js";

/**
 * `plugin_config_revisions` table — immutable audit trail of plugin config changes.
 *
 * Every config write creates a new revision row, enabling rollback to any
 * previous configuration state. The `revision_number` is monotonically
 * increasing per plugin (enforced by unique index).
 *
 * `changed_by_user_id` and `changed_by_agent_id` are nullable UUID fields
 * referencing the actor who made the change. The FK is not enforced at the DB
 * level because `authUsers.id` is text (Auth.js compatibility); type safety
 * is maintained at the application/TypeScript layer.
 *
 * @see doc/design/plugin-sandbox-hardening.md §4.1.2
 * @see PLUGIN_SPEC.md §21.3
 */
export const pluginConfigRevisions = pgTable(
  "plugin_config_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** FK to the owning plugin. Cascades on delete. */
    pluginId: uuid("plugin_id")
      .notNull()
      .references(() => plugins.id, { onDelete: "cascade" }),
    /** Monotonically increasing revision number, unique per plugin. */
    revisionNumber: integer("revision_number").notNull(),
    /** Snapshot of the full config at this revision. */
    configJson: jsonb("config_json").$type<Record<string, unknown>>().notNull(),
    /** Human-readable summary of what changed (e.g. "added webhook URL"). */
    changeSummary: text("change_summary"),
    /** User who made this change (null when changed by an agent or system). */
    changedByUserId: uuid("changed_by_user_id"),
    /** Agent who made this change (null when changed by a user or system). */
    changedByAgentId: uuid("changed_by_agent_id"),
    /** When this revision was created. */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /** One revision number per plugin — enforces monotonic increment. */
    uniqueRevisionIdx: uniqueIndex("plugin_config_revisions_plugin_id_revision_idx").on(
      table.pluginId,
      table.revisionNumber,
    ),
    /** Speed up "list revisions for plugin" queries. */
    pluginCreatedIdx: index("plugin_config_revisions_plugin_created_idx").on(
      table.pluginId,
      table.createdAt,
    ),
  }),
);

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import type { PaperclipPluginManifestV1 } from "@paperclipai/shared";
import { plugins } from "./plugins.js";

/**
 * `plugin_versions` table — version history for installed plugins.
 *
 * Tracks every version a plugin has been installed at, supporting
 * rollback to any previous version without losing the package or
 * manifest snapshot.
 *
 * The `is_active` flag marks the currently running version.
 * Only one row per plugin can be `is_active = true` at a time.
 *
 * @see doc/design/plugin-sandbox-hardening.md §4.1.1
 * @see PLUGIN_SPEC.md §21.3
 */
export const pluginVersions = pgTable(
  "plugin_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** FK to the owning plugin. Cascades on delete. */
    pluginId: uuid("plugin_id")
      .notNull()
      .references(() => plugins.id, { onDelete: "cascade" }),
    /** Semver version string (e.g. "1.2.0"). */
    version: text("version").notNull(),
    /**
     * Absolute filesystem path where this version's package is installed.
     * Used by downgrade to locate the package directory.
     */
    packagePath: text("package_path").notNull(),
    /** Full manifest snapshot at install/upgrade time. */
    manifestJson: jsonb("manifest_json").$type<PaperclipPluginManifestV1>().notNull(),
    /** When this version was first installed. */
    installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
    /** When this version was superseded (null if still active or never activated). */
    uninstalledAt: timestamp("uninstalled_at", { withTimezone: true }),
    /** Reason for uninstalling this version (e.g. "upgraded", "manual_downgrade"). */
    uninstallReason: text("uninstall_reason"),
    /**
     * Whether this is the currently active version.
     * Exactly one row per plugin should have `is_active = true`.
     */
    isActive: boolean("is_active").notNull().default(false),
  },
  (table) => ({
    /**
     * Enforce one version per plugin + version combination.
     */
    uniqueVersionIdx: uniqueIndex("plugin_versions_plugin_id_version_idx").on(
      table.pluginId,
      table.version,
    ),
    /**
     * Speed up "find active version" queries.
     */
    activeIdx: index("plugin_versions_active_idx").on(table.pluginId, table.isActive),
  }),
);

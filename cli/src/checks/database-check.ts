import fs from "node:fs";
import type { PaperclipConfig } from "../config/schema.js";
import type { CheckResult } from "./index.js";
import { resolveRuntimeLikePath } from "./path-resolver.js";

export async function databaseCheck(config: PaperclipConfig, configPath?: string): Promise<CheckResult> {
  if (config.database.mode === "postgres") {
    if (!config.database.connectionString) {
      return {
        name: "数据库",
        status: "fail",
        message: "已选择 PostgreSQL 模式但未配置连接字符串",
        canRepair: false,
        repairHint: "运行 `paperclipai configure --section database`",
      };
    }

    try {
      const { createDb } = await import("@paperclipai/db");
      const db = createDb(config.database.connectionString);
      await db.execute("SELECT 1");
      return {
        name: "数据库",
        status: "pass",
        message: "PostgreSQL 连接成功",
      };
    } catch (err) {
      return {
        name: "数据库",
        status: "fail",
        message: `无法连接到 PostgreSQL：${err instanceof Error ? err.message : String(err)}`,
        canRepair: false,
        repairHint: "检查连接字符串并确保 PostgreSQL 正在运行",
      };
    }
  }

  if (config.database.mode === "embedded-postgres") {
    const dataDir = resolveRuntimeLikePath(config.database.embeddedPostgresDataDir, configPath);
    const reportedPath = dataDir;
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(reportedPath, { recursive: true });
    }

    return {
      name: "数据库",
      status: "pass",
      message: `嵌入式 PostgreSQL 已配置：${dataDir}（端口 ${config.database.embeddedPostgresPort}）`,
    };
  }

  return {
    name: "数据库",
    status: "fail",
    message: `未知的数据库模式：${String(config.database.mode)}`,
    canRepair: false,
    repairHint: "运行 `paperclipai configure --section database`",
  };
}

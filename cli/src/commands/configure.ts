import * as p from "@clack/prompts";
import pc from "picocolors";
import { readConfig, writeConfig, configExists, resolveConfigPath } from "../config/store.js";
import type { PaperclipConfig } from "../config/schema.js";
import { ensureLocalSecretsKeyFile } from "../config/secrets-key.js";
import { promptDatabase } from "../prompts/database.js";
import { promptLlm } from "../prompts/llm.js";
import { promptLogging } from "../prompts/logging.js";
import { defaultSecretsConfig, promptSecrets } from "../prompts/secrets.js";
import { defaultStorageConfig, promptStorage } from "../prompts/storage.js";
import { promptServer } from "../prompts/server.js";
import {
  resolveDefaultBackupDir,
  resolveDefaultEmbeddedPostgresDir,
  resolveDefaultLogsDir,
  resolvePaperclipInstanceId,
} from "../config/home.js";
import { printPaperclipCliBanner } from "../utils/banner.js";

type Section = "llm" | "database" | "logging" | "server" | "storage" | "secrets";

const SECTION_LABELS: Record<Section, string> = {
  llm: "LLM 提供商",
  database: "数据库",
  logging: "日志",
  server: "服务器",
  storage: "存储",
  secrets: "密钥",
};

function defaultConfig(): PaperclipConfig {
  const instanceId = resolvePaperclipInstanceId();
  return {
    $meta: {
      version: 1,
      updatedAt: new Date().toISOString(),
      source: "configure",
    },
    database: {
      mode: "embedded-postgres",
      embeddedPostgresDataDir: resolveDefaultEmbeddedPostgresDir(instanceId),
      embeddedPostgresPort: 54329,
      backup: {
        enabled: true,
        intervalMinutes: 60,
        retentionDays: 30,
        dir: resolveDefaultBackupDir(instanceId),
      },
    },
    logging: {
      mode: "file",
      logDir: resolveDefaultLogsDir(instanceId),
    },
    server: {
      deploymentMode: "local_trusted",
      exposure: "private",
      host: "127.0.0.1",
      port: 3100,
      allowedHostnames: [],
      serveUi: true,
    },
    auth: {
      baseUrlMode: "auto",
      disableSignUp: false,
    },
    storage: defaultStorageConfig(),
    secrets: defaultSecretsConfig(),
  };
}

export async function configure(opts: {
  config?: string;
  section?: string;
}): Promise<void> {
  printPaperclipCliBanner();
  p.intro(pc.bgCyan(pc.black(" paperclip configure ")));
  const configPath = resolveConfigPath(opts.config);

  if (!configExists(opts.config)) {
    p.log.error("未找到配置文件。请先运行 `paperclipai onboard`。");
    p.outro("");
    return;
  }

  let config: PaperclipConfig;
  try {
    config = readConfig(opts.config) ?? defaultConfig();
  } catch (err) {
    p.log.message(
      pc.yellow(
        `现有配置无效。加载默认配置以便您可以修复。\n${err instanceof Error ? err.message : String(err)}`,
      ),
    );
    config = defaultConfig();
  }

  let section: Section | undefined = opts.section as Section | undefined;

  if (section && !SECTION_LABELS[section]) {
    p.log.error(`未知配置节：${section}。可选值：${Object.keys(SECTION_LABELS).join(", ")}`);
    p.outro("");
    return;
  }

  // Section selection loop
  let continueLoop = true;
  while (continueLoop) {
    if (!section) {
      const choice = await p.select({
        message: "请选择要配置的部分：",
        options: Object.entries(SECTION_LABELS).map(([value, label]) => ({
          value: value as Section,
          label,
        })),
      });

      if (p.isCancel(choice)) {
        p.cancel("配置已取消。");
        return;
      }

      section = choice;
    }

    p.log.step(pc.bold(SECTION_LABELS[section]));

    switch (section) {
      case "database":
        config.database = await promptDatabase(config.database);
        break;
      case "llm": {
        const llm = await promptLlm();
        if (llm) {
          config.llm = llm;
        } else {
          delete config.llm;
        }
        break;
      }
      case "logging":
        config.logging = await promptLogging();
        break;
      case "server":
        {
          const { server, auth } = await promptServer({
            currentServer: config.server,
            currentAuth: config.auth,
          });
          config.server = server;
          config.auth = auth;
        }
        break;
      case "storage":
        config.storage = await promptStorage(config.storage);
        break;
      case "secrets":
        config.secrets = await promptSecrets(config.secrets);
        {
          const keyResult = ensureLocalSecretsKeyFile(config, configPath);
          if (keyResult.status === "created") {
            p.log.success(`已创建本地密钥文件：${pc.dim(keyResult.path)}`);
          } else if (keyResult.status === "existing") {
            p.log.message(pc.dim(`使用现有本地密钥文件：${keyResult.path}`));
          } else if (keyResult.status === "skipped_provider") {
            p.log.message(pc.dim("跳过本地密钥文件管理（非本地提供商）"));
          } else {
            p.log.message(pc.dim("跳过本地密钥文件管理（已设置 PAPERCLIP_SECRETS_MASTER_KEY）"));
          }
        }
        break;
    }

    config.$meta.updatedAt = new Date().toISOString();
    config.$meta.source = "configure";

    writeConfig(config, opts.config);
    p.log.success(`${SECTION_LABELS[section]} 配置已更新。`);

    // If section was provided via CLI flag, don't loop
    if (opts.section) {
      continueLoop = false;
    } else {
      const another = await p.confirm({
        message: "是否配置其他部分？",
        initialValue: false,
      });

      if (p.isCancel(another) || !another) {
        continueLoop = false;
      } else {
        section = undefined; // Reset to show picker again
      }
    }
  }

  p.outro("配置已保存。");
}

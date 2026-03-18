import * as p from "@clack/prompts";
import path from "node:path";
import pc from "picocolors";
import {
  AUTH_BASE_URL_MODES,
  DEPLOYMENT_EXPOSURES,
  DEPLOYMENT_MODES,
  SECRET_PROVIDERS,
  STORAGE_PROVIDERS,
  type AuthBaseUrlMode,
  type DeploymentExposure,
  type DeploymentMode,
  type SecretProvider,
  type StorageProvider,
} from "@paperclipai/shared";
import { configExists, readConfig, resolveConfigPath, writeConfig } from "../config/store.js";
import type { PaperclipConfig } from "../config/schema.js";
import { ensureAgentJwtSecret, resolveAgentJwtEnvFile } from "../config/env.js";
import { ensureLocalSecretsKeyFile } from "../config/secrets-key.js";
import { promptDatabase } from "../prompts/database.js";
import { promptLlm } from "../prompts/llm.js";
import { promptLogging } from "../prompts/logging.js";
import { defaultSecretsConfig } from "../prompts/secrets.js";
import { defaultStorageConfig, promptStorage } from "../prompts/storage.js";
import { promptServer } from "../prompts/server.js";
import {
  describeLocalInstancePaths,
  expandHomePrefix,
  resolveDefaultBackupDir,
  resolveDefaultEmbeddedPostgresDir,
  resolveDefaultLogsDir,
  resolvePaperclipInstanceId,
} from "../config/home.js";
import { bootstrapCeoInvite } from "./auth-bootstrap-ceo.js";
import { printPaperclipCliBanner } from "../utils/banner.js";

type SetupMode = "quickstart" | "advanced";

type OnboardOptions = {
  config?: string;
  run?: boolean;
  yes?: boolean;
  invokedByRun?: boolean;
};

type OnboardDefaults = Pick<PaperclipConfig, "database" | "logging" | "server" | "auth" | "storage" | "secrets">;

const ONBOARD_ENV_KEYS = [
  "PAPERCLIP_PUBLIC_URL",
  "DATABASE_URL",
  "PAPERCLIP_DB_BACKUP_ENABLED",
  "PAPERCLIP_DB_BACKUP_INTERVAL_MINUTES",
  "PAPERCLIP_DB_BACKUP_RETENTION_DAYS",
  "PAPERCLIP_DB_BACKUP_DIR",
  "PAPERCLIP_DEPLOYMENT_MODE",
  "PAPERCLIP_DEPLOYMENT_EXPOSURE",
  "HOST",
  "PORT",
  "SERVE_UI",
  "PAPERCLIP_ALLOWED_HOSTNAMES",
  "PAPERCLIP_AUTH_BASE_URL_MODE",
  "PAPERCLIP_AUTH_PUBLIC_BASE_URL",
  "BETTER_AUTH_URL",
  "BETTER_AUTH_BASE_URL",
  "PAPERCLIP_STORAGE_PROVIDER",
  "PAPERCLIP_STORAGE_LOCAL_DIR",
  "PAPERCLIP_STORAGE_S3_BUCKET",
  "PAPERCLIP_STORAGE_S3_REGION",
  "PAPERCLIP_STORAGE_S3_ENDPOINT",
  "PAPERCLIP_STORAGE_S3_PREFIX",
  "PAPERCLIP_STORAGE_S3_FORCE_PATH_STYLE",
  "PAPERCLIP_SECRETS_PROVIDER",
  "PAPERCLIP_SECRETS_STRICT_MODE",
  "PAPERCLIP_SECRETS_MASTER_KEY_FILE",
] as const;

function parseBooleanFromEnv(rawValue: string | undefined): boolean | null {
  if (rawValue === undefined) return null;
  const lower = rawValue.trim().toLowerCase();
  if (lower === "true" || lower === "1" || lower === "yes") return true;
  if (lower === "false" || lower === "0" || lower === "no") return false;
  return null;
}

function parseNumberFromEnv(rawValue: string | undefined): number | null {
  if (!rawValue) return null;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function parseEnumFromEnv<T extends string>(rawValue: string | undefined, allowedValues: readonly T[]): T | null {
  if (!rawValue) return null;
  return allowedValues.includes(rawValue as T) ? (rawValue as T) : null;
}

function resolvePathFromEnv(rawValue: string | undefined): string | null {
  if (!rawValue || rawValue.trim().length === 0) return null;
  return path.resolve(expandHomePrefix(rawValue.trim()));
}

function quickstartDefaultsFromEnv(): {
  defaults: OnboardDefaults;
  usedEnvKeys: string[];
  ignoredEnvKeys: Array<{ key: string; reason: string }>;
} {
  const instanceId = resolvePaperclipInstanceId();
  const defaultStorage = defaultStorageConfig();
  const defaultSecrets = defaultSecretsConfig();
  const databaseUrl = process.env.DATABASE_URL?.trim() || undefined;
  const publicUrl =
    process.env.PAPERCLIP_PUBLIC_URL?.trim() ||
    process.env.PAPERCLIP_AUTH_PUBLIC_BASE_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.BETTER_AUTH_BASE_URL?.trim() ||
    undefined;
  const deploymentMode =
    parseEnumFromEnv<DeploymentMode>(process.env.PAPERCLIP_DEPLOYMENT_MODE, DEPLOYMENT_MODES) ?? "local_trusted";
  const deploymentExposureFromEnv = parseEnumFromEnv<DeploymentExposure>(
    process.env.PAPERCLIP_DEPLOYMENT_EXPOSURE,
    DEPLOYMENT_EXPOSURES,
  );
  const deploymentExposure =
    deploymentMode === "local_trusted" ? "private" : (deploymentExposureFromEnv ?? "private");
  const authPublicBaseUrl = publicUrl;
  const authBaseUrlModeFromEnv = parseEnumFromEnv<AuthBaseUrlMode>(
    process.env.PAPERCLIP_AUTH_BASE_URL_MODE,
    AUTH_BASE_URL_MODES,
  );
  const authBaseUrlMode = authBaseUrlModeFromEnv ?? (authPublicBaseUrl ? "explicit" : "auto");
  const allowedHostnamesFromEnv = process.env.PAPERCLIP_ALLOWED_HOSTNAMES
    ? process.env.PAPERCLIP_ALLOWED_HOSTNAMES
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0)
    : [];
  const hostnameFromPublicUrl = publicUrl
    ? (() => {
      try {
        return new URL(publicUrl).hostname.trim().toLowerCase();
      } catch {
        return null;
      }
    })()
    : null;
  const storageProvider =
    parseEnumFromEnv<StorageProvider>(process.env.PAPERCLIP_STORAGE_PROVIDER, STORAGE_PROVIDERS) ??
    defaultStorage.provider;
  const secretsProvider =
    parseEnumFromEnv<SecretProvider>(process.env.PAPERCLIP_SECRETS_PROVIDER, SECRET_PROVIDERS) ??
    defaultSecrets.provider;
  const databaseBackupEnabled = parseBooleanFromEnv(process.env.PAPERCLIP_DB_BACKUP_ENABLED) ?? true;
  const databaseBackupIntervalMinutes = Math.max(
    1,
    parseNumberFromEnv(process.env.PAPERCLIP_DB_BACKUP_INTERVAL_MINUTES) ?? 60,
  );
  const databaseBackupRetentionDays = Math.max(
    1,
    parseNumberFromEnv(process.env.PAPERCLIP_DB_BACKUP_RETENTION_DAYS) ?? 30,
  );
  const defaults: OnboardDefaults = {
    database: {
      mode: databaseUrl ? "postgres" : "embedded-postgres",
      ...(databaseUrl ? { connectionString: databaseUrl } : {}),
      embeddedPostgresDataDir: resolveDefaultEmbeddedPostgresDir(instanceId),
      embeddedPostgresPort: 54329,
      backup: {
        enabled: databaseBackupEnabled,
        intervalMinutes: databaseBackupIntervalMinutes,
        retentionDays: databaseBackupRetentionDays,
        dir: resolvePathFromEnv(process.env.PAPERCLIP_DB_BACKUP_DIR) ?? resolveDefaultBackupDir(instanceId),
      },
    },
    logging: {
      mode: "file",
      logDir: resolveDefaultLogsDir(instanceId),
    },
    server: {
      deploymentMode,
      exposure: deploymentExposure,
      host: process.env.HOST ?? "127.0.0.1",
      port: Number(process.env.PORT) || 3100,
      allowedHostnames: Array.from(new Set([...allowedHostnamesFromEnv, ...(hostnameFromPublicUrl ? [hostnameFromPublicUrl] : [])])),
      serveUi: parseBooleanFromEnv(process.env.SERVE_UI) ?? true,
    },
    auth: {
      baseUrlMode: authBaseUrlMode,
      disableSignUp: false,
      ...(authPublicBaseUrl ? { publicBaseUrl: authPublicBaseUrl } : {}),
    },
    storage: {
      provider: storageProvider,
      localDisk: {
        baseDir:
          resolvePathFromEnv(process.env.PAPERCLIP_STORAGE_LOCAL_DIR) ?? defaultStorage.localDisk.baseDir,
      },
      s3: {
        bucket: process.env.PAPERCLIP_STORAGE_S3_BUCKET ?? defaultStorage.s3.bucket,
        region: process.env.PAPERCLIP_STORAGE_S3_REGION ?? defaultStorage.s3.region,
        endpoint: process.env.PAPERCLIP_STORAGE_S3_ENDPOINT ?? defaultStorage.s3.endpoint,
        prefix: process.env.PAPERCLIP_STORAGE_S3_PREFIX ?? defaultStorage.s3.prefix,
        forcePathStyle:
          parseBooleanFromEnv(process.env.PAPERCLIP_STORAGE_S3_FORCE_PATH_STYLE) ??
          defaultStorage.s3.forcePathStyle,
      },
    },
    secrets: {
      provider: secretsProvider,
      strictMode: parseBooleanFromEnv(process.env.PAPERCLIP_SECRETS_STRICT_MODE) ?? defaultSecrets.strictMode,
      localEncrypted: {
        keyFilePath:
          resolvePathFromEnv(process.env.PAPERCLIP_SECRETS_MASTER_KEY_FILE) ??
          defaultSecrets.localEncrypted.keyFilePath,
      },
    },
  };
  const ignoredEnvKeys: Array<{ key: string; reason: string }> = [];
  if (deploymentMode === "local_trusted" && process.env.PAPERCLIP_DEPLOYMENT_EXPOSURE !== undefined) {
    ignoredEnvKeys.push({
      key: "PAPERCLIP_DEPLOYMENT_EXPOSURE",
      reason: "由于部署模式 local_trusted 始终强制使用私有暴露，已忽略",
    });
  }

  const ignoredKeySet = new Set(ignoredEnvKeys.map((entry) => entry.key));
  const usedEnvKeys = ONBOARD_ENV_KEYS.filter(
    (key) => process.env[key] !== undefined && !ignoredKeySet.has(key),
  );
  return { defaults, usedEnvKeys, ignoredEnvKeys };
}

function canCreateBootstrapInviteImmediately(config: Pick<PaperclipConfig, "database" | "server">): boolean {
  return config.server.deploymentMode === "authenticated" && config.database.mode !== "embedded-postgres";
}

export async function onboard(opts: OnboardOptions): Promise<void> {
  printPaperclipCliBanner();
  p.intro(pc.bgCyan(pc.black(" paperclipai onboard ")));
  const configPath = resolveConfigPath(opts.config);
  const instance = describeLocalInstancePaths(resolvePaperclipInstanceId());
  p.log.message(
    pc.dim(
      `Local home: ${instance.homeDir} | instance: ${instance.instanceId} | config: ${configPath}`,
    ),
  );

  if (configExists(opts.config)) {
    p.log.message(pc.dim(`${configPath} exists, updating config`));

    try {
      readConfig(opts.config);
    } catch (err) {
      p.log.message(
        pc.yellow(
          `Existing config appears invalid and will be updated.\n${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
  }

  let setupMode: SetupMode = "quickstart";
  if (opts.yes) {
    p.log.message(pc.dim("已启用 `--yes`：使用快速默认配置。"));
  } else {
    const setupModeChoice = await p.select({
      message: "选择安装方式",
      options: [
        {
          value: "quickstart" as const,
          label: "快速安装",
          hint: "推荐：本地默认配置，立即可用",
        },
        {
          value: "advanced" as const,
          label: "高级配置",
          hint: "自定义数据库、服务器、存储等",
        },
      ],
      initialValue: "quickstart",
    });
    if (p.isCancel(setupModeChoice)) {
      p.cancel("安装已取消。");
      return;
    }
    setupMode = setupModeChoice as SetupMode;
  }

  let llm: PaperclipConfig["llm"] | undefined;
  const { defaults: derivedDefaults, usedEnvKeys, ignoredEnvKeys } = quickstartDefaultsFromEnv();
  let {
    database,
    logging,
    server,
    auth,
    storage,
    secrets,
  } = derivedDefaults;

  if (setupMode === "advanced") {
    p.log.step(pc.bold("数据库"));
    database = await promptDatabase(database);

    if (database.mode === "postgres" && database.connectionString) {
      const s = p.spinner();
      s.start("正在测试数据库连接...");
      try {
        const { createDb } = await import("@paperclipai/db");
        const db = createDb(database.connectionString);
        await db.execute("SELECT 1");
        s.stop("数据库连接成功");
      } catch {
        s.stop(pc.yellow("无法连接到数据库 — 您可以稍后使用 `paperclipai doctor` 修复"));
      }
    }

    p.log.step(pc.bold("LLM 提供商"));
    llm = await promptLlm();

    if (llm?.apiKey) {
      const s = p.spinner();
      s.start("正在验证 API 密钥...");
      try {
        if (llm.provider === "claude") {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": llm.apiKey,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-5-20250929",
              max_tokens: 1,
              messages: [{ role: "user", content: "hi" }],
            }),
          });
          if (res.ok || res.status === 400) {
            s.stop("API 密钥有效");
          } else if (res.status === 401) {
            s.stop(pc.yellow("API 密钥可能无效 — 您可以稍后更新"));
          } else {
            s.stop(pc.yellow("无法验证 API 密钥 — 继续安装"));
          }
        } else {
          const res = await fetch("https://api.openai.com/v1/models", {
            headers: { Authorization: `Bearer ${llm.apiKey}` },
          });
          if (res.ok) {
            s.stop("API 密钥有效");
          } else if (res.status === 401) {
            s.stop(pc.yellow("API 密钥可能无效 — 您可以稍后更新"));
          } else {
            s.stop(pc.yellow("无法验证 API 密钥 — 继续安装"));
          }
        }
      } catch {
        s.stop(pc.yellow("无法连接到 API — 继续安装"));
      }
    }

    p.log.step(pc.bold("日志"));
    logging = await promptLogging();

    p.log.step(pc.bold("服务器"));
    ({ server, auth } = await promptServer({ currentServer: server, currentAuth: auth }));

    p.log.step(pc.bold("存储"));
    storage = await promptStorage(storage);

    p.log.step(pc.bold("密钥"));
    const secretsDefaults = defaultSecretsConfig();
    secrets = {
      provider: secrets.provider ?? secretsDefaults.provider,
      strictMode: secrets.strictMode ?? secretsDefaults.strictMode,
      localEncrypted: {
        keyFilePath: secrets.localEncrypted?.keyFilePath ?? secretsDefaults.localEncrypted.keyFilePath,
      },
    };
    p.log.message(
      pc.dim(
        `使用默认配置：provider=${secrets.provider}, strictMode=${secrets.strictMode}, keyFile=${secrets.localEncrypted.keyFilePath}`,
      ),
    );
  } else {
    p.log.step(pc.bold("快速安装"));
    p.log.message(pc.dim("使用快速安装默认配置。"));
    if (usedEnvKeys.length > 0) {
      p.log.message(pc.dim(`已检测到环境变量覆盖（${usedEnvKeys.length} 个环境变量）。`));
    } else {
      p.log.message(
        pc.dim("未检测到环境变量覆盖：使用嵌入式数据库、文件存储、本地加密密钥。"),
      );
    }
    for (const ignored of ignoredEnvKeys) {
      p.log.message(pc.dim(`已忽略 ${ignored.key}：${ignored.reason}`));
    }
  }

  const jwtSecret = ensureAgentJwtSecret(configPath);
  const envFilePath = resolveAgentJwtEnvFile(configPath);
  if (jwtSecret.created) {
    p.log.success(`已创建 ${pc.cyan("PAPERCLIP_AGENT_JWT_SECRET")} 于 ${pc.dim(envFilePath)}`);
  } else if (process.env.PAPERCLIP_AGENT_JWT_SECRET?.trim()) {
    p.log.info(`使用环境中的现有 ${pc.cyan("PAPERCLIP_AGENT_JWT_SECRET")}`);
  } else {
    p.log.info(`使用 ${pc.dim(envFilePath)} 中的现有 ${pc.cyan("PAPERCLIP_AGENT_JWT_SECRET")}`);
  }

  const config: PaperclipConfig = {
    $meta: {
      version: 1,
      updatedAt: new Date().toISOString(),
      source: "onboard",
    },
    ...(llm && { llm }),
    database,
    logging,
    server,
    auth,
    storage,
    secrets,
  };

  const keyResult = ensureLocalSecretsKeyFile(config, configPath);
  if (keyResult.status === "created") {
    p.log.success(`已创建本地密钥文件：${pc.dim(keyResult.path)}`);
  } else if (keyResult.status === "existing") {
    p.log.message(pc.dim(`使用现有本地密钥文件：${keyResult.path}`));
  }

  writeConfig(config, opts.config);

  p.note(
    [
      `数据库：${database.mode}`,
      llm ? `LLM：${llm.provider}` : "LLM：未配置",
      `日志：${logging.mode} -> ${logging.logDir}`,
      `服务器：${server.deploymentMode}/${server.exposure} @ ${server.host}:${server.port}`,
      `允许的主机：${server.allowedHostnames.length > 0 ? server.allowedHostnames.join(", ") : "（仅 loopback）"}`,
      `认证 URL 模式：${auth.baseUrlMode}${auth.publicBaseUrl ? ` (${auth.publicBaseUrl})` : ""}`,
      `存储：${storage.provider}`,
      `密钥：${secrets.provider}（严格模式 ${secrets.strictMode ? "开启" : "关闭"}）`,
      "Agent 认证：PAPERCLIP_AGENT_JWT_SECRET 已配置",
    ].join("\n"),
    "配置已保存",
  );

  p.note(
    [
      `运行：${pc.cyan("paperclipai run")}`,
      `重新配置：${pc.cyan("paperclipai configure")}`,
      `诊断问题：${pc.cyan("paperclipai doctor")}`,
    ].join("\n"),
    "后续命令",
  );

  if (canCreateBootstrapInviteImmediately({ database, server })) {
    p.log.step("正在生成引导 CEO 邀请");
    await bootstrapCeoInvite({ config: configPath });
  }

  let shouldRunNow = opts.run === true || opts.yes === true;
  if (!shouldRunNow && !opts.invokedByRun && process.stdin.isTTY && process.stdout.isTTY) {
    const answer = await p.confirm({
      message: "是否立即启动 Paperclip？",
      initialValue: true,
    });
    if (!p.isCancel(answer)) {
      shouldRunNow = answer;
    }
  }

  if (shouldRunNow && !opts.invokedByRun) {
    process.env.PAPERCLIP_OPEN_ON_LISTEN = "true";
    const { runCommand } = await import("./run.js");
    await runCommand({ config: configPath, repair: true, yes: true });
    return;
  }

  if (server.deploymentMode === "authenticated" && database.mode === "embedded-postgres") {
    p.log.info(
      [
        "服务器启动后将创建引导 CEO 邀请。",
        `下一步：${pc.cyan("paperclipai run")}`,
        `然后：${pc.cyan("paperclipai auth bootstrap-ceo")}`,
      ].join("\n"),
    );
  }

  p.outro("安装完成！");
}

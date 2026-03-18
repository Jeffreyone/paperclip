import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { PaperclipConfig } from "../config/schema.js";
import type { CheckResult } from "./index.js";
import { resolveRuntimeLikePath } from "./path-resolver.js";

function decodeMasterKey(raw: string): Buffer | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^[A-Fa-f0-9]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  try {
    const decoded = Buffer.from(trimmed, "base64");
    if (decoded.length === 32) return decoded;
  } catch {
    // ignored
  }

  if (Buffer.byteLength(trimmed, "utf8") === 32) {
    return Buffer.from(trimmed, "utf8");
  }
  return null;
}

function withStrictModeNote(
  base: Pick<CheckResult, "name" | "status" | "message" | "canRepair" | "repair" | "repairHint">,
  config: PaperclipConfig,
): CheckResult {
  const strictModeDisabledInDeployedSetup =
    config.database.mode === "postgres" && config.secrets.strictMode === false;
  if (!strictModeDisabledInDeployedSetup) return base;

  if (base.status === "fail") return base;
  return {
    ...base,
    status: "warn",
    message: `${base.message}；PostgreSQL 部署已禁用严格密钥模式`,
    repairHint: base.repairHint
      ? `${base.repairHint}。建议启用 secrets.strictMode`
      : "建议启用 secrets.strictMode",
  };
}

export function secretsCheck(config: PaperclipConfig, configPath?: string): CheckResult {
  const provider = config.secrets.provider;
  if (provider !== "local_encrypted") {
    return {
      name: "密钥适配器",
      status: "fail",
      message: `已配置 ${provider}，但当前版本仅支持 local_encrypted`,
      canRepair: false,
      repairHint: "运行 `paperclipai configure --section secrets` 并将 provider 设置为 local_encrypted",
    };
  }

  const envMasterKey = process.env.PAPERCLIP_SECRETS_MASTER_KEY;
  if (envMasterKey && envMasterKey.trim().length > 0) {
    if (!decodeMasterKey(envMasterKey)) {
      return {
        name: "密钥适配器",
        status: "fail",
        message:
          "PAPERCLIP_SECRETS_MASTER_KEY 无效（应为 32 字节 base64、64 字符 hex 或 32 字符原始字符串）",
        canRepair: false,
        repairHint: "设置有效的 PAPERCLIP_SECRETS_MASTER_KEY 或取消设置以使用密钥文件",
      };
    }

    return withStrictModeNote(
      {
        name: "密钥适配器",
        status: "pass",
        message: "本地加密密钥已通过 PAPERCLIP_SECRETS_MASTER_KEY 配置",
      },
      config,
    );
  }

  const keyFileOverride = process.env.PAPERCLIP_SECRETS_MASTER_KEY_FILE;
  const configuredPath =
    keyFileOverride && keyFileOverride.trim().length > 0
      ? keyFileOverride.trim()
      : config.secrets.localEncrypted.keyFilePath;
  const keyFilePath = resolveRuntimeLikePath(configuredPath, configPath);

  if (!fs.existsSync(keyFilePath)) {
    return withStrictModeNote(
      {
        name: "密钥适配器",
        status: "warn",
        message: `密钥文件尚不存在：${keyFilePath}`,
        canRepair: true,
        repair: () => {
          fs.mkdirSync(path.dirname(keyFilePath), { recursive: true });
          fs.writeFileSync(keyFilePath, randomBytes(32).toString("base64"), {
            encoding: "utf8",
            mode: 0o600,
          });
          try {
            fs.chmodSync(keyFilePath, 0o600);
          } catch {
            // best effort
          }
        },
        repairHint: "使用 --repair 运行以创建本地加密密钥文件",
      },
      config,
    );
  }

  let raw: string;
  try {
    raw = fs.readFileSync(keyFilePath, "utf8");
  } catch (err) {
    return {
      name: "密钥适配器",
      status: "fail",
      message: `无法读取密钥文件：${err instanceof Error ? err.message : String(err)}`,
      canRepair: false,
      repairHint: "检查文件权限或设置 PAPERCLIP_SECRETS_MASTER_KEY",
    };
  }

  if (!decodeMasterKey(raw)) {
    return {
      name: "密钥适配器",
      status: "fail",
      message: `${keyFilePath} 中的密钥材料无效`,
      canRepair: false,
      repairHint: "替换为有效的密钥材料或删除后运行 doctor --repair",
    };
  }

  return withStrictModeNote(
    {
      name: "密钥适配器",
      status: "pass",
      message: `本地加密密钥已配置，使用密钥文件 ${keyFilePath}`,
    },
    config,
  );
}

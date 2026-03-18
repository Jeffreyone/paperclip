import {
  ensureAgentJwtSecret,
  readAgentJwtSecretFromEnv,
  readAgentJwtSecretFromEnvFile,
  resolveAgentJwtEnvFile,
} from "../config/env.js";
import type { CheckResult } from "./index.js";

export function agentJwtSecretCheck(configPath?: string): CheckResult {
  if (readAgentJwtSecretFromEnv(configPath)) {
    return {
      name: "Agent JWT 密钥",
      status: "pass",
      message: "PAPERCLIP_AGENT_JWT_SECRET 已设置在环境变量中",
    };
  }

  const envPath = resolveAgentJwtEnvFile(configPath);
  const fileSecret = readAgentJwtSecretFromEnvFile(envPath);

  if (fileSecret) {
    return {
      name: "Agent JWT 密钥",
      status: "warn",
      message: `PAPERCLIP_AGENT_JWT_SECRET 存在于 ${envPath} 但未加载到环境变量`,
      repairHint: `在启动 Paperclip 服务器前，将 ${envPath} 中的值设置到你的 shell 中`,
    };
  }

  return {
    name: "Agent JWT 密钥",
    status: "fail",
    message: `PAPERCLIP_AGENT_JWT_SECRET 缺失于环境变量和 ${envPath}`,
    canRepair: true,
    repair: () => {
      ensureAgentJwtSecret(configPath);
    },
    repairHint: `使用 --repair 运行以创建包含 PAPERCLIP_AGENT_JWT_SECRET 的 ${envPath} 文件`,
  };
}

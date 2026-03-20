import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "../types.js";
import { asString, parseObject } from "../utils.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const template = asString(config.template, "");
  const startupCommand = asString(config.startupCommand, "");

  const envConfig = parseObject(config.env);
  const envKeys = Object.keys(envConfig).filter((k) => typeof (envConfig as Record<string, unknown>)[k] === "string");
  const hasApiKey = envKeys.some((k) => k.toLowerCase().includes("api_key") || k.toLowerCase().includes("apikey"));

  if (!hasApiKey) {
    checks.push({
      code: "e2b_api_key_missing",
      level: "error",
      message: "E2B adapter requires an API key in adapterConfig.env.",
      hint: "Add E2B_API_KEY to adapterConfig.env using a company secret.",
    });
  } else {
    checks.push({
      code: "e2b_api_key_present",
      level: "info",
      message: "E2B API key configured.",
    });
  }

  if (template) {
    checks.push({
      code: "e2b_template_configured",
      level: "info",
      message: `Sandbox template: ${template}`,
    });
  } else {
    checks.push({
      code: "e2b_template_default",
      level: "info",
      message: "Using default sandbox template (base).",
    });
  }

  if (startupCommand) {
    checks.push({
      code: "e2b_startup_command_configured",
      level: "info",
      message: `Startup command: ${startupCommand}`,
    });
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}

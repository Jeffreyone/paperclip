import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import {
  asString,
  parseObject,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  runChildProcess,
} from "@paperclipai/adapter-utils/server-utils";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

function firstNonEmptyLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const command = asString(config.command, "openclaw");
  const cwd = asString(config.cwd, process.cwd());

  try {
    await ensureAbsoluteDirectory(cwd, { createIfMissing: false });
    checks.push({
      code: "openclaw_cwd_valid",
      level: "info",
      message: `Working directory is valid: ${cwd}`,
    });
  } catch (err) {
    checks.push({
      code: "openclaw_cwd_invalid",
      level: "error",
      message: err instanceof Error ? err.message : "Invalid working directory",
      detail: cwd,
    });
  }

  const envConfig = parseObject(config.env);
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") env[key] = value;
  }

  const runtimeEnv = Object.fromEntries(
    Object.entries(ensurePathInEnv({ ...process.env, ...env })).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );

  const cwdInvalid = checks.some((check) => check.code === "openclaw_cwd_invalid");

  if (!cwdInvalid) {
    try {
      await ensureCommandResolvable(command, cwd, runtimeEnv);
      checks.push({
        code: "openclaw_command_resolvable",
        level: "info",
        message: `Command is executable: ${command}`,
      });
    } catch (err) {
      checks.push({
        code: "openclaw_command_unresolvable",
        level: "error",
        message: err instanceof Error ? err.message : "Command is not executable",
        detail: command,
      });
    }
  }

  const canRunProbe = !cwdInvalid && !checks.some((check) => check.code === "openclaw_command_unresolvable");

  if (canRunProbe) {
    try {
      const probe = await runChildProcess(
        `openclaw-envtest-${Date.now()}`,
        command,
        ["--version"],
        {
          cwd,
          env: runtimeEnv,
          timeoutSec: 15,
          graceSec: 5,
          onLog: async () => {},
        },
      );

      const versionOutput = probe.stdout.trim() || probe.stderr.trim();
      if (probe.exitCode === 0 && versionOutput) {
        checks.push({
          code: "openclaw_version_ok",
          level: "info",
          message: `OpenClaw version: ${versionOutput}`,
        });
      } else if (probe.exitCode !== 0) {
        checks.push({
          code: "openclaw_version_failed",
          level: "error",
          message: "OpenClaw --version check failed.",
          detail: firstNonEmptyLine(probe.stderr) || firstNonEmptyLine(probe.stdout),
        });
      }
    } catch (err) {
      checks.push({
        code: "openclaw_version_failed",
        level: "error",
        message: "OpenClaw version check failed.",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}

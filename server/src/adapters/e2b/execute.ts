import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import { Sandbox } from "@e2b/code-interpreter";
import {
  asNumber,
  parseObject,
} from "@paperclipai/adapter-utils/server-utils";
import { logger } from "../../middleware/logger.js";

const DEFAULT_IDLE_TIMEOUT_MS = 10 * 60 * 1000;

interface E2bSessionParams {
  sandboxId?: string;
  sandboxConnected?: boolean;
}

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveSessionParams(runtime: AdapterExecutionContext["runtime"]): E2bSessionParams {
  const raw = parseObject(runtime.sessionParams);
  if (!raw) return {};
  return {
    sandboxId: nonEmpty(raw.sandboxId) ?? undefined,
    sandboxConnected: typeof raw.sandboxConnected === "boolean" ? raw.sandboxConnected : false,
  };
}

async function createOrConnectSandbox(
  apiKey: string,
  template: string | null,
  envVars: Record<string, string>,
  existingSandboxId: string | null,
  onLog: (stream: "stdout" | "stderr", chunk: string) => Promise<void>,
): Promise<{ sandbox: InstanceType<typeof Sandbox>; isNew: boolean }> {
  if (existingSandboxId) {
    try {
      onLog("stdout", `[e2b] connecting to existing sandbox: ${existingSandboxId}\n`);
      const sandbox = await Sandbox.connect(existingSandboxId, {
        apiKey,
        timeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
      });
      const running = await sandbox.isRunning();
      if (running) {
        onLog("stdout", `[e2b] connected to sandbox: ${existingSandboxId}\n`);
        return { sandbox, isNew: false };
      }
      onLog("stderr", `[e2b] sandbox ${existingSandboxId} is no longer running, creating new\n`);
      try {
        await sandbox.kill();
      } catch {
        // dead sandbox, no-op
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onLog("stderr", `[e2b] failed to connect to sandbox ${existingSandboxId}: ${msg}, creating new\n`);
    }
  }

  onLog("stdout", `[e2b] creating new sandbox (template: ${template ?? "base"})\n`);
  const sandbox = template
    ? await Sandbox.create(template, {
        apiKey,
        timeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
        envs: envVars,
      })
    : await Sandbox.create({
        apiKey,
        timeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
        envs: envVars,
      });
  return { sandbox, isNew: true };
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, runtime, config, onLog, onMeta } = ctx;

  // Read config fields
  const template = nonEmpty(config.template) ?? null;
  const timeoutMs = Math.max(0, Math.floor(asNumber(config.timeoutMs, 0)));
  const startupCommand = nonEmpty(config.startupCommand) ?? "echo 'E2B sandbox ready'";
  const idleTimeoutMs = Math.max(60_000, Math.floor(asNumber(config.idleTimeoutMs, DEFAULT_IDLE_TIMEOUT_MS)));

  const envConfig = parseObject(config.env);
  const envVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") envVars[key] = value;
  }

  const apiKey = envVars.E2B_API_KEY ?? process.env.E2B_API_KEY ?? "";
  if (!apiKey) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "E2B adapter requires E2B_API_KEY in adapterConfig.env",
      errorCode: "e2b_api_key_missing",
    };
  }

  const sessionParams = resolveSessionParams(runtime);

  if (onMeta) {
    await onMeta({
      adapterType: "e2b",
      command: startupCommand,
      context: ctx.context,
    });
  }

  await onLog("stdout", `[e2b] run ${runId} starting\n`);

  let sandbox: InstanceType<typeof Sandbox> | null = null;
  let sandboxId: string | null = null;
  let isNewSandbox = false;

  try {
    const result = await createOrConnectSandbox(
      apiKey,
      template,
      envVars,
      sessionParams.sandboxId ?? null,
      onLog,
    );
    sandbox = result.sandbox;
    sandboxId = sandbox.sandboxId;
    isNewSandbox = result.isNew;

    await onLog("stdout", `[e2b] sandbox ${sandboxId} ${isNewSandbox ? "created" : "connected"}\n`);

    // Extend sandbox timeout
    if (idleTimeoutMs > 0) {
    try {
      await sandbox.setTimeout(idleTimeoutMs);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn({ err, sandboxId, runId }, "e2b: failed to set sandbox timeout");
        await onLog("stderr", `[e2b] warning: failed to set idle timeout: ${msg}\n`);
      }
    }

    const commandToRun = startupCommand;
    await onLog("stdout", `[e2b] executing: ${commandToRun}\n`);
    const execTimeoutMs = timeoutMs > 0 ? timeoutMs : 5 * 60 * 1000;

    let exitCode = 0;
    let stdout = "";
    let stderr = "";

    try {
      const cmdResult = await sandbox.commands.run(commandToRun, {
        timeoutMs: execTimeoutMs,
        envs: {},
      });

      stdout = cmdResult.stdout ?? "";
      stderr = cmdResult.stderr ?? "";
      exitCode = cmdResult.exitCode ?? 0;

      if (stdout) {
        await onLog("stdout", stdout);
      }
      if (stderr) {
        await onLog("stderr", stderr);
      }

      await onLog("stdout", `[e2b] command exited with code ${exitCode}\n`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTimeout = msg.includes("timeout") || msg.includes("timed out");
      exitCode = isTimeout ? 124 : 1;

      await onLog("stderr", `[e2b] command error: ${msg}\n`);

      return {
        exitCode,
        signal: null,
        timedOut: isTimeout,
        errorMessage: isTimeout ? `Command timed out after ${execTimeoutMs}ms` : msg,
        errorCode: isTimeout ? "e2b_command_timeout" : "e2b_command_failed",
        sessionId: sandboxId,
        sessionParams: { sandboxId, sandboxConnected: true } as Record<string, unknown>,
        sessionDisplayId: sandboxId,
        summary: `E2B sandbox ${sandboxId} (${isNewSandbox ? "new" : "reused"})`,
        clearSession: false,
      };
    }

    return {
      exitCode,
      signal: null,
      timedOut: false,
      sessionId: sandboxId,
      sessionParams: { sandboxId, sandboxConnected: true } as Record<string, unknown>,
      sessionDisplayId: sandboxId,
      summary: `E2B sandbox ${sandboxId} (${isNewSandbox ? "new" : "reused"})`,
      clearSession: false,
      resultJson: { stdout, stderr },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes("timeout") || msg.includes("timed out");

    await onLog("stderr", `[e2b] error: ${msg}\n`);

    if (sandbox) {
      try {
        await sandbox.kill();
      } catch {
        // dead sandbox cleanup failure — ignore
      }
    }

    return {
      exitCode: 1,
      signal: null,
      timedOut: isTimeout,
      errorMessage: msg,
      errorCode: isTimeout ? "e2b_timeout" : "e2b_error",
      sessionId: sandboxId,
      sessionParams: sandboxId ? { sandboxId, sandboxConnected: false } as Record<string, unknown> : null,
      sessionDisplayId: sandboxId,
      clearSession: true,
    };
  }
}

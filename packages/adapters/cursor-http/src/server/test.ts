import type { AdapterEnvironmentTestContext, AdapterEnvironmentTestResult } from "@paperclipai/adapter-utils";

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentTestResult["checks"] = [];
  const config = ctx.config as Record<string, unknown>;

  const url = typeof config.url === "string" && config.url.trim().length > 0 ? config.url.trim() : null;

  if (!url) {
    checks.push({
      code: "CURSOR_HTTP_URL_MISSING",
      level: "error",
      message: "Cursor HTTP endpoint URL is required",
      detail: "Set the 'url' field in adapterConfig to your Cursor agent HTTP endpoint",
      hint: "Example: https://cursor-agent.example.com/run",
    });
  } else {
    checks.push({
      code: "CURSOR_HTTP_URL_CONFIGURED",
      level: "info",
      message: `Cursor HTTP endpoint configured: ${url}`,
    });

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        checks.push({
          code: "CURSOR_HTTP_URL_PROTOCOL",
          level: "error",
          message: `Unsupported URL protocol: ${parsed.protocol}`,
          detail: "Only http:// and https:// are supported",
        });
      } else if (parsed.protocol === "http:") {
        checks.push({
          code: "CURSOR_HTTP_URL_PLAINTEXT",
          level: "warn",
          message: "Using plaintext http:// protocol",
          detail: "Consider using https:// for production deployments",
        });
      } else {
        checks.push({
          code: "CURSOR_HTTP_URL_SECURE",
          level: "info",
          message: "Using HTTPS for encrypted communication",
        });
      }
    } catch {
      checks.push({
        code: "CURSOR_HTTP_URL_INVALID",
        level: "error",
        message: "Invalid URL format",
        detail: `Could not parse URL: ${url}`,
      });
    }
  }

  const authToken = typeof config.authToken === "string" && config.authToken.trim().length > 0;
  if (authToken) {
    checks.push({
      code: "CURSOR_HTTP_AUTH_TOKEN",
      level: "info",
      message: "Authentication token configured",
    });
  } else {
    checks.push({
      code: "CURSOR_HTTP_NO_AUTH",
      level: "warn",
      message: "No authentication token configured",
      detail: "The endpoint may require authentication. Add an authToken in adapterConfig.",
    });
  }

  const callbackUrl =
    typeof config.callbackUrl === "string" && config.callbackUrl.trim().length > 0;
  if (callbackUrl) {
    checks.push({
      code: "CURSOR_HTTP_CALLBACK",
      level: "info",
      message: "Callback URL configured for async completion",
    });
  }

  const timeoutSec =
    typeof config.timeoutSec === "number" && config.timeoutSec > 0 ? config.timeoutSec : 120;
  if (timeoutSec > 0) {
    checks.push({
      code: "CURSOR_HTTP_TIMEOUT",
      level: "info",
      message: `Timeout set to ${timeoutSec}s`,
    });
  }

  const hasErrors = checks.some((c: { level: string }) => c.level === "error");
  const hasWarnings = checks.some((c: { level: string }) => c.level === "warn");

  return {
    adapterType: "cursor_http",
    status: hasErrors ? "fail" : hasWarnings ? "warn" : "pass",
    testedAt: new Date().toISOString(),
    checks,
  };
}

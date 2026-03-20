import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  DraftInput,
} from "../../components/agent-config-primitives";
import { useTranslation } from "react-i18next";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

function getCustomValue(values: Record<string, unknown> | null, key: string, fallback = ""): string {
  if (!values) return fallback;
  return typeof values[key] === "string" ? (values[key] as string) : fallback;
}

export function CursorHttpConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  const { t } = useTranslation();
  const vals = values as Record<string, unknown> | null;

  return (
    <>
      <Field label={t("adapter.webhookUrl")} hint="HTTP endpoint for the Cursor agent">
        <DraftInput
          value={
            isCreate
              ? getCustomValue(vals, "url")
              : eff("adapterConfig", "url", String(config.url ?? ""))
          }
          onCommit={(v) => {
            if (isCreate) {
              (set as (p: unknown) => void)({ url: v });
            } else {
              mark("adapterConfig", "url", v || undefined);
            }
          }}
          immediate
          className={inputClass}
          placeholder="https://cursor-agent.example.com/run"
        />
      </Field>

      <Field label="Bearer Token" hint="Bearer token for Cursor HTTP endpoint authentication">
        <DraftInput
          value={
            isCreate
              ? getCustomValue(vals, "authToken")
              : eff("adapterConfig", "authToken", String(config.authToken ?? ""))
          }
          onCommit={(v) => {
            if (!isCreate) mark("adapterConfig", "authToken", v || undefined);
          }}
          immediate
          className={inputClass}
          placeholder="Bearer token (optional)"
        />
      </Field>

      <Field label="Callback URL" hint="Callback URL for async completion (optional)">
        <DraftInput
          value={
            isCreate
              ? getCustomValue(vals, "callbackUrl")
              : eff("adapterConfig", "callbackUrl", String(config.callbackUrl ?? ""))
          }
          onCommit={(v) => {
            if (!isCreate) mark("adapterConfig", "callbackUrl", v || undefined);
          }}
          immediate
          className={inputClass}
          placeholder="https://paperclip.example.com/api/adapters/cursor/callback"
        />
      </Field>

      <Field label="HTTP Method" hint="HTTP method (default POST)">
        <DraftInput
          value={
            isCreate
              ? getCustomValue(vals, "method", "POST")
              : eff("adapterConfig", "method", String(config.method ?? "POST"))
          }
          onCommit={(v) => {
            if (!isCreate) mark("adapterConfig", "method", v || "POST");
          }}
          immediate
          className={inputClass}
          placeholder="POST"
        />
      </Field>

      <Field label="Timeout (seconds)" hint="Request timeout in seconds (default 120)">
        <DraftInput
          value={
            isCreate
              ? getCustomValue(vals, "timeoutSec", "120")
              : eff("adapterConfig", "timeoutSec", String(config.timeoutSec ?? 120))
          }
          onCommit={(v) => {
            if (!isCreate) {
              const num = parseInt(v, 10);
              mark("adapterConfig", "timeoutSec", isNaN(num) ? undefined : num);
            }
          }}
          immediate
          className={inputClass}
          placeholder="120"
        />
      </Field>
    </>
  );
}

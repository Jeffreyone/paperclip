import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  DraftInput,
  useAdapterHelp,
} from "../../components/agent-config-primitives";
import { useTranslation } from "react-i18next";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

export function E2bConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  const { t } = useTranslation();
  const help = useAdapterHelp();

  return (
    <>
      <Field label={t("adapter.e2bTemplate")} hint={help.e2bTemplate}>
        <DraftInput
          value={
            isCreate
              ? (values?.template ?? "")
              : eff("adapterConfig", "template", String(config.template ?? ""))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ template: v })
              : mark("adapterConfig", "template", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="base"
        />
      </Field>
      <Field label={t("adapter.e2bStartupCommand")} hint={help.e2bStartupCommand}>
        <DraftInput
          value={
            isCreate
              ? (values?.startupCommand ?? "")
              : eff("adapterConfig", "startupCommand", String(config.startupCommand ?? ""))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ startupCommand: v })
              : mark("adapterConfig", "startupCommand", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="echo 'E2B sandbox ready'"
        />
      </Field>
    </>
  );
}

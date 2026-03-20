import { useTranslation } from "react-i18next";
import type { AdapterModel } from "../api/agents";
import type { CreateConfigValues } from "@paperclipai/adapter-utils";

export function WizardRuntimeFields({
  modelOptions,
  isModelsLoading,
  configValues,
  onChange,
}: {
  modelOptions: AdapterModel[];
  isModelsLoading: boolean;
  configValues: CreateConfigValues;
  onChange: (patch: Partial<CreateConfigValues>) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="px-3 py-2 border-b border-border">
        <label className="text-xs text-muted-foreground">{t("adapter.model")}</label>
        <select
          className="mt-1 w-full bg-transparent outline-none text-sm"
          value={configValues.model}
          onChange={(e) => onChange({ model: e.target.value })}
          disabled={isModelsLoading}
        >
          {isModelsLoading ? (
            <option>{t("common.loading")}…</option>
          ) : (
            modelOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="px-3 py-2">
        <label className="text-xs text-muted-foreground">{t("agent.cwd")}</label>
        <input
          className="mt-1 w-full bg-transparent outline-none text-sm placeholder:text-muted-foreground/40"
          placeholder={t("agent.cwdPlaceholder")}
          value={configValues.cwd}
          onChange={(e) => onChange({ cwd: e.target.value })}
        />
      </div>
    </>
  );
}

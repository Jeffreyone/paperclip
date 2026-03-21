import { useTranslation } from "react-i18next";
import type { CreateConfigValues } from "@paperclipai/adapter-utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { useAdapterHelp } from "./agent-config-primitives";
import { ChoosePathButton } from "./PathInstructionsModal";

export function WizardProcessConfigFields({
  configValues,
  onChange,
}: {
  configValues: CreateConfigValues;
  onChange: (patch: Partial<CreateConfigValues>) => void;
}) {
  const { t } = useTranslation();
  const help = useAdapterHelp();

  return (
    <>
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-1.5 mb-1">
          <label className="text-xs text-muted-foreground">{t("adapter.command")}</label>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="inline-flex text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                <HelpCircle className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {help.command}
            </TooltipContent>
          </Tooltip>
        </div>
        <input
          className="mt-1 w-full bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40"
          placeholder="node, python"
          value={configValues.command}
          onChange={(e) => onChange({ command: e.target.value })}
        />
      </div>

      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-1.5 mb-1">
          <label className="text-xs text-muted-foreground">{t("adapter.args")}</label>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="inline-flex text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                <HelpCircle className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {help.args}
            </TooltipContent>
          </Tooltip>
        </div>
        <input
          className="mt-1 w-full bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40"
          placeholder="script.js"
          value={configValues.args}
          onChange={(e) => onChange({ args: e.target.value })}
        />
      </div>

      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5 mb-1">
          <label className="text-xs text-muted-foreground">{t("agent.instructionsFilePath")}</label>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="inline-flex text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                <HelpCircle className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {help.instructionsFilePath}
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="mt-1 flex-1 w-full bg-transparent outline-none text-sm border border-border rounded px-2 py-1.5 placeholder:text-muted-foreground/40"
            placeholder={t("agent.instructionsFilePathPlaceholder")}
            value={configValues.instructionsFilePath}
            onChange={(e) =>
              onChange({ instructionsFilePath: e.target.value })
            }
          />
          <ChoosePathButton />
        </div>
      </div>
    </>
  );
}

export function WizardHttpConfigFields({
  configValues,
  onChange,
}: {
  configValues: CreateConfigValues;
  onChange: (patch: Partial<CreateConfigValues>) => void;
}) {
  const { t } = useTranslation();
  const help = useAdapterHelp();

  return (
    <>
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-1.5 mb-1">
          <label className="text-xs text-muted-foreground">{t("adapter.webhookUrl")}</label>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="inline-flex text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                <HelpCircle className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {help.webhookUrl}
            </TooltipContent>
          </Tooltip>
        </div>
        <input
          className="mt-1 w-full bg-transparent outline-none text-sm placeholder:text-muted-foreground/40"
          placeholder="https://..."
          value={configValues.url}
          onChange={(e) => onChange({ url: e.target.value })}
        />
      </div>

      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5 mb-1">
          <label className="text-xs text-muted-foreground">{t("agent.instructionsFilePath")}</label>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="inline-flex text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                <HelpCircle className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {help.instructionsFilePath}
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="mt-1 flex-1 w-full bg-transparent outline-none text-sm border border-border rounded px-2 py-1.5 placeholder:text-muted-foreground/40"
            placeholder={t("agent.instructionsFilePathPlaceholder")}
            value={configValues.instructionsFilePath}
            onChange={(e) =>
              onChange({ instructionsFilePath: e.target.value })
            }
          />
          <ChoosePathButton />
        </div>
      </div>
    </>
  );
}

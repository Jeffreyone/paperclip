import { type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import type { CreateConfigValues } from "@paperclipai/adapter-utils";
import {
  Bot,
  Code,
  Gem,
  Terminal,
  MousePointer2,
  Webhook,
  Boxes,
  Sparkles,
  Rocket,
} from "lucide-react";
import { OpenCodeLogoIcon } from "./OpenCodeLogoIcon";
import { cn } from "../lib/utils";

export type WizardAdapterType =
  | "claude_local"
  | "codex_local"
  | "gemini_local"
  | "opencode_local"
  | "pi_local"
  | "cursor"
  | "openclaw_gateway"
  | "process"
  | "http"
  | "e2b";

export interface AgentTemplate {
  id: string;
  adapterType: WizardAdapterType;
  labelKey: string;
  descKey: string;
  defaultValues: Partial<CreateConfigValues>;
}

export const WIZARD_ADAPTERS: AgentTemplate[] = [
  {
    id: "claude_local",
    adapterType: "claude_local",
    labelKey: "agent.adapterClaudeLocal",
    descKey: "agent.wizard.templateClaudeLocalDesc",
    defaultValues: {
      adapterType: "claude_local",
      model: "claude-sonnet-4-20250514",
      thinkingEffort: "",
      dangerouslySkipPermissions: true,
    },
  },
  {
    id: "codex_local",
    adapterType: "codex_local",
    labelKey: "agent.adapterCodexLocal",
    descKey: "agent.wizard.templateCodexLocalDesc",
    defaultValues: {
      adapterType: "codex_local",
      model: "o4-mini",
      thinkingEffort: "",
    },
  },
  {
    id: "gemini_local",
    adapterType: "gemini_local",
    labelKey: "agent.adapterGeminiLocal",
    descKey: "agent.wizard.templateGeminiLocalDesc",
    defaultValues: {
      adapterType: "gemini_local",
      model: "gemini-2.5-pro-preview-06-05",
      thinkingEffort: "",
    },
  },
  {
    id: "opencode_local",
    adapterType: "opencode_local",
    labelKey: "agent.adapterOpencodeLocal",
    descKey: "agent.wizard.templateOpencodeLocalDesc",
    defaultValues: {
      adapterType: "opencode_local",
      model: "",
    },
  },
  {
    id: "pi_local",
    adapterType: "pi_local",
    labelKey: "agent.adapterPiLocal",
    descKey: "agent.wizard.templatePiLocalDesc",
    defaultValues: {
      adapterType: "pi_local",
    },
  },
  {
    id: "cursor",
    adapterType: "cursor",
    labelKey: "agent.adapterCursor",
    descKey: "agent.wizard.templateCursorDesc",
    defaultValues: {
      adapterType: "cursor",
      model: "claude-sonnet-4-20250514",
    },
  },
  {
    id: "openclaw_gateway",
    adapterType: "openclaw_gateway",
    labelKey: "agent.adapterOpenclawGateway",
    descKey: "agent.wizard.templateOpenclawDesc",
    defaultValues: {
      adapterType: "openclaw_gateway",
    },
  },
  {
    id: "process",
    adapterType: "process",
    labelKey: "agent.adapterProcess",
    descKey: "agent.wizard.templateProcessDesc",
    defaultValues: {
      adapterType: "process",
      command: "",
      args: "",
    },
  },
  {
    id: "http",
    adapterType: "http",
    labelKey: "agent.adapterHttp",
    descKey: "agent.wizard.templateHttpDesc",
    defaultValues: {
      adapterType: "http",
      url: "",
    },
  },
  {
    id: "e2b",
    adapterType: "e2b",
    labelKey: "agent.adapterE2B",
    descKey: "agent.wizard.templateE2BDesc",
    defaultValues: {
      adapterType: "e2b",
    },
  },
];

const adapterIconMap: Record<WizardAdapterType, ComponentType<{ className?: string }>> = {
  claude_local: Sparkles,
  codex_local: Code,
  gemini_local: Gem,
  opencode_local: OpenCodeLogoIcon,
  pi_local: Terminal,
  cursor: MousePointer2,
  openclaw_gateway: Webhook,
  process: Terminal,
  http: Boxes,
  e2b: Rocket,
};

interface AgentWizardTemplatesProps {
  selected: WizardAdapterType | null;
  onSelect: (adapterType: WizardAdapterType) => void;
}

export function AgentWizardTemplates({ selected, onSelect }: AgentWizardTemplatesProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-2">
      {WIZARD_ADAPTERS.map((template) => {
        const Icon = adapterIconMap[template.adapterType];
        const isSelected = selected === template.adapterType;
        return (
          <button
            key={template.id}
            onClick={() => onSelect(template.adapterType)}
            className={cn(
              "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-all hover:border-primary/50 hover:bg-accent/30",
              isSelected
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border bg-card"
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className={cn("h-4 w-4 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-xs font-medium", isSelected ? "text-primary" : "text-foreground")}>
                {t(template.labelKey)}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground leading-relaxed">
              {t(template.descKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

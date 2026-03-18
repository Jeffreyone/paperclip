import { useState, useMemo, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { useTranslation } from "react-i18next";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Bot,
  Code,
  Gem,
  MousePointer2,
  Sparkles,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OpenCodeLogoIcon } from "./OpenCodeLogoIcon";

type AdvancedAdapterType =
  | "claude_local"
  | "codex_local"
  | "gemini_local"
  | "opencode_local"
  | "pi_local"
  | "cursor"
  | "openclaw_gateway";

const adapterTypeKeys: Record<AdvancedAdapterType, { label: string; desc: string }> = {
  claude_local: { label: "agent.adapterClaudeLocal", desc: "agent.adapterClaudeLocalDesc" },
  codex_local: { label: "agent.adapterCodexLocal", desc: "agent.adapterCodexLocalDesc" },
  gemini_local: { label: "agent.adapterGeminiLocal", desc: "agent.adapterGeminiLocalDesc" },
  opencode_local: { label: "agent.adapterOpencodeLocal", desc: "agent.adapterOpencodeLocalDesc" },
  pi_local: { label: "agent.adapterPiLocal", desc: "agent.adapterPiLocalDesc" },
  cursor: { label: "agent.adapterCursor", desc: "agent.adapterCursorDesc" },
  openclaw_gateway: { label: "agent.adapterOpenclawGateway", desc: "agent.adapterOpenclawGatewayDesc" },
};

const adapterIcons: Record<AdvancedAdapterType, ComponentType<{ className?: string }>> = {
  claude_local: Sparkles,
  codex_local: Code,
  gemini_local: Gem,
  opencode_local: OpenCodeLogoIcon,
  pi_local: Terminal,
  cursor: MousePointer2,
  openclaw_gateway: Bot,
};

const recommendedAdapters: AdvancedAdapterType[] = ["claude_local", "codex_local"];

export function NewAgentDialog() {
  const { t } = useTranslation();
  const { newAgentOpen, closeNewAgent, openNewIssue } = useDialog();
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();
  const [showAdvancedCards, setShowAdvancedCards] = useState(false);

  const adapterLabels = useMemo(() => {
    const result: Record<AdvancedAdapterType, { label: string; desc: string }> = {} as typeof adapterTypeKeys;
    for (const [key, i18nKeys] of Object.entries(adapterTypeKeys)) {
      result[key as AdvancedAdapterType] = {
        label: t(i18nKeys.label),
        desc: t(i18nKeys.desc),
      };
    }
    return result;
  }, [t]);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && newAgentOpen,
  });

  const ceoAgent = (agents ?? []).find((a) => a.role === "ceo");

  function handleAskCeo() {
    closeNewAgent();
    openNewIssue({
      assigneeAgentId: ceoAgent?.id,
      title: t("agent.createNewAgentTitle"),
      description: t("agent.createNewAgentDesc"),
    });
  }

  function handleAdvancedConfig() {
    setShowAdvancedCards(true);
  }

  function handleAdvancedAdapterPick(adapterType: AdvancedAdapterType) {
    closeNewAgent();
    setShowAdvancedCards(false);
    navigate(`/agents/new?adapterType=${encodeURIComponent(adapterType)}`);
  }

  return (
    <Dialog
      open={newAgentOpen}
      onOpenChange={(open) => {
        if (!open) {
          setShowAdvancedCards(false);
          closeNewAgent();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md p-0 gap-0 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <span className="text-sm text-muted-foreground">{t("agent.addNewAgent")}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            onClick={() => {
              setShowAdvancedCards(false);
              closeNewAgent();
            }}
          >
            <span className="text-lg leading-none">&times;</span>
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {!showAdvancedCards ? (
            <>
              {/* Recommendation */}
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                  <Sparkles className="h-6 w-6 text-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("agent.recommendation")}
                </p>
              </div>

              <Button className="w-full" size="lg" onClick={handleAskCeo}>
                <Bot className="h-4 w-4 mr-2" />
                {t("agent.askCeoToCreate")}
              </Button>

              {/* Advanced link */}
              <div className="text-center">
                <button
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                  onClick={handleAdvancedConfig}
                >
                  {t("agent.advancedConfig")}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <button
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowAdvancedCards(false)}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {t("common.back")}
                </button>
                <p className="text-sm text-muted-foreground">
                  {t("agent.chooseAdapterType")}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(adapterLabels) as AdvancedAdapterType[]).map((key) => (
                  <button
                    key={key}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-md border border-border p-3 text-xs transition-colors hover:bg-accent/50 relative"
                    )}
                    onClick={() => handleAdvancedAdapterPick(key)}
                  >
                    {recommendedAdapters.includes(key) && (
                      <span className="absolute -top-1.5 right-1.5 bg-green-500 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
                        {t("common.recommended")}
                      </span>
                    )}
                    {(() => {
                      const Icon = adapterIcons[key];
                      return <Icon className="h-4 w-4" />;
                    })()}
                    <span className="font-medium">{adapterLabels[key].label}</span>
                    <span className="text-muted-foreground text-[10px]">
                      {adapterLabels[key].desc}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

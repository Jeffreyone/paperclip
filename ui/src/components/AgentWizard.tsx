import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { useCompany } from "../context/CompanyContext";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { getUIAdapter } from "../adapters";
import type { CreateConfigValues } from "@paperclipai/adapter-utils";
import { defaultCreateValues } from "./agent-config-defaults";
import { AGENT_ROLES } from "@paperclipai/shared";
import type { AdapterModel } from "../api/agents";
import { PiLocalConfigFields } from "../adapters/pi-local/config-fields";
import { E2bConfigFields } from "../adapters/e2b/config-fields";
import { OpenClawGatewayConfigFields } from "../adapters/openclaw-gateway/config-fields";
import { ClaudeLocalConfigFields } from "../adapters/claude-local/config-fields";
import { CodexLocalConfigFields } from "../adapters/codex-local/config-fields";
import { GeminiLocalConfigFields } from "../adapters/gemini-local/config-fields";
import { OpenCodeLocalConfigFields } from "../adapters/opencode-local/config-fields";
import { CursorLocalConfigFields } from "../adapters/cursor/config-fields";
import { WizardRuntimeFields } from "./WizardRuntimeFields";
import {
  DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX,
  DEFAULT_CODEX_LOCAL_MODEL,
} from "@paperclipai/adapter-codex-local";
import { DEFAULT_CURSOR_LOCAL_MODEL } from "@paperclipai/adapter-cursor-local";
import { DEFAULT_GEMINI_LOCAL_MODEL } from "@paperclipai/adapter-gemini-local";
import { AgentWizardTemplates, WIZARD_ADAPTERS, type WizardAdapterType } from "./AgentWizardTemplates";
import { AgentWizardPreview } from "./AgentWizardPreview";
import { AgentIcon } from "./AgentIconPicker";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  ArrowRight,
  Shield,
  User,
} from "lucide-react";
import { cn, agentUrl } from "../lib/utils";
import { roleLabels } from "./agent-config-primitives";

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface AgentWizardProps {
  open: boolean;
  onClose: () => void;
}

function applyTemplate(template: WizardAdapterType): Partial<CreateConfigValues> {
  const entry = WIZARD_ADAPTERS.find((t) => t.adapterType === template);
  const base = entry?.defaultValues ?? {};
  if (template === "codex_local") {
    return {
      ...base,
      model: DEFAULT_CODEX_LOCAL_MODEL,
      dangerouslyBypassSandbox: DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX,
    };
  }
  if (template === "gemini_local") {
    return { ...base, model: DEFAULT_GEMINI_LOCAL_MODEL };
  }
  if (template === "cursor") {
    return { ...base, model: DEFAULT_CURSOR_LOCAL_MODEL };
  }
  return base;
}

export function AgentWizard({ open, onClose }: AgentWizardProps) {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<WizardStep>(1);
  const [selectedAdapter, setSelectedAdapter] = useState<WizardAdapterType | null>(null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("general");
  const [reportsTo, setReportsTo] = useState("");
  const [configValues, setConfigValues] = useState<CreateConfigValues>({
    ...defaultCreateValues,
    heartbeatEnabled: false,
    intervalSec: 300,
  });
  const [roleOpen, setRoleOpen] = useState(false);
  const [reportsToOpen, setReportsToOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && open,
  });

  const {
    data: adapterModels,
    isLoading: adapterModelsLoading,
    isFetching: adapterModelsFetching,
  } = useQuery({
    queryKey: selectedCompanyId
      ? queryKeys.agents.adapterModels(selectedCompanyId, configValues.adapterType)
      : ["agents", "none", "adapter-models", configValues.adapterType],
    queryFn: () => agentsApi.adapterModels(selectedCompanyId!, configValues.adapterType),
    enabled: Boolean(selectedCompanyId && selectedAdapter != null),
  });

  const isFirstAgent = !agents || agents.length === 0;
  const effectiveRole = isFirstAgent ? "ceo" : role;

  const createAgent = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      agentsApi.hire(selectedCompanyId!, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
      onClose();
      navigate(agentUrl(result.agent));
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : t("agent.failedToCreateAgent"));
    },
  });

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSelectedAdapter(null);
    setName(isFirstAgent ? t("agent.defaultName") : "");
    setTitle(isFirstAgent ? t("agent.defaultTitle") : "");
    setRole("general");
    setReportsTo("");
    setConfigValues({ ...defaultCreateValues, heartbeatEnabled: false, intervalSec: 300 });
    setFormError(null);
  }, [open, isFirstAgent, t]);

  function handleAdapterSelect(adapterType: WizardAdapterType) {
    setSelectedAdapter(adapterType);
    const template = applyTemplate(adapterType);
    setConfigValues((prev) => ({ ...prev, ...template }));
  }

  function handleSubmit() {
    if (!selectedCompanyId || !name.trim()) return;
    setFormError(null);
    if (configValues.adapterType === "opencode_local") {
      const selectedModel = configValues.model.trim();
      if (!selectedModel) {
        setFormError(t("onboarding.opencodeModelFormat"));
        return;
      }
      if (!adapterModels?.some((m: AdapterModel) => m.id === selectedModel)) {
        setFormError(
          `${t("agent.wizard.invalidModel")}: ${selectedModel}`,
        );
        return;
      }
    }
    const adapter = getUIAdapter(configValues.adapterType);
    createAgent.mutate({
      name: name.trim(),
      role: effectiveRole,
      ...(title.trim() ? { title: title.trim() } : {}),
      ...(reportsTo ? { reportsTo } : {}),
      adapterType: configValues.adapterType,
      adapterConfig: adapter.buildAdapterConfig(configValues),
      runtimeConfig: {
        heartbeat: {
          enabled: configValues.heartbeatEnabled,
          intervalSec: configValues.intervalSec,
          wakeOnDemand: true,
          cooldownSec: 10,
          maxConcurrentRuns: 1,
        },
      },
      budgetMonthlyCents: 0,
    });
  }

  const currentReportsTo = (agents ?? []).find((a) => a.id === reportsTo);

  const canGoNext =
    step < 5 &&
    (step !== 1 || selectedAdapter !== null) &&
    (step !== 2 || name.trim().length > 0);

  const modelOptions: AdapterModel[] = adapterModels ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
          <DialogTitle className="text-base">{t("agent.wizard.title")}</DialogTitle>
          <div className="flex items-center gap-1 mt-1">
            {([1, 2, 3, 4, 5] as WizardStep[]).map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  s <= step ? "bg-primary" : "bg-border",
                )}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t(`agent.wizard.step${step}Hint`)}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("agent.wizard.step1Desc")}
              </p>
              <AgentWizardTemplates
                selected={selectedAdapter}
                onSelect={handleAdapterSelect}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div>
                <input
                  className="w-full text-lg font-semibold bg-transparent outline-none placeholder:text-muted-foreground/50"
                  placeholder={t("agent.agentName")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
                <input
                  className="w-full mt-1 text-sm bg-transparent outline-none text-muted-foreground placeholder:text-muted-foreground/40"
                  placeholder={t("agent.titlePlaceholder")}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Popover open={roleOpen} onOpenChange={setRoleOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors",
                        isFirstAgent && "opacity-60 cursor-not-allowed",
                      )}
                      disabled={isFirstAgent}
                    >
                      <Shield className="h-3 w-3 text-muted-foreground" />
                      {roleLabels[effectiveRole] ?? effectiveRole}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-36 p-1" align="start">
                    {AGENT_ROLES.map((r) => (
                      <button
                        key={r}
                        className={cn(
                          "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                          r === role && "bg-accent",
                        )}
                        onClick={() => { setRole(r); setRoleOpen(false); }}
                      >
                        {roleLabels[r] ?? r}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>

                <Popover open={reportsToOpen} onOpenChange={setReportsToOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors",
                        isFirstAgent && "opacity-60 cursor-not-allowed",
                      )}
                      disabled={isFirstAgent}
                    >
                      {currentReportsTo ? (
                        <>
                          <AgentIcon icon={currentReportsTo.icon} className="h-3 w-3 text-muted-foreground" />
                          {`${t("agent.reportsTo")} ${currentReportsTo.name}`}
                        </>
                      ) : (
                        <>
                          <User className="h-3 w-3 text-muted-foreground" />
                          {isFirstAgent ? t("agent.reportsToCeo") : `${t("agent.reportsTo")}...`}
                        </>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1" align="start">
                    <button
                      className={cn(
                        "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                        !reportsTo && "bg-accent",
                      )}
                      onClick={() => { setReportsTo(""); setReportsToOpen(false); }}
                    >
                      {t("agent.noManager")}
                    </button>
                    {(agents ?? []).map((a) => (
                      <button
                        key={a.id}
                        className={cn(
                          "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 truncate",
                          a.id === reportsTo && "bg-accent",
                        )}
                        onClick={() => { setReportsTo(a.id); setReportsToOpen(false); }}
                      >
                        <AgentIcon icon={a.icon} className="shrink-0 h-3 w-3 text-muted-foreground" />
                        {a.name}
                        <span className="text-muted-foreground ml-auto">{roleLabels[a.role] ?? a.role}</span>
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>

              {isFirstAgent && (
                <p className="text-xs text-muted-foreground bg-accent/30 rounded p-2">
                  {t("agent.thisWillBeTheCeo")}
                </p>
              )}
            </div>
          )}

          {step === 3 && selectedAdapter && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border overflow-hidden">
                {selectedAdapter === "claude_local" && (
                  <>
                    <WizardRuntimeFields
                      modelOptions={modelOptions}
                      isModelsLoading={adapterModelsLoading || adapterModelsFetching}
                      configValues={configValues}
                      onChange={(patch) => setConfigValues((p) => ({ ...p, ...patch }))}
                    />
                    <ClaudeLocalConfigFields
                      mode="create"
                      isCreate={true}
                      adapterType="claude_local"
                      values={configValues}
                      set={(patch) => setConfigValues((p) => ({ ...p, ...patch }))}
                      config={{}}
                      eff={(_g, _f, original) => original}
                      mark={() => {}}
                      models={modelOptions}
                    />
                  </>
                )}

                {selectedAdapter === "codex_local" && (
                  <>
                    <WizardRuntimeFields
                      modelOptions={modelOptions}
                      isModelsLoading={adapterModelsLoading || adapterModelsFetching}
                      configValues={configValues}
                      onChange={(patch) => setConfigValues((p) => ({ ...p, ...patch }))}
                    />
                    <CodexLocalConfigFields
                      mode="create"
                      isCreate={true}
                      adapterType="codex_local"
                      values={configValues}
                      set={(patch) => setConfigValues((p) => ({ ...p, ...patch }))}
                      config={{}}
                      eff={(_g, _f, original) => original}
                      mark={() => {}}
                      models={modelOptions}
                    />
                  </>
                )}

                {selectedAdapter === "gemini_local" && (
                  <>
                    <WizardRuntimeFields
                      modelOptions={modelOptions}
                      isModelsLoading={adapterModelsLoading || adapterModelsFetching}
                      configValues={configValues}
                      onChange={(patch) => setConfigValues((p) => ({ ...p, ...patch }))}
                    />
                    <GeminiLocalConfigFields
                      mode="create"
                      isCreate={true}
                      adapterType="gemini_local"
                      values={configValues}
                      set={(patch) => setConfigValues((p) => ({ ...p, ...patch }))}
                      config={{}}
                      eff={(_g, _f, original) => original}
                      mark={() => {}}
                      models={modelOptions}
                    />
                  </>
                )}

                {selectedAdapter === "opencode_local" && (
                  <>
                    <WizardRuntimeFields
                      modelOptions={modelOptions}
                      isModelsLoading={adapterModelsLoading || adapterModelsFetching}
                      configValues={configValues}
                      onChange={(patch) => setConfigValues((p) => ({ ...p, ...patch }))}
                    />
                    <OpenCodeLocalConfigFields
                      mode="create"
                      isCreate={true}
                      adapterType="opencode_local"
                      values={configValues}
                      set={(patch) => setConfigValues((p) => ({ ...p, ...patch }))}
                      config={{}}
                      eff={(_g, _f, original) => original}
                      mark={() => {}}
                      models={modelOptions}
                    />
                  </>
                )}

                {selectedAdapter === "cursor" && (
                  <>
                    <WizardRuntimeFields
                      modelOptions={modelOptions}
                      isModelsLoading={adapterModelsLoading || adapterModelsFetching}
                      configValues={configValues}
                      onChange={(patch) => setConfigValues((p) => ({ ...p, ...patch }))}
                    />
                    <CursorLocalConfigFields
                      mode="create"
                      isCreate={true}
                      adapterType="cursor"
                      values={configValues}
                      set={(patch) => setConfigValues((p) => ({ ...p, ...patch }))}
                      config={{}}
                      eff={(_g, _f, original) => original}
                      mark={() => {}}
                      models={modelOptions}
                    />
                  </>
                )}

                {selectedAdapter === "process" && (
                  <>
                    <div className="px-3 py-2 border-b border-border">
                      <label className="text-xs text-muted-foreground">{t("adapter.command")}</label>
                      <input
                        className="mt-1 w-full bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40"
                        placeholder="node, python"
                        value={configValues.command}
                        onChange={(e) => setConfigValues((p) => ({ ...p, command: e.target.value }))}
                      />
                    </div>
                    <div className="px-3 py-2">
                      <label className="text-xs text-muted-foreground">{t("adapter.args")}</label>
                      <input
                        className="mt-1 w-full bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40"
                        placeholder="script.js"
                        value={configValues.args}
                        onChange={(e) => setConfigValues((p) => ({ ...p, args: e.target.value }))}
                      />
                    </div>
                    <div className="px-3 py-2">
                      <label className="text-xs text-muted-foreground">{t("agent.instructionsFilePath")}</label>
                      <input
                        className="mt-1 w-full bg-transparent outline-none text-sm border border-border rounded px-2 py-1.5 placeholder:text-muted-foreground/40"
                        placeholder={t("agent.instructionsFilePathPlaceholder")}
                        value={configValues.instructionsFilePath}
                        onChange={(e) =>
                          setConfigValues((p) => ({ ...p, instructionsFilePath: e.target.value }))
                        }
                      />
                    </div>
                  </>
                )}

                {selectedAdapter === "http" && (
                  <>
                    <div className="px-3 py-2">
                      <label className="text-xs text-muted-foreground">{t("adapter.webhookUrl")}</label>
                      <input
                        className="mt-1 w-full bg-transparent outline-none text-sm placeholder:text-muted-foreground/40"
                        placeholder="https://..."
                        value={configValues.url}
                        onChange={(e) => setConfigValues((p) => ({ ...p, url: e.target.value }))}
                      />
                    </div>
                    <div className="px-3 py-2">
                      <label className="text-xs text-muted-foreground">{t("agent.instructionsFilePath")}</label>
                      <input
                        className="mt-1 w-full bg-transparent outline-none text-sm border border-border rounded px-2 py-1.5 placeholder:text-muted-foreground/40"
                        placeholder={t("agent.instructionsFilePathPlaceholder")}
                        value={configValues.instructionsFilePath}
                        onChange={(e) =>
                          setConfigValues((p) => ({ ...p, instructionsFilePath: e.target.value }))
                        }
                      />
                    </div>
                  </>
                )}

                {selectedAdapter === "pi_local" && (
                  <PiLocalConfigFields
                    mode="create"
                    isCreate={true}
                    adapterType="pi_local"
                    values={configValues}
                    set={(patch) => setConfigValues((p) => ({ ...p, ...patch }))}
                    config={{}}
                    eff={(_g, _f, original) => original}
                    mark={() => {}}
                    models={modelOptions}
                  />
                )}

                {selectedAdapter === "openclaw_gateway" && (
                  <OpenClawGatewayConfigFields
                    mode="create"
                    isCreate={true}
                    adapterType="openclaw_gateway"
                    values={configValues}
                    set={(patch) => setConfigValues((p) => ({ ...p, ...patch }))}
                    config={{}}
                    eff={(_g, _f, original) => original}
                    mark={() => {}}
                    models={modelOptions}
                  />
                )}

                {selectedAdapter === "e2b" && (
                  <>
                    <E2bConfigFields
                      mode="create"
                      isCreate={true}
                      adapterType="e2b"
                      values={configValues}
                      set={(patch) => setConfigValues((p) => ({ ...p, ...patch }))}
                      config={{}}
                      eff={(_g, _f, original) => original}
                      mark={() => {}}
                      models={modelOptions}
                    />
                    <div className="px-3 py-2">
                      <label className="text-xs text-muted-foreground">{t("agent.instructionsFilePath")}</label>
                      <input
                        className="mt-1 w-full bg-transparent outline-none text-sm border border-border rounded px-2 py-1.5 placeholder:text-muted-foreground/40"
                        placeholder={t("agent.instructionsFilePathPlaceholder")}
                        value={configValues.instructionsFilePath}
                        onChange={(e) =>
                          setConfigValues((p) => ({ ...p, instructionsFilePath: e.target.value }))
                        }
                      />
                    </div>
                  </>
                )}

                {!["claude_local", "codex_local", "gemini_local", "opencode_local", "cursor", "pi_local", "openclaw_gateway", "process", "http", "e2b"].includes(selectedAdapter) && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    {t("agent.wizard.defaultAdapterConfig", { type: selectedAdapter })}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t("agent.wizard.runPolicy")}</span>
                  <button
                    onClick={() =>
                      setConfigValues((p) => ({ ...p, heartbeatEnabled: !p.heartbeatEnabled }))
                    }
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                      configValues.heartbeatEnabled ? "bg-primary" : "bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
                        configValues.heartbeatEnabled ? "translate-x-5" : "translate-x-1",
                      )}
                    />
                  </button>
                </div>

                {configValues.heartbeatEnabled && (
                  <div className="px-3 py-2">
                    <label className="text-xs text-muted-foreground">
                      {t("agent.wizard.heartbeatInterval")}
                    </label>
                    <select
                      className="mt-1 w-full bg-transparent outline-none text-sm"
                      value={configValues.intervalSec}
                      onChange={(e) =>
                        setConfigValues((p) => ({ ...p, intervalSec: Number(e.target.value) }))
                      }
                    >
                      <option value={60}>1 {t("common.minutes")}</option>
                      <option value={300}>5 {t("common.minutes")}</option>
                      <option value={600}>10 {t("common.minutes")}</option>
                      <option value={1800}>30 {t("common.minutes")}</option>
                      <option value={3600}>60 {t("common.minutes")}</option>
                    </select>
                  </div>
                )}
              </div>

              {!configValues.heartbeatEnabled && (
                <p className="text-xs text-muted-foreground bg-accent/20 rounded p-2">
                  {t("agent.wizard.onDemandNote")}
                </p>
              )}
            </div>
          )}

          {step === 5 && (
            <AgentWizardPreview
              configSummary={{
                name,
                title,
                role: effectiveRole,
                reportsTo: reportsTo || null,
                adapterType: configValues.adapterType,
                adapterConfig: getUIAdapter(configValues.adapterType).buildAdapterConfig(configValues),
                runtimeConfig: {
                  heartbeat: {
                    enabled: configValues.heartbeatEnabled,
                    intervalSec: configValues.intervalSec,
                    wakeOnDemand: true,
                    cooldownSec: 10,
                    maxConcurrentRuns: 1,
                  },
                },
              }}
              onConfirm={handleSubmit}
              isSubmitting={createAgent.isPending}
            />
          )}
        </div>

        {step < 5 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => step > 1 ? setStep((s) => (s - 1) as WizardStep) : onClose()}
            >
              {step > 1 ? <ArrowLeft className="h-4 w-4 mr-1" /> : null}
              {step > 1 ? t("common.back") : t("common.cancel")}
            </Button>

            {formError && (
              <p className="text-xs text-destructive flex-1 text-center mx-2">{formError}</p>
            )}

            <Button
              variant="default"
              size="sm"
              onClick={() => setStep((s) => (s + 1) as WizardStep)}
              disabled={!canGoNext}
            >
              {t("common.next")}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

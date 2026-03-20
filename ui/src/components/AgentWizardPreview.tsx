import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AdapterEnvironmentTestResult } from "@paperclipai/shared";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";

interface AgentWizardPreviewProps {
  configSummary: {
    name: string;
    title: string;
    role: string;
    reportsTo: string | null;
    adapterType: string;
    adapterConfig: Record<string, unknown>;
    runtimeConfig: Record<string, unknown>;
  };
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export function AgentWizardPreview({
  configSummary,
  onConfirm,
  isSubmitting,
}: AgentWizardPreviewProps) {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();
  const [showJson, setShowJson] = useState(false);
  const [envTestResult, setEnvTestResult] = useState<AdapterEnvironmentTestResult | null>(null);
  const [envTestLoading, setEnvTestLoading] = useState(false);
  const [envTestError, setEnvTestError] = useState<string | null>(null);

  async function handleTestEnv() {
    if (!selectedCompanyId) return;
    setEnvTestLoading(true);
    setEnvTestError(null);
    setEnvTestResult(null);
    try {
      const result = await agentsApi.testEnvironment(selectedCompanyId, configSummary.adapterType, {
        adapterConfig: configSummary.adapterConfig,
      });
      setEnvTestResult(result);
    } catch (err) {
      setEnvTestError(err instanceof Error ? err.message : String(err));
    } finally {
      setEnvTestLoading(false);
    }
  }

  const previewJson = JSON.stringify(
    {
      name: configSummary.name,
      role: configSummary.role,
      adapterType: configSummary.adapterType,
      adapterConfig: configSummary.adapterConfig,
      runtimeConfig: configSummary.runtimeConfig,
    },
    null,
    2,
  );

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="rounded-lg border border-border p-4 space-y-2 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{t("agent.wizard.step5Config")}</span>
            <button
              onClick={() => setShowJson((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showJson ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showJson ? t("agent.wizard.hideJson") : t("agent.wizard.showJson")}
            </button>
          </div>

          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("agent.name")}:</span>
              <span className="font-medium">{configSummary.name || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("agent.role")}:</span>
              <span className="font-medium">{configSummary.role}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("agent.adapter")}:</span>
              <span className="font-medium">{configSummary.adapterType}</span>
            </div>
          </div>

          {showJson && (
            <pre className="mt-2 rounded bg-muted/50 p-2 text-[11px] font-mono text-muted-foreground overflow-auto max-h-48">
              {previewJson}
            </pre>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestEnv}
            disabled={envTestLoading || !selectedCompanyId}
          >
            {envTestLoading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : null}
            {t("agent.wizard.testEnvironment")}
          </Button>

          {envTestResult && (
            <div className="flex items-center gap-1.5">
              {envTestResult.status === "pass" ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-xs text-muted-foreground">
                {envTestResult.status === "pass"
                  ? t("agent.wizard.envOk")
                  : envTestResult.status === "warn"
                    ? t("agent.wizard.envWarn")
                    : t("agent.wizard.envFailed")}
              </span>
            </div>
          )}

          {envTestError && (
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">{envTestError}</span>
            </div>
          )}
        </div>
      </div>

      <Button
        className="w-full"
        size="lg"
        onClick={onConfirm}
        disabled={isSubmitting || !configSummary.name.trim()}
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : null}
        {t("agent.createAgent")}
      </Button>
    </div>
  );
}

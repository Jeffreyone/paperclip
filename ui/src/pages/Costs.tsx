import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { costsApi } from "../api/costs";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useTranslation } from "react-i18next";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { formatCents, formatTokens } from "../lib/utils";
import { Identity } from "../components/Identity";
import { StatusBadge } from "../components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign } from "lucide-react";

type DatePreset = "mtd" | "7d" | "30d" | "ytd" | "all" | "custom";

function computeRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  switch (preset) {
    case "mtd": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: d.toISOString(), to };
    }
    case "7d": {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { from: d.toISOString(), to };
    }
    case "30d": {
      const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { from: d.toISOString(), to };
    }
    case "ytd": {
      const d = new Date(now.getFullYear(), 0, 1);
      return { from: d.toISOString(), to };
    }
    case "all":
      return { from: "", to: "" };
    case "custom":
      return { from: "", to: "" };
  }
}

export function Costs() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { t } = useTranslation("costs");

  const PRESET_LABELS: Record<DatePreset, string> = {
    mtd: t("datePresets.mtd"),
    "7d": t("datePresets.7d"),
    "30d": t("datePresets.30d"),
    ytd: t("datePresets.ytd"),
    all: t("datePresets.all"),
    custom: t("datePresets.custom"),
  };

  const [preset, setPreset] = useState<DatePreset>("mtd");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    setBreadcrumbs([{ label: t("title") }]);
  }, [setBreadcrumbs, t]);

  const { from, to } = useMemo(() => {
    if (preset === "custom") {
      return {
        from: customFrom ? new Date(customFrom).toISOString() : "",
        to: customTo ? new Date(customTo + "T23:59:59.999Z").toISOString() : "",
      };
    }
    return computeRange(preset);
  }, [preset, customFrom, customTo]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.costs(selectedCompanyId!, from || undefined, to || undefined),
    queryFn: async () => {
      const [summary, byAgent, byProject] = await Promise.all([
        costsApi.summary(selectedCompanyId!, from || undefined, to || undefined),
        costsApi.byAgent(selectedCompanyId!, from || undefined, to || undefined),
        costsApi.byProject(selectedCompanyId!, from || undefined, to || undefined),
      ]);
      return { summary, byAgent, byProject };
    },
    enabled: !!selectedCompanyId,
  });

   if (!selectedCompanyId) {
     return <EmptyState icon={DollarSign} message={t("noCompanySelected")} />;
   }

  if (isLoading) {
    return <PageSkeleton variant="costs" />;
  }

  const presetKeys: DatePreset[] = ["mtd", "7d", "30d", "ytd", "all", "custom"];

  return (
    <div className="space-y-6">
       {/* Date range selector */}
       <div className="flex flex-wrap items-center gap-2">
         {presetKeys.map((p) => (
           <Button
             key={p}
             variant={preset === p ? "secondary" : "ghost"}
             size="sm"
             onClick={() => setPreset(p)}
           >
             {PRESET_LABELS[p]}
           </Button>
         ))}
         {preset === "custom" && (
           <div className="flex items-center gap-2 ml-2">
             <input
               type="date"
               value={customFrom}
               onChange={(e) => setCustomFrom(e.target.value)}
               className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
             />
             <span className="text-sm text-muted-foreground">{t("dateRange.to")}</span>
             <input
               type="date"
               value={customTo}
               onChange={(e) => setCustomTo(e.target.value)}
               className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
             />
           </div>
         )}
       </div>

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {data && (
        <>
          {/* Summary card */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{PRESET_LABELS[preset]}</p>
                  {data.summary.budgetCents > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {t("utilized", { percent: data.summary.utilizationPercent })}
                    </p>
                  )}
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {formatCents(data.summary.spendCents)}{" "}
                <span className="text-base font-normal text-muted-foreground">
                  {data.summary.budgetCents > 0
                    ? `/ ${formatCents(data.summary.budgetCents)}`
                    : t("unlimitedBudget")}
                </span>
              </p>
              {data.summary.budgetCents > 0 && (
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-[width,background-color] duration-150 ${
                      data.summary.utilizationPercent > 90
                        ? "bg-red-400"
                        : data.summary.utilizationPercent > 70
                          ? "bg-yellow-400"
                          : "bg-green-400"
                    }`}
                    style={{ width: `${Math.min(100, data.summary.utilizationPercent)}%` }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* By Agent / By Project */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">{t("byAgent")}</h3>
                {data.byAgent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noCostEvents")}</p>
                ) : (
                  <div className="space-y-2">
                    {data.byAgent.map((row) => (
                      <div key={row.agentId} className="space-y-1.5">
                        <div className="flex items-start justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <Identity
                              name={row.agentName ?? row.agentId}
                              size="sm"
                            />
                            {row.agentStatus === "terminated" && (
                              <StatusBadge status="terminated" />
                            )}
                            {row.agentStatus === "paused" && (
                              <StatusBadge status="paused" />
                            )}
                          </div>
                          <div className="text-right shrink-0 ml-2 tabular-nums">
                            <span className="font-medium block">{formatCents(row.costCents)}</span>
                            <span className="text-xs text-muted-foreground block">
                              {t("tokens", { input: formatTokens(row.inputTokens), output: formatTokens(row.outputTokens) })}
                            </span>
                            {(row.apiRunCount > 0 || row.subscriptionRunCount > 0) && (
                              <span className="text-xs text-muted-foreground block">
                                {row.apiRunCount > 0 ? t("apiRuns", { count: row.apiRunCount }) : null}
                                {row.apiRunCount > 0 && row.subscriptionRunCount > 0 ? " | " : null}
                                {row.subscriptionRunCount > 0
                                  ? t("subscriptionRuns", { count: row.subscriptionRunCount, inputIn: formatTokens(row.subscriptionInputTokens), outputOut: formatTokens(row.subscriptionOutputTokens) })
                                  : null}
                              </span>
                            )}
                          </div>
                        </div>
                        {row.budgetMonthlyCents > 0 && (
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>
                                {row.agentStatus === "paused"
                                  ? t("budgetPaused", { spent: formatCents(row.spentMonthlyCents), budget: formatCents(row.budgetMonthlyCents) })
                                  : t("budgetUtilization", { spent: formatCents(row.spentMonthlyCents), budget: formatCents(row.budgetMonthlyCents) })}
                              </span>
                              <span>
                                {row.utilizationPercent > 100
                                  ? t("budgetExceeded")
                                  : `${row.utilizationPercent}%`}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-[width,background-color] duration-150 ${
                                  row.utilizationPercent >= 100
                                    ? "bg-red-500"
                                    : row.utilizationPercent >= 80
                                      ? "bg-yellow-400"
                                      : "bg-green-400"
                                }`}
                                style={{ width: `${Math.min(100, row.utilizationPercent)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">{t("byProject")}</h3>
                {data.byProject.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noProjectCosts")}</p>
                ) : (
                  <div className="space-y-2">
                    {data.byProject.map((row) => (
                      <div
                        key={row.projectId ?? "na"}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="truncate">
                          {row.projectName ?? row.projectId ?? t("unattributed")}
                        </span>
                        <span className="font-medium tabular-nums">{formatCents(row.costCents)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

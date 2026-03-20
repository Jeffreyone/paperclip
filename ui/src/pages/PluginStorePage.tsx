import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Puzzle, Search, Download, Check } from "lucide-react";
import { Link } from "@/lib/router";
import { useCompany } from "@/context/CompanyContext";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { pluginsApi } from "@/api/plugins";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/context/ToastContext";
import { cn } from "@/lib/utils";
import { PageSkeleton } from "@/components/PageSkeleton";

const CATEGORY_EMOJI: Record<string, string> = {
  ui: "🎨",
  automation: "⚙️",
  workspace: "📁",
  connector: "🔗",
  devtools: "🔧",
  analytics: "📊",
  communication: "💬",
  default: "🔌",
};

function getPluginEmoji(categories: string[]): string {
  for (const cat of categories) {
    const lower = cat.toLowerCase();
    if (CATEGORY_EMOJI[lower]) return CATEGORY_EMOJI[lower];
  }
  return CATEGORY_EMOJI["default"];
}

interface PluginStoreCardProps {
  plugin: {
    packageName: string;
    displayName: string;
    description: string;
    version: string;
    author: string;
    categories: string[];
    localPath: string;
  };
  installed: boolean;
  installPending: boolean;
  onInstall: () => void;
}

function PluginStoreCard({ plugin, installed, installPending, onInstall }: PluginStoreCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="flex flex-col gap-3 p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-lg">
          {getPluginEmoji(plugin.categories)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm leading-tight truncate" title={plugin.displayName}>
              {plugin.displayName}
            </span>
            <Badge variant="outline" className="text-xs shrink-0">
              v{plugin.version}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{plugin.author}</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1">
        {plugin.description}
      </p>

      {plugin.categories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {plugin.categories.map((cat) => (
            <Badge key={cat} variant="secondary" className="text-xs capitalize">
              {cat}
            </Badge>
          ))}
        </div>
      )}

      <div className="pt-1">
        {installed ? (
          <Button variant="outline" size="sm" className="w-full gap-1.5" disabled>
            <Check className="h-3.5 w-3.5 text-green-600" />
            {t("pluginStore.installed")}
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full gap-1.5"
            onClick={onInstall}
            disabled={installPending}
          >
            <Download className="h-3.5 w-3.5" />
            {installPending ? t("pluginStore.installing") : t("pluginStore.install")}
          </Button>
        )}
      </div>
    </Card>
  );
}

export function PluginStorePage() {
  const { t } = useTranslation();
  const { selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      {
        label: selectedCompany?.name ?? t("pluginManager.companyFallback"),
        href: "/dashboard",
      },
      { label: t("pluginStore.title") },
    ]);
  }, [selectedCompany?.name, setBreadcrumbs, t]);

  const { data: examples, isLoading: examplesLoading } = useQuery({
    queryKey: queryKeys.plugins.examples,
    queryFn: () => pluginsApi.listExamples(),
  });

  const { data: installedPlugins } = useQuery({
    queryKey: queryKeys.plugins.all,
    queryFn: () => pluginsApi.list(),
  });

  const installMutation = useMutation({
    mutationFn: (params: { packageName: string; isLocalPath?: boolean }) =>
      pluginsApi.install(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.examples });
      pushToast({ title: t("pluginManager.installedSuccessfully"), tone: "success" });
    },
    onError: (err: Error) => {
      pushToast({ title: t("pluginManager.failedToInstall"), body: err.message, tone: "error" });
    },
  });

  const installedByPackageName = useMemo(
    () => new Map((installedPlugins ?? []).map((p) => [p.packageName, p])),
    [installedPlugins],
  );

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const ex of examples ?? []) {
      for (const c of ex.categories) cats.add(c);
    }
    return Array.from(cats).sort();
  }, [examples]);

  const filteredExamples = useMemo(() => {
    if (!examples) return [];
    return examples.filter((ex) => {
      const matchesSearch =
        !searchQuery ||
        ex.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ex.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ex.packageName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        !activeCategory || ex.categories.includes(activeCategory);

      return matchesSearch && matchesCategory;
    });
  }, [examples, searchQuery, activeCategory]);

  if (examplesLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Puzzle className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-xl font-semibold">{t("pluginStore.title")}</h1>
        </div>
        <PageSkeleton variant="list" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Puzzle className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{t("pluginStore.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("pluginStore.subtitle")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("pluginStore.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {allCategories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              !activeCategory
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground",
            )}
          >
            {t("pluginStore.allCategories")}
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                activeCategory === cat
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground",
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-amber-700 dark:text-amber-300">
            {t("pluginStore.alphaLabel")}
          </span>{" "}
          {t("pluginStore.alphaNote")}
        </p>
      </div>

      {filteredExamples.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center">
          <Puzzle className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">{t("pluginStore.noResults")}</p>
          {searchQuery && (
            <Button
              variant="link"
              size="sm"
              className="mt-2 text-xs"
              onClick={() => setSearchQuery("")}
            >
              {t("pluginStore.clearSearch")}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredExamples.map((example) => {
            const installedPlugin = installedByPackageName.get(example.packageName);
            const isInstalled = Boolean(installedPlugin);
            const installPending =
              installMutation.isPending &&
              installMutation.variables?.packageName === example.localPath;

            return (
              <PluginStoreCard
                key={example.packageName}
                plugin={example}
                installed={isInstalled}
                installPending={installPending}
                onInstall={() =>
                  installMutation.mutate({
                    packageName: example.localPath,
                    isLocalPath: true,
                  })
                }
              />
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t("pluginStore.pluginCount", { count: filteredExamples.length })}
      </p>

      <div className="pt-2 border-t">
        <Link
          to="/instance/settings/plugins"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
        >
          {t("pluginStore.manageInstalled")}
        </Link>
      </div>
    </div>
  );
}

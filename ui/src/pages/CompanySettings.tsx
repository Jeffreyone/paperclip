import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { companiesApi } from "../api/companies";
import { accessApi } from "../api/access";
import { secretsApi } from "../api/secrets";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { PageTabBar } from "../components/PageTabBar";
import { Settings, Check, Key, Plus, RotateCw, Trash2, ShieldCheck } from "lucide-react";
import { CompanyPatternIcon } from "../components/CompanyPatternIcon";
import {
  Field,
  ToggleField,
  HintIcon
} from "../components/agent-config-primitives";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import type { CompanySecret, SecretProvider } from "@paperclipai/shared";
import { formatDate } from "../lib/utils";

type AgentSnippetInput = {
  onboardingTextUrl: string;
  connectionCandidates?: string[] | null;
  testResolutionUrl?: string | null;
};

export function CompanySettings() {
  const {
    companies,
    selectedCompany,
    selectedCompanyId,
    setSelectedCompanyId
  } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  // General settings local state
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [brandColor, setBrandColor] = useState("");
  const [activeTab, setActiveTab] = useState<"general" | "secrets">("general");

  // Sync local state from selected company
  useEffect(() => {
    if (!selectedCompany) return;
    setCompanyName(selectedCompany.name);
    setDescription(selectedCompany.description ?? "");
    setBrandColor(selectedCompany.brandColor ?? "");
  }, [selectedCompany]);

  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSnippet, setInviteSnippet] = useState<string | null>(null);
  const [snippetCopied, setSnippetCopied] = useState(false);
  const [snippetCopyDelightId, setSnippetCopyDelightId] = useState(0);

  const generalDirty =
    !!selectedCompany &&
    (companyName !== selectedCompany.name ||
      description !== (selectedCompany.description ?? "") ||
      brandColor !== (selectedCompany.brandColor ?? ""));

  const generalMutation = useMutation({
    mutationFn: (data: {
      name: string;
      description: string | null;
      brandColor: string | null;
    }) => companiesApi.update(selectedCompanyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    }
  });

  const settingsMutation = useMutation({
    mutationFn: (requireApproval: boolean) =>
      companiesApi.update(selectedCompanyId!, {
        requireBoardApprovalForNewAgents: requireApproval
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    }
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      accessApi.createOpenClawInvitePrompt(selectedCompanyId!),
    onSuccess: async (invite) => {
      setInviteError(null);
      const base = window.location.origin.replace(/\/+$/, "");
      const onboardingTextLink =
        invite.onboardingTextUrl ??
        invite.onboardingTextPath ??
        `/api/invites/${invite.token}/onboarding.txt`;
      const absoluteUrl = onboardingTextLink.startsWith("http")
        ? onboardingTextLink
        : `${base}${onboardingTextLink}`;
      setSnippetCopied(false);
      setSnippetCopyDelightId(0);
      let snippet: string;
      try {
        const manifest = await accessApi.getInviteOnboarding(invite.token);
        snippet = buildAgentSnippet({
          onboardingTextUrl: absoluteUrl,
          connectionCandidates:
            manifest.onboarding.connectivity?.connectionCandidates ?? null,
          testResolutionUrl:
            manifest.onboarding.connectivity?.testResolutionEndpoint?.url ??
            null
        });
      } catch {
        snippet = buildAgentSnippet({
          onboardingTextUrl: absoluteUrl,
          connectionCandidates: null,
          testResolutionUrl: null
        });
      }
      setInviteSnippet(snippet);
      try {
        await navigator.clipboard.writeText(snippet);
        setSnippetCopied(true);
        setSnippetCopyDelightId((prev) => prev + 1);
        setTimeout(() => setSnippetCopied(false), 2000);
      } catch {
        /* clipboard may not be available */
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.sidebarBadges(selectedCompanyId!)
      });
    },
    onError: (err) => {
      setInviteError(
        err instanceof Error ? err.message : t("company.failedToCreateInvite")
      );
    }
  });

  useEffect(() => {
    setInviteError(null);
    setInviteSnippet(null);
    setSnippetCopied(false);
    setSnippetCopyDelightId(0);
  }, [selectedCompanyId]);
  const archiveMutation = useMutation({
    mutationFn: ({
      companyId,
      nextCompanyId
    }: {
      companyId: string;
      nextCompanyId: string | null;
    }) => companiesApi.archive(companyId).then(() => ({ nextCompanyId })),
    onSuccess: async ({ nextCompanyId }) => {
      if (nextCompanyId) {
        setSelectedCompanyId(nextCompanyId);
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.companies.all
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.companies.stats
      });
    }
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? t("company.company"), href: "/dashboard" },
      { label: t("company.settings") }
    ]);
  }, [setBreadcrumbs, selectedCompany?.name, t]);

  if (!selectedCompany) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("company.noCompanySelected")}
      </div>
    );
  }

  function handleSaveGeneral() {
    generalMutation.mutate({
      name: companyName.trim(),
      description: description.trim() || null,
      brandColor: brandColor || null
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t("company.settings")}</h1>
        </div>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "general" | "secrets")}
        >
          <PageTabBar
            items={[
              { value: "general", label: t("company.general") },
              { value: "secrets", label: t("company.secrets") },
            ]}
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "general" | "secrets")}
          />
        </Tabs>
      </div>

      {activeTab === "general" && (
        <div className="max-w-2xl space-y-6">
          {/* General */}
          <div className="space-y-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("company.general")}
            </div>
            <div className="space-y-3 rounded-md border border-border px-4 py-4">
              <Field label={t("company.name")} hint={t("company.nameHint")}>
                <input
                  className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </Field>
              <Field
                label={t("company.description")}
                hint={t("company.descriptionHint")}
              >
                <input
                  className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                  type="text"
                  value={description}
                  placeholder={t("company.optionalDescription")}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* Appearance */}
          <div className="space-y-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("company.appearance")}
            </div>
            <div className="space-y-3 rounded-md border border-border px-4 py-4">
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <CompanyPatternIcon
                    companyName={companyName || selectedCompany.name}
                    brandColor={brandColor || null}
                    className="rounded-[14px]"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Field
                    label={t("company.brandColor")}
                    hint={t("company.brandColorHint")}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={brandColor || "#6366f1"}
                        onChange={(e) => setBrandColor(e.target.value)}
                        className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0"
                      />
                      <input
                        type="text"
                        value={brandColor}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "" || /^#[0-9a-fA-F]{0,6}$/.test(v)) {
                            setBrandColor(v);
                          }
                        }}
                        placeholder={t("company.auto")}
                        className="w-28 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm font-mono outline-none"
                      />
                      {brandColor && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setBrandColor("")}
                          className="text-xs text-muted-foreground"
                        >
                          {t("common.clear")}
                        </Button>
                      )}
                    </div>
                  </Field>
                </div>
              </div>
            </div>
          </div>

          {/* Save button for General + Appearance */}
          {generalDirty && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSaveGeneral}
                disabled={generalMutation.isPending || !companyName.trim()}
              >
                {generalMutation.isPending ? t("company.saving") : t("company.saveChanges")}
              </Button>
              {generalMutation.isSuccess && (
                <span className="text-xs text-muted-foreground">{t("company.saved")}</span>
              )}
              {generalMutation.isError && (
                <span className="text-xs text-destructive">
                  {generalMutation.error instanceof Error
                    ? generalMutation.error.message
                    : t("company.failedToSave")}
                </span>
              )}
            </div>
          )}

          {/* Hiring */}
          <div className="space-y-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("company.hiring")}
            </div>
            <div className="rounded-md border border-border px-4 py-3">
              <ToggleField
                label={t("company.requireBoardApprovalForNewHires")}
                hint={t("company.requireBoardApprovalHint")}
                checked={!!selectedCompany.requireBoardApprovalForNewAgents}
                onChange={(v) => settingsMutation.mutate(v)}
              />
            </div>
          </div>

          {/* Invites */}
          <div className="space-y-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("company.invites")}
            </div>
            <div className="space-y-3 rounded-md border border-border px-4 py-4">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">
                  {t("company.generateOpenClawInviteSnippet")}
                </span>
                <HintIcon text={t("company.openClawInviteHint")} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => inviteMutation.mutate()}
                  disabled={inviteMutation.isPending}
                >
                  {inviteMutation.isPending
                    ? t("company.generating")
                    : t("company.generateOpenClawInvitePrompt")}
                </Button>
              </div>
              {inviteError && (
                <p className="text-sm text-destructive">{inviteError}</p>
              )}
              {inviteSnippet && (
                <div className="rounded-md border border-border bg-muted/30 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      {t("company.openClawInvitePrompt")}
                    </div>
                    {snippetCopied && (
                      <span
                        key={snippetCopyDelightId}
                        className="flex items-center gap-1 text-xs text-green-600 animate-pulse"
                      >
                        <Check className="h-3 w-3" />
                        {t("company.copied")}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 space-y-1.5">
                    <textarea
                      className="h-[28rem] w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none"
                      value={inviteSnippet}
                      readOnly
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(inviteSnippet);
                            setSnippetCopied(true);
                            setSnippetCopyDelightId((prev) => prev + 1);
                            setTimeout(() => setSnippetCopied(false), 2000);
                          } catch {
                            /* clipboard may not be available */
                          }
                        }}
                      >
                        {snippetCopied ? t("company.copiedSnippet") : t("company.copySnippet")}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="space-y-4">
            <div className="text-xs font-medium text-destructive uppercase tracking-wide">
              {t("company.dangerZone")}
            </div>
            <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-4">
              <p className="text-sm text-muted-foreground">
                {t("company.archiveThisCompany")}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={
                    archiveMutation.isPending ||
                    selectedCompany.status === "archived"
                  }
                  onClick={() => {
                    if (!selectedCompanyId) return;
                    const confirmed = window.confirm(t("company.archiveCompanyConfirm", { name: selectedCompany.name }));
                    if (!confirmed) return;
                    const nextCompanyId =
                      companies.find(
                        (company) =>
                          company.id !== selectedCompanyId &&
                          company.status !== "archived"
                      )?.id ?? null;
                    archiveMutation.mutate({
                      companyId: selectedCompanyId,
                      nextCompanyId
                    });
                  }}
                >
                  {archiveMutation.isPending
                    ? t("company.archiving")
                    : selectedCompany.status === "archived"
                    ? t("company.alreadyArchived")
                    : t("company.archiveCompany")}
                </Button>
                {archiveMutation.isError && (
                  <span className="text-xs text-destructive">
                    {archiveMutation.error instanceof Error
                      ? archiveMutation.error.message
                      : t("company.failedToArchive")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "secrets" && (
        <SecretsTab selectedCompanyId={selectedCompanyId!} />
      )}
    </div>
  );
}

function SecretsTab({ selectedCompanyId }: { selectedCompanyId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: secrets = [], isLoading } = useQuery({
    queryKey: queryKeys.secrets.list(selectedCompanyId),
    queryFn: () => secretsApi.list(selectedCompanyId),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createValue, setCreateValue] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [rotateSecret, setRotateSecret] = useState<CompanySecret | null>(null);
  const [rotateValue, setRotateValue] = useState("");
  const [rotateError, setRotateError] = useState<string | null>(null);

  const [deleteSecret, setDeleteSecret] = useState<CompanySecret | null>(null);

  const [editSecret, setEditSecret] = useState<CompanySecret | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: { name: string; value: string; description?: string | null }) =>
      secretsApi.create(selectedCompanyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.secrets.list(selectedCompanyId) });
      setCreateOpen(false);
      setCreateName("");
      setCreateValue("");
      setCreateDescription("");
      setCreateError(null);
    },
    onError: (err) => {
      setCreateError(err instanceof Error ? err.message : t("company.failedToCreateSecret"));
    },
  });

  const rotateMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      secretsApi.rotate(id, { value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.secrets.list(selectedCompanyId) });
      setRotateSecret(null);
      setRotateValue("");
      setRotateError(null);
    },
    onError: (err) => {
      setRotateError(err instanceof Error ? err.message : t("company.failedToRotateSecret"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name, description }: { id: string; name: string; description?: string | null }) =>
      secretsApi.update(id, { name, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.secrets.list(selectedCompanyId) });
      setEditSecret(null);
      setEditName("");
      setEditDescription("");
      setEditError(null);
    },
    onError: (err) => {
      setEditError(err instanceof Error ? err.message : t("company.failedToUpdateSecret"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => secretsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.secrets.list(selectedCompanyId) });
      setDeleteSecret(null);
    },
  });

  function openEdit(secret: CompanySecret) {
    setEditSecret(secret);
    setEditName(secret.name);
    setEditDescription(secret.description ?? "");
    setEditError(null);
  }

  function openRotate(secret: CompanySecret) {
    setRotateSecret(secret);
    setRotateValue("");
    setRotateError(null);
  }

  function confirmDelete(secret: CompanySecret) {
    setDeleteSecret(secret);
  }

  const providerLabels: Record<SecretProvider, string> = {
    local_encrypted: t("company.providerLocalEncrypted"),
    aws_secrets_manager: t("company.providerAws"),
    gcp_secret_manager: t("company.providerGcp"),
    vault: t("company.providerVault"),
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {t("company.secretsDescription")}
          </span>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          {t("company.newSecret")}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : secrets.length === 0 ? (
        <div className="rounded-md border border-border border-dashed px-4 py-8 text-center">
          <ShieldCheck className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t("company.noSecrets")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("company.noSecretsHint")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {secrets.map((secret) => (
            <div key={secret.id} className="rounded-md border border-border px-4 py-3 space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{secret.name}</span>
                    <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      v{secret.latestVersion}
                    </span>
                    <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {providerLabels[secret.provider] ?? secret.provider}
                    </span>
                  </div>
                  {secret.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{secret.description}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                    {t("company.secretCreated")}: {formatDate(secret.createdAt)} · {t("company.secretUpdated")}: {formatDate(secret.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => openEdit(secret)}
                  >
                    {t("common.edit")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => openRotate(secret)}
                  >
                    <RotateCw className="h-3 w-3 mr-1" />
                    {t("company.rotate")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => confirmDelete(secret)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setCreateError(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("company.createSecret")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label={t("company.secretName")} hint={t("company.secretNameHint")}>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder={t("company.secretNamePlaceholder")}
                className="font-mono"
              />
            </Field>
            <Field label={t("common.value")} hint={t("company.secretValueHint")}>
              <Input
                value={createValue}
                onChange={(e) => setCreateValue(e.target.value)}
                type="password"
                placeholder={t("company.secretValuePlaceholder")}
                className="font-mono"
              />
            </Field>
            <Field label={t("common.description")} hint={t("company.secretDescriptionHint")}>
              <Input
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder={t("company.optionalDescription")}
              />
            </Field>
            {createError && <p className="text-xs text-destructive">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setCreateOpen(false); setCreateError(null); }}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              disabled={!createName.trim() || !createValue || createMutation.isPending}
              onClick={() => createMutation.mutate({ name: createName.trim(), value: createValue, description: createDescription.trim() || undefined })}
            >
              {createMutation.isPending ? t("common.loading") : t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rotateSecret} onOpenChange={(open) => { if (!open) { setRotateSecret(null); setRotateError(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("company.rotateSecret")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("company.rotateSecretHint", { name: rotateSecret?.name })}
            </p>
            <Field label={t("common.newValue")}>
              <Input
                value={rotateValue}
                onChange={(e) => setRotateValue(e.target.value)}
                type="password"
                placeholder={t("company.secretValuePlaceholder")}
                className="font-mono"
              />
            </Field>
            {rotateError && <p className="text-xs text-destructive">{rotateError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setRotateSecret(null); setRotateError(null); }}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              disabled={!rotateValue || rotateMutation.isPending}
              onClick={() => rotateSecret && rotateMutation.mutate({ id: rotateSecret.id, value: rotateValue })}
            >
              {rotateMutation.isPending ? t("common.loading") : t("company.rotate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editSecret} onOpenChange={(open) => { if (!open) { setEditSecret(null); setEditError(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("company.editSecret")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label={t("company.secretName")}>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t("company.secretNamePlaceholder")}
                className="font-mono"
              />
            </Field>
            <Field label={t("common.description")}>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder={t("company.optionalDescription")}
              />
            </Field>
            {editError && <p className="text-xs text-destructive">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setEditSecret(null); setEditError(null); }}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              disabled={!editName.trim() || updateMutation.isPending}
              onClick={() => editSecret && updateMutation.mutate({ id: editSecret.id, name: editName.trim(), description: editDescription.trim() || undefined })}
            >
              {updateMutation.isPending ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteSecret} onOpenChange={(open) => { if (!open) setDeleteSecret(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("company.deleteSecret")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("company.deleteSecretConfirm", { name: deleteSecret?.name })}
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteSecret(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteSecret && deleteMutation.mutate(deleteSecret.id)}
            >
              {deleteMutation.isPending ? t("common.loading") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function buildAgentSnippet(input: AgentSnippetInput) {
  const candidateUrls = buildCandidateOnboardingUrls(input);
  const resolutionTestUrl = buildResolutionTestUrl(input);

  const candidateList =
    candidateUrls.length > 0
      ? candidateUrls.map((u) => `- ${u}`).join("\n")
      : "- (No candidate URLs available yet.)";

  const connectivityBlock =
    candidateUrls.length === 0
      ? `No candidate URLs are available. Ask your user to configure a reachable hostname in Paperclip, then retry.
Suggested steps:
- choose a hostname that resolves to the Paperclip host from your runtime
- run: pnpm paperclipai allowed-hostname <host>
- restart Paperclip
- verify with: curl -fsS http://<host>:3100/api/health
- regenerate this invite snippet`
      : `If none are reachable, ask your user to add a reachable hostname in Paperclip, restart, and retry.
Suggested command:
- pnpm paperclipai allowed-hostname <host>
Then verify with: curl -fsS <base-url>/api/health`;

  const resolutionLine = resolutionTestUrl
    ? `\nYou MUST test Paperclip-to-gateway reachability, call: ${resolutionTestUrl}?url=<urlencoded-gateway-url> (using the hostname that worked above). Do not assume your 172.x is necessarily reachable from Paperclip. Test it. `
    : "";

  return `You're invited to join a Paperclip organization.

The URLs you should try are:
${candidateList}

Connectivity guidance:
If you are running on a different machine than Paperclip, Paperclip must be reachable at one of the hostnames used above.
Verify the hostname works from your runtime with: GET <base-url>/api/health

${connectivityBlock}

For your "agentName", just use your own agent name (OpenClaw or whatever your name is) and send it directly.
You also need to send a gateway URL that Paperclip can access. Check your config and include that URL.${resolutionLine}

---

This onboarding flow is for OpenClaw Gateway.
When you submit the join request, use:
- \`adapterType: "openclaw_gateway"\`
- \`agentDefaultsPayload.url\` as your \`ws://\` or \`wss://\` gateway URL
- \`agentDefaultsPayload.headers["x-openclaw-token"]\` with your gateway token
- (legacy accepted) \`agentDefaultsPayload.headers["x-openclaw-auth"]\`
- Keep device auth enabled (recommended). If \`devicePrivateKeyPem\` is omitted, Paperclip will generate and persist one during join so pairing approvals remain stable.
- Only use \`disableDeviceAuth=true\` for special environments where pairing cannot be completed.

Do NOT use \`/v1/responses\` or \`/hooks/*\` in this join flow.

Before you do anything, please respond to your user that you understand the instructions and you're going to work on them. Then do the step above in another session called "paperclip-onboarding" and then tell your user when you're done. Update your user in intermediate steps along the way so they know what's going on.

Then after you've connected to Paperclip (exchanged keys etc.) you MUST review and follow the onboarding instructions in onboarding.txt they give you.

`;
}

function buildCandidateOnboardingUrls(input: AgentSnippetInput): string[] {
  const candidates = (input.connectionCandidates ?? [])
    .map((candidate) => candidate.trim())
    .filter(Boolean);
  const urls = new Set<string>();
  let onboardingUrl: URL | null = null;

  try {
    onboardingUrl = new URL(input.onboardingTextUrl);
    urls.add(onboardingUrl.toString());
  } catch {
    const trimmed = input.onboardingTextUrl.trim();
    if (trimmed) {
      urls.add(trimmed);
    }
  }

  if (!onboardingUrl) {
    for (const candidate of candidates) {
      urls.add(candidate);
    }
    return Array.from(urls);
  }

  const onboardingPath = `${onboardingUrl.pathname}${onboardingUrl.search}`;
  for (const candidate of candidates) {
    try {
      const base = new URL(candidate);
      urls.add(`${base.origin}${onboardingPath}`);
    } catch {
      urls.add(candidate);
    }
  }

  return Array.from(urls);
}

function buildResolutionTestUrl(input: AgentSnippetInput): string | null {
  const explicit = input.testResolutionUrl?.trim();
  if (explicit) return explicit;

  try {
    const onboardingUrl = new URL(input.onboardingTextUrl);
    const testPath = onboardingUrl.pathname.replace(
      /\/onboarding\.txt$/,
      "/test-resolution"
    );
    return `${onboardingUrl.origin}${testPath}`;
  } catch {
    return null;
  }
}

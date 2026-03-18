import type { TFunction } from "i18next";
import { UserPlus, Lightbulb, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

export function getApprovalTypeLabel(t: TFunction, type: string): string {
  if (type === "hire_agent") return t("approval.typeHireAgent");
  if (type === "approve_ceo_strategy") return t("approval.typeCeoStrategy");
  return type;
}

export const typeIcon: Record<string, typeof UserPlus> = {
  hire_agent: UserPlus,
  approve_ceo_strategy: Lightbulb,
};

export const defaultTypeIcon = ShieldCheck;

function PayloadField({ label, value }: { label: string; value: unknown }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs">{label}</span>
      <span>{String(value)}</span>
    </div>
  );
}

export function HireAgentPayload({ payload }: { payload: Record<string, unknown> }) {
  const { t } = useTranslation();

  return (
    <div className="mt-3 space-y-1.5 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs">{t("approval.fieldName")}</span>
        <span className="font-medium">{String(payload.name ?? "—")}</span>
      </div>
      <PayloadField label={t("approval.fieldRole")} value={payload.role} />
      <PayloadField label={t("approval.fieldTitle")} value={payload.title} />
      <PayloadField label={t("approval.fieldIcon")} value={payload.icon} />
      {!!payload.capabilities && (
        <div className="flex items-start gap-2">
          <span className="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs pt-0.5">{t("approval.fieldCapabilities")}</span>
          <span className="text-muted-foreground">{String(payload.capabilities)}</span>
        </div>
      )}
      {!!payload.adapterType && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs">{t("approval.fieldAdapter")}</span>
          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
            {String(payload.adapterType)}
          </span>
        </div>
      )}
    </div>
  );
}

export function CeoStrategyPayload({ payload }: { payload: Record<string, unknown> }) {
  const { t } = useTranslation();
  const plan = payload.plan ?? payload.description ?? payload.strategy ?? payload.text;
  return (
    <div className="mt-3 space-y-1.5 text-sm">
      <PayloadField label={t("approval.fieldTitle")} value={payload.title} />
      {!!plan && (
        <div className="mt-2 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground whitespace-pre-wrap font-mono text-xs max-h-48 overflow-y-auto">
          {String(plan)}
        </div>
      )}
      {!plan && (
        <pre className="mt-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground overflow-x-auto max-h-48">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function ApprovalPayloadRenderer({ type, payload }: { type: string; payload: Record<string, unknown> }) {
  if (type === "hire_agent") return <HireAgentPayload payload={payload} />;
  return <CeoStrategyPayload payload={payload} />;
}

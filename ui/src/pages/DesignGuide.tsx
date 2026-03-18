import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  CircleDot,
  Command as CommandIcon,
  DollarSign,
  Hexagon,
  History,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Mail,
  Plus,
  Search,
  Settings,
  Target,
  Trash2,
  Upload,
  User,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusIcon } from "@/components/StatusIcon";
import { PriorityIcon } from "@/components/PriorityIcon";
import { agentStatusDot, agentStatusDotDefault } from "@/lib/status-colors";
import { EntityRow } from "@/components/EntityRow";
import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { FilterBar, type FilterValue } from "@/components/FilterBar";
import { InlineEditor } from "@/components/InlineEditor";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Identity } from "@/components/Identity";

/* ------------------------------------------------------------------ */
/*  Section wrapper                                                    */
/* ------------------------------------------------------------------ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h3>
      <Separator />
      {children}
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">{title}</h4>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Color swatch                                                       */
/* ------------------------------------------------------------------ */

function Swatch({ name, cssVar }: { name: string; cssVar: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-8 w-8 rounded-md border border-border shrink-0"
        style={{ backgroundColor: `var(${cssVar})` }}
      />
      <div>
        <p className="text-xs font-mono">{cssVar}</p>
        <p className="text-xs text-muted-foreground">{name}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function DesignGuide() {
  const { t } = useTranslation();
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [selectValue, setSelectValue] = useState("in_progress");
  const [menuChecked, setMenuChecked] = useState(true);
  const [collapsibleOpen, setCollapsibleOpen] = useState(false);
  const [inlineText, setInlineText] = useState(t("designGuide.inlineEditor.clickToEdit"));
  const [inlineTitle, setInlineTitle] = useState(t("designGuide.inlineEditor.editableTitle"));
  const [inlineDesc, setInlineDesc] = useState(
    t("designGuide.inlineEditor.editableDescription")
  );
  const [filters, setFilters] = useState<FilterValue[]>([
    { key: "status", label: t("designGuide.filter.status"), value: t("designGuide.filter.active") },
    { key: "priority", label: t("designGuide.filter.priority"), value: t("designGuide.filter.high") },
  ]);

  return (
    <div className="space-y-10 max-w-4xl">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-bold">{t("designGuide.pageTitle")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("designGuide.pageDescription")}
        </p>
      </div>

      {/* ============================================================ */}
      {/*  COVERAGE                                                     */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.componentCoverage.title")}>
        <p className="text-sm text-muted-foreground">
          {t("designGuide.section.componentCoverage.description")}
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          <SubSection title={t("designGuide.section.componentCoverage.uiPrimitives")}>
            <div className="flex flex-wrap gap-2">
              {[
                "avatar", "badge", "breadcrumb", "button", "card", "checkbox", "collapsible",
                "command", "dialog", "dropdownMenu", "input", "label", "popover", "scrollArea",
                "select", "separator", "sheet", "skeleton", "tabs", "textarea", "tooltip",
              ].map((name) => (
                <Badge key={name} variant="outline" className="font-mono text-[10px]">
                  {t(`designGuide.section.componentCoverage.uiPrimitiveNames.${name}`)}
                </Badge>
              ))}
            </div>
          </SubSection>
          <SubSection title={t("designGuide.section.componentCoverage.appComponents")}>
            <div className="flex flex-wrap gap-2">
              {[
                "statusBadge", "statusIcon", "priorityIcon", "entityRow", "emptyState", "metricCard",
                "filterBar", "inlineEditor", "pageSkeleton", "identity", "commentThread", "markdownEditor",
                "propertiesPanel", "sidebar", "commandPalette",
              ].map((name) => (
                <Badge key={name} variant="ghost" className="font-mono text-[10px]">
                  {t(`designGuide.section.componentCoverage.appComponentNames.${name}`)}
                </Badge>
              ))}
            </div>
          </SubSection>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  COLORS                                                       */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.colors.title")}>
        <SubSection title={t("designGuide.section.colors.core")}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Swatch name={t("designGuide.swatch.background")} cssVar="--background" />
            <Swatch name={t("designGuide.swatch.foreground")} cssVar="--foreground" />
            <Swatch name={t("designGuide.swatch.card")} cssVar="--card" />
            <Swatch name={t("designGuide.swatch.primary")} cssVar="--primary" />
            <Swatch name={t("designGuide.swatch.primaryForeground")} cssVar="--primary-foreground" />
            <Swatch name={t("designGuide.swatch.secondary")} cssVar="--secondary" />
            <Swatch name={t("designGuide.swatch.muted")} cssVar="--muted" />
            <Swatch name={t("designGuide.swatch.mutedForeground")} cssVar="--muted-foreground" />
            <Swatch name={t("designGuide.swatch.accent")} cssVar="--accent" />
            <Swatch name={t("designGuide.swatch.destructive")} cssVar="--destructive" />
            <Swatch name={t("designGuide.swatch.border")} cssVar="--border" />
            <Swatch name={t("designGuide.swatch.ring")} cssVar="--ring" />
          </div>
        </SubSection>

        <SubSection title={t("designGuide.section.colors.sidebar")}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Swatch name={t("designGuide.swatch.sidebar")} cssVar="--sidebar" />
            <Swatch name={t("designGuide.swatch.sidebarBorder")} cssVar="--sidebar-border" />
          </div>
        </SubSection>

        <SubSection title={t("designGuide.section.colors.chart")}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Swatch name={t("designGuide.swatch.chart1")} cssVar="--chart-1" />
            <Swatch name={t("designGuide.swatch.chart2")} cssVar="--chart-2" />
            <Swatch name={t("designGuide.swatch.chart3")} cssVar="--chart-3" />
            <Swatch name={t("designGuide.swatch.chart4")} cssVar="--chart-4" />
            <Swatch name={t("designGuide.swatch.chart5")} cssVar="--chart-5" />
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  TYPOGRAPHY                                                   */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.typography.title")}>
        <div className="space-y-3">
          <h2 className="text-xl font-bold">{t("designGuide.section.typography.pageTitle")}</h2>
          <h2 className="text-lg font-semibold">{t("designGuide.section.typography.sectionTitle")}</h2>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t("designGuide.section.typography.sectionHeading")}
          </h3>
          <p className="text-sm font-medium">{t("designGuide.section.typography.cardTitle")}</p>
          <p className="text-sm font-semibold">{t("designGuide.section.typography.cardTitleAlt")}</p>
          <p className="text-sm">{t("designGuide.section.typography.bodyText")}</p>
          <p className="text-sm text-muted-foreground">
            {t("designGuide.section.typography.mutedDescription")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("designGuide.section.typography.tinyLabel")}
          </p>
          <p className="text-sm font-mono text-muted-foreground">
            {t("designGuide.section.typography.monoIdentifier")}
          </p>
          <p className="text-2xl font-bold">{t("designGuide.section.typography.largeStat")}</p>
          <p className="font-mono text-xs">{t("designGuide.section.typography.logCodeText")}</p>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  SPACING & RADIUS                                             */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.radius.title")}>
        <div className="flex items-end gap-4 flex-wrap">
          {[
            ["sm", "var(--radius-sm)"],
            ["md", "var(--radius-md)"],
            ["lg", "var(--radius-lg)"],
            ["xl", "var(--radius-xl)"],
            ["full", "9999px"],
          ].map(([label, radius]) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div
                className="h-12 w-12 bg-primary"
                style={{ borderRadius: radius }}
              />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  BUTTONS                                                      */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.buttons.title")}>
        <SubSection title={t("designGuide.section.buttons.variants")}>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="default">{t("designGuide.section.buttons.default")}</Button>
            <Button variant="secondary">{t("designGuide.section.buttons.secondary")}</Button>
            <Button variant="outline">{t("designGuide.section.buttons.outline")}</Button>
            <Button variant="ghost">{t("designGuide.section.buttons.ghost")}</Button>
            <Button variant="destructive">{t("designGuide.section.buttons.destructive")}</Button>
            <Button variant="link">{t("designGuide.section.buttons.link")}</Button>
          </div>
        </SubSection>

        <SubSection title={t("designGuide.section.buttons.sizes")}>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="xs">{t("designGuide.section.buttons.extraSmall")}</Button>
            <Button size="sm">{t("designGuide.section.buttons.small")}</Button>
            <Button size="default">{t("designGuide.section.buttons.default")}</Button>
            <Button size="lg">{t("designGuide.section.buttons.large")}</Button>
          </div>
        </SubSection>

        <SubSection title={t("designGuide.section.buttons.iconButtons")}>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="icon-xs"><Search /></Button>
            <Button variant="ghost" size="icon-sm"><Search /></Button>
            <Button variant="outline" size="icon"><Search /></Button>
            <Button variant="outline" size="icon-lg"><Search /></Button>
          </div>
        </SubSection>

        <SubSection title={t("designGuide.section.buttons.withIcons")}>
          <div className="flex items-center gap-2 flex-wrap">
            <Button><Plus /> {t("designGuide.section.buttons.newIssue")}</Button>
            <Button variant="outline"><Upload /> {t("designGuide.section.buttons.upload")}</Button>
            <Button variant="destructive"><Trash2 /> {t("designGuide.section.buttons.delete")}</Button>
            <Button size="sm"><Plus /> {t("designGuide.section.buttons.add")}</Button>
          </div>
        </SubSection>

        <SubSection title={t("designGuide.section.buttons.states")}>
          <div className="flex items-center gap-2 flex-wrap">
            <Button disabled>{t("designGuide.section.buttons.disabled")}</Button>
            <Button variant="outline" disabled>{t("designGuide.section.buttons.disabledOutline")}</Button>
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  BADGES                                                       */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.badges.title")}>
        <SubSection title={t("designGuide.section.badges.variants")}>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="default">{t("designGuide.section.buttons.default")}</Badge>
            <Badge variant="secondary">{t("designGuide.section.buttons.secondary")}</Badge>
            <Badge variant="outline">{t("designGuide.section.buttons.outline")}</Badge>
            <Badge variant="destructive">{t("designGuide.section.buttons.destructive")}</Badge>
            <Badge variant="ghost">{t("designGuide.section.buttons.ghost")}</Badge>
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  STATUS BADGES & ICONS                                        */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.statusSystem.title")}>
        <SubSection title={t("designGuide.section.statusSystem.statusBadgeAll")}>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              "active", "running", "paused", "idle", "archived", "planned",
              "achieved", "completed", "failed", "timed_out", "succeeded", "error",
              "pending_approval", "backlog", "todo", "in_progress", "in_review", "blocked",
              "done", "terminated", "cancelled", "pending", "revision_requested",
              "approved", "rejected",
            ].map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
          </div>
        </SubSection>

        <SubSection title={t("designGuide.section.statusSystem.statusIconInteractive")}>
          <div className="flex items-center gap-3 flex-wrap">
            {["backlog", "todo", "in_progress", "in_review", "done", "cancelled", "blocked"].map(
              (s) => (
                <div key={s} className="flex items-center gap-1.5">
                  <StatusIcon status={s} />
                  <span className="text-xs text-muted-foreground">{s}</span>
                </div>
              )
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <StatusIcon status={status} onChange={setStatus} />
            <span className="text-sm">{t("designGuide.section.statusSystem.clickToChangeStatus", { status })}</span>
          </div>
        </SubSection>

        <SubSection title={t("designGuide.section.statusSystem.priorityIconInteractive")}>
          <div className="flex items-center gap-3 flex-wrap">
            {["critical", "high", "medium", "low"].map((p) => (
              <div key={p} className="flex items-center gap-1.5">
                <PriorityIcon priority={p} />
                <span className="text-xs text-muted-foreground">{p}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <PriorityIcon priority={priority} onChange={setPriority} />
            <span className="text-sm">{t("designGuide.section.statusSystem.clickToChangePriority", { priority })}</span>
          </div>
        </SubSection>

        <SubSection title={t("designGuide.section.statusSystem.agentStatusDots")}>
          <div className="flex items-center gap-4 flex-wrap">
            {(["running", "active", "paused", "error", "archived"] as const).map((label) => (
              <div key={label} className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`inline-flex h-full w-full rounded-full ${agentStatusDot[label] ?? agentStatusDotDefault}`} />
                </span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </SubSection>

        <SubSection title={t("designGuide.section.statusSystem.runInvocationBadges")}>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              ["timer", "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"],
              ["assignment", "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"],
              ["on_demand", "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300"],
              ["automation", "bg-muted text-muted-foreground"],
            ].map(([label, cls]) => (
              <span key={label} className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
                {label}
              </span>
            ))}
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  FORM ELEMENTS                                                */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.formElements.title")}>
        <div className="grid gap-6 md:grid-cols-2">
          <SubSection title={t("designGuide.section.formElements.input")}>
            <Input placeholder={t("designGuide.section.formElements.defaultInput")} />
            <Input placeholder={t("designGuide.section.formElements.disabledInput")} disabled className="mt-2" />
          </SubSection>

          <SubSection title={t("designGuide.section.formElements.textarea")}>
            <Textarea placeholder={t("designGuide.section.formElements.writeSomething")} />
          </SubSection>

          <SubSection title={t("designGuide.section.formElements.checkboxAndLabel")}>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox id="check1" defaultChecked />
                <Label htmlFor="check1">{t("designGuide.section.formElements.checkedItem")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="check2" />
                <Label htmlFor="check2">{t("designGuide.section.formElements.uncheckedItem")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="check3" disabled />
                <Label htmlFor="check3">{t("designGuide.section.formElements.disabledItem")}</Label>
              </div>
            </div>
          </SubSection>

          <SubSection title={t("designGuide.section.formElements.inlineEditor")}>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("designGuide.section.formElements.titleSingleLine")}</p>
                <InlineEditor
                  value={inlineTitle}
                  onSave={setInlineTitle}
                  as="h2"
                  className="text-xl font-bold"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("designGuide.section.formElements.bodyTextSingleLine")}</p>
                <InlineEditor
                  value={inlineText}
                  onSave={setInlineText}
                  as="p"
                  className="text-sm"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("designGuide.section.formElements.descriptionMultiline")}</p>
                <InlineEditor
                  value={inlineDesc}
                  onSave={setInlineDesc}
                  as="p"
                  className="text-sm text-muted-foreground"
                  placeholder={t("designGuide.section.formElements.addDescription")}
                  multiline
                />
              </div>
            </div>
          </SubSection>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  SELECT                                                       */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.select.title")}>
        <div className="grid gap-6 md:grid-cols-2">
          <SubSection title={t("designGuide.section.select.defaultSize")}>
            <Select value={selectValue} onValueChange={setSelectValue}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("designGuide.section.select.selectStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="backlog">{t("designGuide.section.select.backlog")}</SelectItem>
                <SelectItem value="todo">{t("designGuide.section.select.todo")}</SelectItem>
                <SelectItem value="in_progress">{t("designGuide.section.select.inProgress")}</SelectItem>
                <SelectItem value="in_review">{t("designGuide.section.select.inReview")}</SelectItem>
                <SelectItem value="done">{t("designGuide.section.select.done")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("designGuide.section.select.currentValue", { value: selectValue })}</p>
          </SubSection>
          <SubSection title={t("designGuide.section.select.smallTrigger")}>
            <Select defaultValue="high">
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">{t("designGuide.section.select.critical")}</SelectItem>
                <SelectItem value="high">{t("designGuide.section.select.high")}</SelectItem>
                <SelectItem value="medium">{t("designGuide.section.select.medium")}</SelectItem>
                <SelectItem value="low">{t("designGuide.section.select.low")}</SelectItem>
              </SelectContent>
            </Select>
          </SubSection>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  DROPDOWN MENU                                                */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.dropdownMenu.title")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {t("designGuide.section.dropdownMenu.quickActions")}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem>
              <Check className="h-4 w-4" />
              {t("designGuide.section.dropdownMenu.markAsDone")}
              <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <BookOpen className="h-4 w-4" />
              {t("designGuide.section.dropdownMenu.openDocs")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={menuChecked}
              onCheckedChange={(value) => setMenuChecked(value === true)}
            >
              {t("designGuide.section.dropdownMenu.watchIssue")}
            </DropdownMenuCheckboxItem>
            <DropdownMenuItem variant="destructive">
              <Trash2 className="h-4 w-4" />
              {t("designGuide.section.dropdownMenu.deleteIssue")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Section>

      {/* ============================================================ */}
      {/*  POPOVER                                                      */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.popover.title")}>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">{t("designGuide.section.popover.openPopover")}</Button>
          </PopoverTrigger>
          <PopoverContent className="space-y-2">
            <p className="text-sm font-medium">{t("designGuide.section.popover.agentHeartbeat")}</p>
            <p className="text-xs text-muted-foreground">
              {t("designGuide.section.popover.lastRunSucceeded")}
            </p>
            <Button size="xs">{t("designGuide.section.popover.wakeNow")}</Button>
          </PopoverContent>
        </Popover>
      </Section>

      {/* ============================================================ */}
      {/*  COLLAPSIBLE                                                  */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.collapsible.title")}>
        <Collapsible open={collapsibleOpen} onOpenChange={setCollapsibleOpen} className="space-y-2">
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">
              {collapsibleOpen ? t("designGuide.section.collapsible.hideAdvancedFilters") : t("designGuide.section.collapsible.showAdvancedFilters")}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="rounded-md border border-border p-3">
            <div className="space-y-2">
              <Label htmlFor="owner-filter">{t("designGuide.section.collapsible.owner")}</Label>
              <Input id="owner-filter" placeholder={t("designGuide.section.collapsible.filterByAgentName")} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Section>

      {/* ============================================================ */}
      {/*  SHEET                                                        */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.sheet.title")}>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">{t("designGuide.section.sheet.openSidePanel")}</Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>{t("designGuide.section.sheet.issueProperties")}</SheetTitle>
              <SheetDescription>{t("designGuide.section.sheet.editMetadata")}</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4">
              <div className="space-y-1">
                <Label htmlFor="sheet-title">{t("designGuide.sheet.title")}</Label>
                <Input id="sheet-title" defaultValue={t("designGuide.sample.improveOnboarding")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sheet-description">{t("designGuide.sheet.description")}</Label>
                <Textarea id="sheet-description" defaultValue={t("designGuide.sample.capturePitfalls")} />
              </div>
            </div>
            <SheetFooter>
              <Button variant="outline">{t("designGuide.section.sheet.cancel")}</Button>
              <Button>{t("designGuide.section.sheet.save")}</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </Section>

      {/* ============================================================ */}
      {/*  SCROLL AREA                                                  */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.scrollArea.title")}>
        <ScrollArea className="h-36 rounded-md border border-border">
          <div className="space-y-2 p-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-md border border-border p-2 text-sm">
                Heartbeat run #{i + 1}: completed successfully
              </div>
            ))}
          </div>
        </ScrollArea>
      </Section>

      {/* ============================================================ */}
      {/*  COMMAND                                                      */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.command.title")}>
        <div className="rounded-md border border-border">
          <Command>
            <CommandInput placeholder={t("designGuide.section.command.typeCommandOrSearch")} />
            <CommandList>
              <CommandEmpty>{t("designGuide.section.command.noResultsFound")}</CommandEmpty>
              <CommandGroup heading={t("designGuide.section.command.pages")}>
                <CommandItem>
                  <LayoutDashboard className="h-4 w-4" />
                  {t("designGuide.section.command.dashboard")}
                </CommandItem>
                <CommandItem>
                  <CircleDot className="h-4 w-4" />
                  {t("designGuide.section.command.issues")}
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading={t("designGuide.section.command.actions")}>
                <CommandItem>
                  <CommandIcon className="h-4 w-4" />
                  {t("designGuide.section.command.openCommandPalette")}
                </CommandItem>
                <CommandItem>
                  <Plus className="h-4 w-4" />
                  {t("designGuide.section.command.createNewIssue")}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  BREADCRUMB                                                   */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.breadcrumb.title")}>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">{t("designGuide.section.breadcrumb.projects")}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#">{t("designGuide.section.breadcrumb.paperclipApp")}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t("designGuide.section.breadcrumb.issueList")}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </Section>

      {/* ============================================================ */}
      {/*  CARDS                                                        */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.cards.title")}>
        <SubSection title={t("designGuide.section.cards.standardCard")}>
          <Card>
            <CardHeader>
              <CardTitle>{t("designGuide.section.cards.cardTitle")}</CardTitle>
              <CardDescription>{t("designGuide.section.cards.cardDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{t("designGuide.section.cards.cardContent")}</p>
            </CardContent>
            <CardFooter className="gap-2">
              <Button size="sm">{t("designGuide.section.cards.action")}</Button>
              <Button variant="outline" size="sm">{t("designGuide.section.cards.cancel")}</Button>
            </CardFooter>
          </Card>
        </SubSection>

        <SubSection title={t("designGuide.section.cards.metricCards")}>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard icon={Bot} value={12} label={t("designGuide.section.cards.activeAgents")} description={t("designGuide.section.cards.thisWeek")} />
            <MetricCard icon={CircleDot} value={48} label={t("designGuide.section.cards.openIssues")} />
            <MetricCard icon={DollarSign} value="$1,234" label={t("designGuide.section.cards.monthlyCost")} description={t("designGuide.section.cards.underBudget")} />
            <MetricCard icon={Zap} value="99.9%" label={t("designGuide.section.cards.uptime")} />
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  TABS                                                         */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.tabs.title")}>
        <SubSection title={t("designGuide.section.tabs.defaultPillVariant")}>
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">{t("designGuide.section.tabs.overview")}</TabsTrigger>
              <TabsTrigger value="runs">{t("designGuide.section.tabs.runs")}</TabsTrigger>
              <TabsTrigger value="config">{t("designGuide.section.tabs.config")}</TabsTrigger>
              <TabsTrigger value="costs">{t("designGuide.section.tabs.costs")}</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <p className="text-sm text-muted-foreground py-4">{t("designGuide.section.tabs.overviewTabContent")}</p>
            </TabsContent>
            <TabsContent value="runs">
              <p className="text-sm text-muted-foreground py-4">{t("designGuide.section.tabs.runsTabContent")}</p>
            </TabsContent>
            <TabsContent value="config">
              <p className="text-sm text-muted-foreground py-4">{t("designGuide.section.tabs.configTabContent")}</p>
            </TabsContent>
            <TabsContent value="costs">
              <p className="text-sm text-muted-foreground py-4">{t("designGuide.section.tabs.costsTabContent")}</p>
            </TabsContent>
          </Tabs>
        </SubSection>

        <SubSection title={t("designGuide.section.tabs.lineVariant")}>
          <Tabs defaultValue="summary">
            <TabsList variant="line">
              <TabsTrigger value="summary">{t("designGuide.section.tabs.summary")}</TabsTrigger>
              <TabsTrigger value="details">{t("designGuide.section.tabs.details")}</TabsTrigger>
              <TabsTrigger value="comments">{t("designGuide.section.tabs.comments")}</TabsTrigger>
            </TabsList>
            <TabsContent value="summary">
              <p className="text-sm text-muted-foreground py-4">{t("designGuide.section.tabs.summaryContent")}</p>
            </TabsContent>
            <TabsContent value="details">
              <p className="text-sm text-muted-foreground py-4">{t("designGuide.section.tabs.detailsContent")}</p>
            </TabsContent>
            <TabsContent value="comments">
              <p className="text-sm text-muted-foreground py-4">{t("designGuide.section.tabs.commentsContent")}</p>
            </TabsContent>
          </Tabs>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  ENTITY ROWS                                                  */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.entityRows.title")}>
        <div className="border border-border rounded-md">
          <EntityRow
            leading={
              <>
                <StatusIcon status="in_progress" />
                <PriorityIcon priority="high" />
              </>
            }
            identifier="PAP-001"
            title={t("designGuide.section.entityRows.implementAuthFlow")}
            subtitle={t("designGuide.section.entityRows.assignedToAgent")}
            trailing={<StatusBadge status="in_progress" />}
            onClick={() => {}}
          />
          <EntityRow
            leading={
              <>
                <StatusIcon status="done" />
                <PriorityIcon priority="medium" />
              </>
            }
            identifier="PAP-002"
            title={t("designGuide.section.entityRows.setupCI")}
            subtitle={t("designGuide.section.entityRows.completedDaysAgo")}
            trailing={<StatusBadge status="done" />}
            onClick={() => {}}
          />
          <EntityRow
            leading={
              <>
                <StatusIcon status="todo" />
                <PriorityIcon priority="low" />
              </>
            }
            identifier="PAP-003"
            title={t("designGuide.section.entityRows.writeAPIDocs")}
            trailing={<StatusBadge status="todo" />}
            onClick={() => {}}
          />
          <EntityRow
            leading={
              <>
                <StatusIcon status="blocked" />
                <PriorityIcon priority="critical" />
              </>
            }
            identifier="PAP-004"
            title={t("designGuide.section.entityRows.deployToProduction")}
            subtitle={t("designGuide.section.entityRows.blockedBy")}
            trailing={<StatusBadge status="blocked" />}
            selected
          />
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  FILTER BAR                                                   */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.filterBar.title")}>
        <FilterBar
          filters={filters}
          onRemove={(key) => setFilters((f) => f.filter((x) => x.key !== key))}
          onClear={() => setFilters([])}
        />
        {filters.length === 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setFilters([
                { key: "status", label: t("designGuide.filter.status"), value: t("designGuide.filter.active") },
                { key: "priority", label: t("designGuide.filter.priority"), value: t("designGuide.filter.high") },
              ])
            }
          >
            {t("designGuide.section.filterBar.resetFilters")}
          </Button>
        )}
      </Section>

      {/* ============================================================ */}
      {/*  AVATARS                                                      */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.avatars.title")}>
        <SubSection title={t("designGuide.section.avatars.sizes")}>
          <div className="flex items-center gap-3">
            <Avatar size="sm"><AvatarFallback>SM</AvatarFallback></Avatar>
            <Avatar><AvatarFallback>DF</AvatarFallback></Avatar>
            <Avatar size="lg"><AvatarFallback>LG</AvatarFallback></Avatar>
          </div>
        </SubSection>

        <SubSection title={t("designGuide.section.avatars.group")}>
          <AvatarGroup>
            <Avatar><AvatarFallback>A1</AvatarFallback></Avatar>
            <Avatar><AvatarFallback>A2</AvatarFallback></Avatar>
            <Avatar><AvatarFallback>A3</AvatarFallback></Avatar>
            <AvatarGroupCount>+5</AvatarGroupCount>
          </AvatarGroup>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  IDENTITY                                                     */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.identity.title")}>
        <SubSection title={t("designGuide.section.identity.sizes")}>
          <div className="flex items-center gap-6">
            <Identity name={t("designGuide.sample.agentAlpha")} size="sm" />
            <Identity name={t("designGuide.sample.agentAlpha")} />
            <Identity name={t("designGuide.sample.agentAlpha")} size="lg" />
          </div>
        </SubSection>

        <SubSection title={t("designGuide.section.identity.initialsDerivation")}>
          <div className="flex flex-col gap-2">
            <Identity name={t("designGuide.sample.ceoAgent")} size="sm" />
            <Identity name={t("designGuide.sample.alpha")} size="sm" />
            <Identity name={t("designGuide.sample.qualityAssuranceLead")} size="sm" />
          </div>
        </SubSection>

        <SubSection title={t("designGuide.section.identity.customInitials")}>
          <Identity name={t("designGuide.sample.backendService")} initials="BS" size="sm" />
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  TOOLTIPS                                                     */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.tooltips.title")}>
        <div className="flex items-center gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm">{t("designGuide.section.tooltips.hoverMe")}</Button>
            </TooltipTrigger>
            <TooltipContent>{t("designGuide.section.tooltips.thisIsATooltip")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm"><Settings /></Button>
            </TooltipTrigger>
            <TooltipContent>{t("designGuide.section.tooltips.settings")}</TooltipContent>
          </Tooltip>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  DIALOG                                                       */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.dialog.title")}>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">{t("designGuide.section.dialog.openDialog")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("designGuide.section.dialog.dialogTitle")}</DialogTitle>
              <DialogDescription>
                {t("designGuide.section.dialog.dialogDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t("designGuide.section.dialog.name")}</Label>
                <Input placeholder={t("designGuide.section.dialog.enterName")} className="mt-1.5" />
              </div>
              <div>
                <Label>{t("designGuide.section.dialog.description")}</Label>
                <Textarea placeholder={t("designGuide.section.dialog.describe")} className="mt-1.5" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline">{t("designGuide.section.dialog.cancel")}</Button>
              <Button>{t("designGuide.section.dialog.save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>

      {/* ============================================================ */}
      {/*  EMPTY STATE                                                  */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.emptyState.title")}>
        <div className="border border-border rounded-md">
          <EmptyState
            icon={Inbox}
            message={t("designGuide.section.emptyState.noItemsMessage")}
            action={t("designGuide.section.emptyState.createItem")}
            onAction={() => {}}
          />
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  PROGRESS BARS                                                */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.progressBars.title")}>
        <div className="space-y-3">
          {[
            { label: t("designGuide.section.progressBars.underBudget", { value: 40 }), pct: 40, color: "bg-green-400" },
            { label: t("designGuide.section.progressBars.warning", { value: 75 }), pct: 75, color: "bg-yellow-400" },
            { label: t("designGuide.section.progressBars.overBudget", { value: 95 }), pct: 95, color: "bg-red-400" },
          ].map(({ label, pct, color }) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-xs font-mono">{pct}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-[width,background-color] duration-150 ${color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  LOG VIEWER                                                   */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.logViewer.title")}>
        <div className="bg-neutral-950 rounded-lg p-3 font-mono text-xs max-h-80 overflow-y-auto">
          <div className="text-foreground">{t("designGuide.section.logViewer.agentStarted")}</div>
          <div className="text-foreground">{t("designGuide.section.logViewer.processingTask")}</div>
          <div className="text-yellow-400">{t("designGuide.section.logViewer.rateLimitWarning")}</div>
          <div className="text-foreground">{t("designGuide.section.logViewer.taskCompleted")}</div>
          <div className="text-red-400">{t("designGuide.section.logViewer.connectionError")}</div>
          <div className="text-blue-300">{t("designGuide.section.logViewer.retrying")}</div>
          <div className="text-foreground">{t("designGuide.section.logViewer.reconnected")}</div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 animate-pulse" />
              <span className="inline-flex h-full w-full rounded-full bg-cyan-400" />
            </span>
            <span className="text-cyan-400">{t("designGuide.section.logViewer.live")}</span>
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  PROPERTY ROW PATTERN                                         */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.propertyRowPattern.title")}>
        <div className="border border-border rounded-md p-4 space-y-1 max-w-sm">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">{t("designGuide.section.propertyRowPattern.status")}</span>
            <StatusBadge status="active" />
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">{t("designGuide.section.propertyRowPattern.priority")}</span>
            <PriorityIcon priority="high" />
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">{t("designGuide.section.propertyRowPattern.assignee")}</span>
            <div className="flex items-center gap-1.5">
              <Avatar size="sm"><AvatarFallback>A</AvatarFallback></Avatar>
              <span className="text-xs">{t("designGuide.section.propertyRowPattern.agentAlpha")}</span>
            </div>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">{t("designGuide.section.propertyRowPattern.created")}</span>
            <span className="text-xs">{t("designGuide.section.propertyRowPattern.jan15")}</span>
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  NAVIGATION PATTERNS                                          */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.navigationPatterns.title")}>
        <SubSection title={t("designGuide.section.navigationPatterns.sidebarNavItems")}>
          <div className="w-60 border border-border rounded-md p-3 space-y-0.5 bg-card">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-accent-foreground">
              <LayoutDashboard className="h-4 w-4" />
              {t("designGuide.section.navigationPatterns.dashboard")}
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground cursor-pointer">
              <CircleDot className="h-4 w-4" />
              {t("designGuide.section.navigationPatterns.issues")}
              <span className="ml-auto text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                12
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground cursor-pointer">
              <Bot className="h-4 w-4" />
              {t("designGuide.section.navigationPatterns.agents")}
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground cursor-pointer">
              <Hexagon className="h-4 w-4" />
              {t("designGuide.section.navigationPatterns.projects")}
            </div>
          </div>
        </SubSection>

        <SubSection title={t("designGuide.section.navigationPatterns.viewToggle")}>
          <div className="flex items-center border border-border rounded-md w-fit">
            <button className="px-3 py-1.5 text-xs font-medium bg-accent text-foreground rounded-l-md">
              <ListTodo className="h-3.5 w-3.5 inline mr-1" />
              {t("designGuide.section.navigationPatterns.list")}
            </button>
            <button className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/50 rounded-r-md">
              <Target className="h-3.5 w-3.5 inline mr-1" />
              {t("designGuide.section.navigationPatterns.org")}
            </button>
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  GROUPED LIST (Issues pattern)                                */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.groupedList.title")}>
        <div>
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-t-md">
            <StatusIcon status="in_progress" />
            <span className="text-sm font-medium">{t("designGuide.section.groupedList.inProgress")}</span>
            <span className="text-xs text-muted-foreground ml-1">2</span>
          </div>
          <div className="border border-border rounded-b-md">
            <EntityRow
              leading={<PriorityIcon priority="high" />}
              identifier="PAP-101"
              title={t("designGuide.section.groupedList.buildAgentHeartbeat")}
              onClick={() => {}}
            />
            <EntityRow
              leading={<PriorityIcon priority="medium" />}
              identifier="PAP-102"
              title={t("designGuide.section.groupedList.addCostTracking")}
              onClick={() => {}}
            />
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  COMMENT THREAD PATTERN                                       */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.commentThread.title")}>
          <div className="space-y-3 max-w-2xl">
          <h3 className="text-sm font-semibold">{t("designGuide.section.commentThread.commentsCount", { count: 2 })}</h3>
          <div className="space-y-3">
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">{t("designGuide.section.commentThread.agent")}</span>
                <span className="text-xs text-muted-foreground">{t("designGuide.section.propertyRowPattern.jan15")}</span>
              </div>
              <p className="text-sm">{t("designGuide.section.commentThread.startedWorking")}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">{t("designGuide.section.commentThread.human")}</span>
                <span className="text-xs text-muted-foreground">{t("designGuide.section.propertyRowPattern.jan16")}</span>
              </div>
              <p className="text-sm">{t("designGuide.section.commentThread.apiKeysAdded")}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Textarea placeholder={t("designGuide.section.commentThread.leaveComment")} rows={3} />
            <Button size="sm">{t("designGuide.section.commentThread.comment")}</Button>
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  COST TABLE PATTERN                                           */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.costTable.title")}>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="border-b border-border bg-accent/20">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t("designGuide.section.costTable.model")}</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t("designGuide.section.costTable.tokens")}</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t("designGuide.section.costTable.cost")}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="px-3 py-2">claude-sonnet-4-20250514</td>
                <td className="px-3 py-2 font-mono">1.2M</td>
                <td className="px-3 py-2 font-mono">$18.00</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-3 py-2">claude-haiku-4-20250506</td>
                <td className="px-3 py-2 font-mono">500k</td>
                <td className="px-3 py-2 font-mono">$1.25</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">{t("designGuide.section.costTable.total")}</td>
                <td className="px-3 py-2 font-mono">1.7M</td>
                <td className="px-3 py-2 font-mono font-medium">$19.25</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  SKELETONS                                                    */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.skeletons.title")}>
        <SubSection title={t("designGuide.section.skeletons.individual")}>
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-8 w-full max-w-sm" />
            <Skeleton className="h-20 w-full" />
          </div>
        </SubSection>

        <SubSection title={t("designGuide.section.skeletons.pageSkeletonList")}>
          <div className="border border-border rounded-md p-4">
            <PageSkeleton variant="list" />
          </div>
        </SubSection>

        <SubSection title={t("designGuide.section.skeletons.pageSkeletonDetail")}>
          <div className="border border-border rounded-md p-4">
            <PageSkeleton variant="detail" />
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  SEPARATOR                                                    */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.separator.title")}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("designGuide.section.separator.horizontal")}</p>
          <Separator />
          <div className="flex items-center gap-4 h-8">
            <span className="text-sm">{t("designGuide.section.separator.left")}</span>
            <Separator orientation="vertical" />
            <span className="text-sm">{t("designGuide.section.separator.right")}</span>
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  ICON REFERENCE                                               */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.commonIcons.title")}>
        <div className="grid grid-cols-4 md:grid-cols-6 gap-4">
          {[
            [t("designGuide.commonIcons.inbox"), Inbox],
            [t("designGuide.commonIcons.listTodo"), ListTodo],
            [t("designGuide.commonIcons.circleDot"), CircleDot],
            [t("designGuide.commonIcons.hexagon"), Hexagon],
            [t("designGuide.commonIcons.target"), Target],
            [t("designGuide.commonIcons.layoutDashboard"), LayoutDashboard],
            [t("designGuide.commonIcons.bot"), Bot],
            [t("designGuide.commonIcons.dollarSign"), DollarSign],
            [t("designGuide.commonIcons.history"), History],
            [t("designGuide.commonIcons.search"), Search],
            [t("designGuide.commonIcons.plus"), Plus],
            [t("designGuide.commonIcons.trash2"), Trash2],
            [t("designGuide.commonIcons.settings"), Settings],
            [t("designGuide.commonIcons.user"), User],
            [t("designGuide.commonIcons.mail"), Mail],
            [t("designGuide.commonIcons.upload"), Upload],
            [t("designGuide.commonIcons.zap"), Zap],
          ].map(([name, Icon]) => {
            const LucideIcon = Icon as React.FC<{ className?: string }>;
            return (
              <div key={name as string} className="flex flex-col items-center gap-1.5 p-2">
                <LucideIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-mono">{name as string}</span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  KEYBOARD SHORTCUTS                                           */}
      {/* ============================================================ */}
      <Section title={t("designGuide.section.keyboardShortcuts.title")}>
        <div className="border border-border rounded-md divide-y divide-border text-sm">
          {[
            [t("designGuide.keyboardShortcuts.cmdCtrlK"), t("designGuide.section.keyboardShortcuts.openCommandPalette")],
            ["C", t("designGuide.section.keyboardShortcuts.newIssueOutside")],
            ["[", t("designGuide.section.keyboardShortcuts.toggleSidebar")],
            ["]", t("designGuide.section.keyboardShortcuts.togglePropertiesPanel")],

            [t("designGuide.keyboardShortcuts.cmdEnter"), t("designGuide.section.keyboardShortcuts.submitMarkdownComment")],
          ].map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between px-4 py-2">
              <span className="text-muted-foreground">{desc}</span>
              <kbd className="px-2 py-0.5 text-xs font-mono bg-muted rounded border border-border">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

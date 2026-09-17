import { useEffect, useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { index as campaignsIndex, update as updateCampaign } from "@/routes/portal/campaigns";
import { update as updateForm } from "@/routes/portal/campaign-forms";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupNumberInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { SelectBox } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";

const PURPOSE_OPTIONS = [
    { value: "lead_generation", label: "Lead Generation" },
    { value: "brand_awareness", label: "Brand Awareness" },
    { value: "sales", label: "Sales" },
    { value: "event", label: "Event" },
];

const CHANNEL_OPTIONS = [
    { value: "website", label: "Website" },
    { value: "social", label: "Social" },
    { value: "search", label: "Search" },
    { value: "email", label: "Email" },
    { value: "referral", label: "Referral" },
    { value: "offline", label: "Offline" },
    { value: "partner", label: "Partner" },
    { value: "other", label: "Other" },
];

function copyText(value, successMessage) {
    if (!value) {
        toast.error("Nothing to copy");
        return;
    }

    navigator.clipboard.writeText(value).then(
        () => toast.success(successMessage),
        () => toast.error("Could not copy")
    );
}

function statusTone(status) {
    if (status === "active") {
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    }

    if (status === "archived") {
        return "bg-muted text-muted-foreground";
    }

    return "bg-amber-500/10 text-amber-800 dark:text-amber-400";
}

function titleCase(value) {
    return String(value || "")
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function mapOptions(items, fallbacks = []) {
    return (items?.length ? items : fallbacks).map((item) => {
        if (typeof item !== "string") {
            return item;
        }

        const match = fallbacks.find((option) => option.value === item);

        return match || { value: item, label: titleCase(item) };
    });
}

function InsightCard({ label, value, hint }) {
    return (
        <div className="rounded-xl border border-border/70 bg-background px-4 py-3 shadow-xs">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
            {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
    );
}

function FieldLabel({ children }) {
    return (
        <Label className="mb-1 flex text-label font-medium text-muted-foreground">
            {children}
        </Label>
    );
}

function MoneyField({ label, value, onChange, currencySymbol }) {
    return (
        <div className="space-y-0.5">
            <FieldLabel>{label}</FieldLabel>
            <InputGroup>
                <InputGroupAddon>{currencySymbol}</InputGroupAddon>
                <InputGroupNumberInput
                    value={value}
                    onChange={onChange}
                    allowDecimal
                    min={0}
                    placeholder="0"
                />
            </InputGroup>
        </div>
    );
}

function GoalRow({ label, enabled, target, onEnabledChange, onTargetChange }) {
    return (
        <div className="flex items-center gap-3 rounded-md border border-border bg-muted/20 px-3 py-2.5">
            <Checkbox
                checked={enabled}
                onCheckedChange={(checked) => onEnabledChange(Boolean(checked))}
            >
                <span className="text-sm text-foreground">{label}</span>
            </Checkbox>
            <div className="ml-auto w-24">
                <NumberInput
                    value={target}
                    onChange={(value) => onTargetChange(value ?? 0)}
                    min={0}
                    showSteppers={false}
                    disabled={!enabled}
                    placeholder="0"
                />
            </div>
        </div>
    );
}

function ToolTrigger({ icon, label }) {
    return (
        <AccordionTrigger className="px-3 py-3 hover:no-underline data-panel-open:bg-muted/30">
            <span className="flex items-center gap-2.5">
                <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon name={icon} className="text-base" />
                </span>
                <span className="text-sm font-medium text-foreground">{label}</span>
            </span>
        </AccordionTrigger>
    );
}

function PanelActions({ processing, onSave, label = "Save" }) {
    return (
        <div className="flex justify-end border-t border-border/60 pt-4">
            <Button type="button" size="sm" loading={processing} onClick={onSave}>
                {label}
            </Button>
        </div>
    );
}

function buildGoalsState(campaign, formOptions) {
    const catalog = formOptions.goal_types || [];
    const stored = campaign.goals || {};

    if (catalog.length > 0) {
        return Object.fromEntries(
            catalog.map((type) => [
                type.label,
                {
                    enabled: Boolean(stored[type.label]?.enabled),
                    target: Number(stored[type.label]?.target) || 0,
                    title: type.title || titleCase(type.label),
                },
            ])
        );
    }

    return Object.fromEntries(
        Object.entries(stored).map(([key, goal]) => [
            key,
            {
                enabled: Boolean(goal?.enabled),
                target: Number(goal?.target) || 0,
                title: titleCase(key),
            },
        ])
    );
}

export default function CampaignShow({
    campaign,
    form = null,
    formOptions = {},
    defaultFields = [],
    insights = {},
}) {
    const { formatMoney: money, symbol: currencySymbol } = useCurrency();
    const [processing, setProcessing] = useState(false);
    const [openTool, setOpenTool] = useState(["settings"]);

    const [landing, setLanding] = useState({
        headline: campaign.landing?.headline || campaign.title || "",
        subheadline: campaign.landing?.subheadline || "",
        body: campaign.landing?.body || "",
        highlights: (campaign.landing?.highlights || []).join("\n"),
        cta_label: campaign.landing?.cta_label || "Register interest",
        thank_you_message:
            campaign.landing?.thank_you_message || "Thanks — we will be in touch shortly.",
        redirect_url: campaign.landing?.redirect_url || "",
        hero_image: campaign.landing?.hero_image || "",
    });

    const [campaignMeta, setCampaignMeta] = useState({
        title: campaign.title || "",
        status: campaign.status || "draft",
        project_id: campaign.project_id ? String(campaign.project_id) : "",
        purpose: campaign.purpose || "lead_generation",
        channel: campaign.channel || "website",
        description: campaign.description || "",
        budget: campaign.budget ?? null,
        target_cpl: campaign.target_cpl ?? null,
    });

    const [goalsState, setGoalsState] = useState(() =>
        buildGoalsState(campaign, formOptions)
    );

    const [formState, setFormState] = useState(() => ({
        name: form?.name || "Lead form",
        status: form?.status || "draft",
        fields: form?.fields || defaultFields,
        settings: {
            source: form?.settings?.source || "Campaign landing",
            thank_you_message:
                form?.settings?.thank_you_message || "Thanks — we will be in touch shortly.",
            lead_stage_id: form?.settings?.lead_stage_id
                ? String(form.settings.lead_stage_id)
                : "",
            assigned_to: form?.settings?.assigned_to
                ? String(form.settings.assigned_to)
                : "",
            button_label: form?.branding?.button_label || "Submit",
        },
    }));

    useEffect(() => {
        setGoalsState(buildGoalsState(campaign, formOptions));
    }, [campaign, formOptions]);

    const snippet = form?.embed_snippet || campaign.embed_snippet || "";
    const landingUrl = campaign.landing_url || "";
    const leadsCount = insights.leads_count ?? 0;
    const activeLeadsCount = insights.active_leads_count ?? 0;
    const submissionsCount = insights.submissions_count ?? 0;
    const goalInsights = insights.goals || [];
    const enabledGoals = useMemo(
        () => goalInsights.filter((goal) => goal.enabled),
        [goalInsights]
    );

    const statusOptions = useMemo(
        () =>
            mapOptions(formOptions.statuses, [
                { value: "draft", label: "Draft" },
                { value: "active", label: "Active" },
                { value: "archived", label: "Archived" },
            ]),
        [formOptions.statuses]
    );

    const purposeOptions = useMemo(
        () => mapOptions(formOptions.purposes, PURPOSE_OPTIONS),
        [formOptions.purposes]
    );

    const channelOptions = useMemo(
        () => mapOptions(formOptions.channels, CHANNEL_OPTIONS),
        [formOptions.channels]
    );

    const projectOptions = useMemo(
        () =>
            (formOptions.projects || []).map((project) => ({
                value: String(project.id),
                label: project.title,
            })),
        [formOptions.projects]
    );

    const formStatusOptions = useMemo(
        () =>
            mapOptions(formOptions.form_statuses, [
                { value: "draft", label: "Draft" },
                { value: "active", label: "Active" },
                { value: "archived", label: "Archived" },
            ]),
        [formOptions.form_statuses]
    );

    const stageOptions = useMemo(
        () =>
            (formOptions.stages || []).map((stage) => ({
                value: String(stage.id),
                label: stage.title || stage.label,
            })),
        [formOptions.stages]
    );

    const assigneeOptions = useMemo(
        () =>
            (formOptions.assignees || []).map((user) => ({
                value: String(user.id),
                label: user.display_name,
            })),
        [formOptions.assignees]
    );

    const goalRows = useMemo(
        () =>
            Object.entries(goalsState).map(([key, goal]) => ({
                key,
                label: goal.title || titleCase(key),
                enabled: Boolean(goal.enabled),
                target: Number(goal.target) || 0,
            })),
        [goalsState]
    );

    const saveCampaign = (extra = {}) => {
        setProcessing(true);
        router.put(
            updateCampaign.url(campaign.id),
            {
                title: campaignMeta.title,
                status: campaignMeta.status,
                purpose: campaignMeta.purpose || null,
                channel: campaignMeta.channel || null,
                description: campaignMeta.description || null,
                project_id: campaignMeta.project_id
                    ? Number(campaignMeta.project_id)
                    : null,
                budget:
                    campaignMeta.budget === "" || campaignMeta.budget == null
                        ? null
                        : Number(campaignMeta.budget),
                target_cpl:
                    campaignMeta.target_cpl === "" || campaignMeta.target_cpl == null
                        ? null
                        : Number(campaignMeta.target_cpl),
                goals: Object.fromEntries(
                    Object.entries(goalsState).map(([key, goal]) => [
                        key,
                        {
                            enabled: Boolean(goal.enabled),
                            target: Number(goal.target) || 0,
                        },
                    ])
                ),
                landing: {
                    headline: landing.headline,
                    subheadline: landing.subheadline || null,
                    body: landing.body || null,
                    highlights: landing.highlights
                        .split("\n")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    cta_label: landing.cta_label || "Register interest",
                    thank_you_message: landing.thank_you_message || null,
                    redirect_url: landing.redirect_url || null,
                    hero_image: landing.hero_image || null,
                },
                ...extra,
            },
            {
                preserveScroll: true,
                onSuccess: () => toast.success("Campaign saved"),
                onError: (errors) =>
                    toast.error(errors.title || errors.message || "Could not save campaign"),
                onFinish: () => setProcessing(false),
            }
        );
    };

    const saveForm = () => {
        if (!form?.id) {
            toast.error("No form attached to this campaign");
            return;
        }

        setProcessing(true);
        router.put(
            updateForm.url(form.id),
            {
                name: formState.name,
                status: formState.status,
                fields: formState.fields,
                settings: {
                    source: formState.settings.source,
                    thank_you_message: formState.settings.thank_you_message,
                    lead_stage_id: formState.settings.lead_stage_id
                        ? Number(formState.settings.lead_stage_id)
                        : null,
                    assigned_to: formState.settings.assigned_to
                        ? Number(formState.settings.assigned_to)
                        : null,
                },
                branding: {
                    button_label: formState.settings.button_label || "Submit",
                },
            },
            {
                preserveScroll: true,
                onSuccess: () => toast.success("Form saved"),
                onError: (errors) =>
                    toast.error(errors.name || errors.message || "Could not save form"),
                onFinish: () => setProcessing(false),
            }
        );
    };

    const toggleField = (key, enabled) => {
        setFormState((current) => ({
            ...current,
            fields: current.fields.map((field) =>
                field.key === key ? { ...field, enabled: Boolean(enabled) } : field
            ),
        }));
    };

    const updateGoal = (key, patch) => {
        setGoalsState((current) => ({
            ...current,
            [key]: {
                ...current[key],
                ...patch,
            },
        }));
    };

    const handlePrimarySave = () => {
        if (openTool.includes("form")) {
            saveForm();
            return;
        }

        saveCampaign();
    };

    return (
        <Layout>
            <Layout.Header
                metaTitle={campaign.title}
                breadcrumbs={[
                    { label: "Campaigns", href: campaignsIndex.url() },
                    { label: campaign.title },
                ]}
            />
            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar className="flex-wrap">
                    <div className="mr-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="truncate text-xl font-bold tracking-tight text-foreground">
                                {campaign.title}
                            </h1>
                            <span
                                className={cn(
                                    "inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize",
                                    statusTone(campaign.status)
                                )}
                            >
                                {campaign.status}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Insights on the left · campaign tools on the right
                        </p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        {landingUrl ? (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(landingUrl, "_blank", "noopener")}
                            >
                                <Icon name="external-link-line" className="text-base" />
                                Open landing
                            </Button>
                        ) : null}
                        <Button
                            type="button"
                            size="sm"
                            loading={processing}
                            onClick={handlePrimarySave}
                        >
                            Save
                        </Button>
                    </div>
                </Layout.Toolbar>

                <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.85fr)]">
                    <ScrollArea className="min-h-0 border-b border-border xl:border-b-0 xl:border-r">
                        <div className="space-y-6 px-6 py-6">
                            <section className="space-y-3">
                                <div>
                                    <h2 className="text-base font-semibold tracking-tight text-foreground">
                                        Insights
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        Performance snapshot for this campaign
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                    <InsightCard
                                        label="Total leads"
                                        value={leadsCount}
                                        hint={`${activeLeadsCount} active`}
                                    />
                                    <InsightCard
                                        label="Form submissions"
                                        value={submissionsCount}
                                    />
                                    <InsightCard label="Budget" value={money(campaign.budget)} />
                                    <InsightCard
                                        label="Target CPL"
                                        value={money(campaign.target_cpl)}
                                    />
                                </div>
                            </section>

                            <section className="space-y-3 rounded-xl border border-border/70 bg-background p-4 shadow-xs">
                                <div>
                                    <h3 className="text-sm font-semibold tracking-tight text-foreground">
                                        Goal progress
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Enabled targets from campaign goals
                                    </p>
                                </div>
                                {enabledGoals.length === 0 ? (
                                    <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
                                        No goals enabled yet. Open Goals in Campaign Tools to set
                                        targets.
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {enabledGoals.map((goal) => (
                                            <div key={goal.key} className="space-y-1.5">
                                                <div className="flex items-center justify-between gap-3 text-sm">
                                                    <span className="font-medium text-foreground">
                                                        {goal.title}
                                                    </span>
                                                    <span className="tabular-nums text-muted-foreground">
                                                        {goal.current}/{goal.target || "—"}
                                                    </span>
                                                </div>
                                                <div className="h-2 overflow-hidden rounded-full bg-muted">
                                                    <div
                                                        className="h-full rounded-full bg-primary transition-[width]"
                                                        style={{
                                                            width: `${goal.progress || 0}%`,
                                                            backgroundColor: goal.color || undefined,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            <section className="space-y-3 rounded-xl border border-border/70 bg-background p-4 shadow-xs">
                                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                                    Overview
                                </h3>
                                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div>
                                        <dt className="text-xs text-muted-foreground">Project</dt>
                                        <dd className="text-sm font-medium text-foreground">
                                            {campaign.project?.title || "—"}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-muted-foreground">Purpose</dt>
                                        <dd className="text-sm font-medium text-foreground">
                                            {titleCase(campaign.purpose) || "—"}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-muted-foreground">Channel</dt>
                                        <dd className="text-sm font-medium capitalize text-foreground">
                                            {campaign.channel || "—"}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-muted-foreground">Form</dt>
                                        <dd className="text-sm font-medium text-foreground">
                                            {campaign.form?.name || form?.name || "—"}
                                        </dd>
                                    </div>
                                </dl>
                                {campaign.description ? (
                                    <p className="border-t border-border/60 pt-3 text-sm text-muted-foreground">
                                        {campaign.description}
                                    </p>
                                ) : null}
                            </section>

                            <section className="rounded-xl border border-dashed border-border/80 bg-muted/15 px-4 py-8 text-center">
                                <Icon
                                    name="bar-chart-2-line"
                                    className="mx-auto text-2xl text-muted-foreground"
                                />
                                <h3 className="mt-3 text-sm font-semibold text-foreground">
                                    Analytics coming soon
                                </h3>
                                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                                    Charts for conversion, channel mix, and daily lead volume will
                                    appear here.
                                </p>
                            </section>
                        </div>
                    </ScrollArea>

                    <aside className="flex min-h-0 flex-col bg-background">
                        <div className="shrink-0 border-b border-border px-4 py-3">
                            <h2 className="text-sm font-semibold tracking-tight text-foreground">
                                Campaign Tools
                            </h2>
                        </div>
                        <ScrollArea className="min-h-0 flex-1">
                            <Accordion
                                value={openTool}
                                onValueChange={(value) => setOpenTool(value)}
                                className="px-1"
                            >
                                <AccordionItem value="settings" className="border-border/70 px-2">
                                    <ToolTrigger icon="settings-3-line" label="Settings" />
                                    <AccordionContent className="space-y-4 px-1 pb-4">
                                        <Input
                                            label="Title"
                                            value={campaignMeta.title}
                                            onChange={(event) =>
                                                setCampaignMeta((current) => ({
                                                    ...current,
                                                    title: event.target.value,
                                                }))
                                            }
                                        />
                                        <SelectBox
                                            label="Status"
                                            value={campaignMeta.status}
                                            onValueChange={(value) =>
                                                setCampaignMeta((current) => ({
                                                    ...current,
                                                    status: value,
                                                }))
                                            }
                                            options={statusOptions}
                                            placeholder="Select"
                                        />
                                        <SelectBox
                                            label="Project"
                                            value={campaignMeta.project_id}
                                            onValueChange={(value) =>
                                                setCampaignMeta((current) => ({
                                                    ...current,
                                                    project_id: value ?? "",
                                                }))
                                            }
                                            options={projectOptions}
                                            placeholder="Optional"
                                            clearable
                                        />
                                        <SelectBox
                                            label="Purpose"
                                            value={campaignMeta.purpose}
                                            onValueChange={(value) =>
                                                setCampaignMeta((current) => ({
                                                    ...current,
                                                    purpose: value,
                                                }))
                                            }
                                            options={purposeOptions}
                                            placeholder="Select"
                                        />
                                        <SelectBox
                                            label="Channel"
                                            value={campaignMeta.channel}
                                            onValueChange={(value) =>
                                                setCampaignMeta((current) => ({
                                                    ...current,
                                                    channel: value,
                                                }))
                                            }
                                            options={channelOptions}
                                            placeholder="Select"
                                        />
                                        <div className="grid grid-cols-1 gap-4">
                                            <MoneyField
                                                label="Budget"
                                                value={campaignMeta.budget}
                                                onChange={(value) =>
                                                    setCampaignMeta((current) => ({
                                                        ...current,
                                                        budget: value,
                                                    }))
                                                }
                                                currencySymbol={currencySymbol}
                                            />
                                            <MoneyField
                                                label="Target CPL"
                                                value={campaignMeta.target_cpl}
                                                onChange={(value) =>
                                                    setCampaignMeta((current) => ({
                                                        ...current,
                                                        target_cpl: value,
                                                    }))
                                                }
                                                currencySymbol={currencySymbol}
                                            />
                                        </div>
                                        <div className="space-y-0.5">
                                            <FieldLabel>Description</FieldLabel>
                                            <Textarea
                                                rows={3}
                                                value={campaignMeta.description}
                                                onChange={(event) =>
                                                    setCampaignMeta((current) => ({
                                                        ...current,
                                                        description: event.target.value,
                                                    }))
                                                }
                                            />
                                        </div>
                                        <PanelActions
                                            processing={processing}
                                            onSave={() => saveCampaign()}
                                        />
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="goals" className="border-border/70 px-2">
                                    <ToolTrigger icon="flag-line" label="Goals" />
                                    <AccordionContent className="space-y-4 px-1 pb-4">
                                        <p className="text-xs text-muted-foreground">
                                            Enable a metric and set its target. Goal types are
                                            managed in Settings → Campaigns.
                                        </p>
                                        {goalRows.length === 0 ? (
                                            <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                                                No goal types configured yet.
                                            </p>
                                        ) : (
                                            <div className="space-y-2">
                                                {goalRows.map((goal) => (
                                                    <GoalRow
                                                        key={goal.key}
                                                        label={goal.label}
                                                        enabled={goal.enabled}
                                                        target={goal.target}
                                                        onEnabledChange={(enabled) =>
                                                            updateGoal(goal.key, { enabled })
                                                        }
                                                        onTargetChange={(target) =>
                                                            updateGoal(goal.key, { target })
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        )}
                                        <PanelActions
                                            processing={processing}
                                            onSave={() => saveCampaign()}
                                            label="Save goals"
                                        />
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="form" className="border-border/70 px-2">
                                    <ToolTrigger icon="file-list-3-line" label="Form" />
                                    <AccordionContent className="space-y-4 px-1 pb-4">
                                        {!form ? (
                                            <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                                                No form attached to this campaign yet.
                                            </p>
                                        ) : (
                                            <>
                                                <Input
                                                    label="Form name"
                                                    value={formState.name}
                                                    onChange={(event) =>
                                                        setFormState((current) => ({
                                                            ...current,
                                                            name: event.target.value,
                                                        }))
                                                    }
                                                />
                                                <SelectBox
                                                    label="Status"
                                                    value={formState.status}
                                                    onValueChange={(value) =>
                                                        setFormState((current) => ({
                                                            ...current,
                                                            status: value,
                                                        }))
                                                    }
                                                    options={formStatusOptions}
                                                    placeholder="Select"
                                                />
                                                <div className="space-y-2 rounded-lg border border-border/70 bg-muted/10 p-3">
                                                    <FieldLabel>Fields</FieldLabel>
                                                    {formState.fields.map((field) => (
                                                        <div
                                                            key={field.key}
                                                            className="flex items-center justify-between gap-2 border-b border-border/50 py-2 last:border-b-0 last:pb-0"
                                                        >
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-medium text-foreground">
                                                                    {field.label}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {field.key}
                                                                    {field.required
                                                                        ? " · required"
                                                                        : ""}
                                                                </p>
                                                            </div>
                                                            <Checkbox
                                                                checked={Boolean(field.enabled)}
                                                                onCheckedChange={(checked) =>
                                                                    toggleField(
                                                                        field.key,
                                                                        checked
                                                                    )
                                                                }
                                                            >
                                                                Enabled
                                                            </Checkbox>
                                                        </div>
                                                    ))}
                                                </div>
                                                <Input
                                                    label="Source label"
                                                    value={formState.settings.source}
                                                    onChange={(event) =>
                                                        setFormState((current) => ({
                                                            ...current,
                                                            settings: {
                                                                ...current.settings,
                                                                source: event.target.value,
                                                            },
                                                        }))
                                                    }
                                                />
                                                <Input
                                                    label="Submit button"
                                                    value={formState.settings.button_label}
                                                    onChange={(event) =>
                                                        setFormState((current) => ({
                                                            ...current,
                                                            settings: {
                                                                ...current.settings,
                                                                button_label: event.target.value,
                                                            },
                                                        }))
                                                    }
                                                />
                                                <SelectBox
                                                    label="Default stage"
                                                    value={formState.settings.lead_stage_id}
                                                    onValueChange={(value) =>
                                                        setFormState((current) => ({
                                                            ...current,
                                                            settings: {
                                                                ...current.settings,
                                                                lead_stage_id: value ?? "",
                                                            },
                                                        }))
                                                    }
                                                    options={stageOptions}
                                                    placeholder="Select"
                                                    clearable
                                                />
                                                <SelectBox
                                                    label="Default assignee"
                                                    value={formState.settings.assigned_to}
                                                    onValueChange={(value) =>
                                                        setFormState((current) => ({
                                                            ...current,
                                                            settings: {
                                                                ...current.settings,
                                                                assigned_to: value ?? "",
                                                            },
                                                        }))
                                                    }
                                                    options={assigneeOptions}
                                                    placeholder="Optional"
                                                    clearable
                                                />
                                                <div className="space-y-0.5">
                                                    <FieldLabel>Thank-you message</FieldLabel>
                                                    <Textarea
                                                        rows={2}
                                                        value={formState.settings.thank_you_message}
                                                        onChange={(event) =>
                                                            setFormState((current) => ({
                                                                ...current,
                                                                settings: {
                                                                    ...current.settings,
                                                                    thank_you_message:
                                                                        event.target.value,
                                                                },
                                                            }))
                                                        }
                                                    />
                                                </div>
                                                <PanelActions
                                                    processing={processing}
                                                    onSave={saveForm}
                                                    label="Save form"
                                                />
                                            </>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="embed" className="border-border/70 px-2">
                                    <ToolTrigger icon="code-s-slash-line" label="Embed Code" />
                                    <AccordionContent className="space-y-4 px-1 pb-4">
                                        <div className="relative rounded-lg border border-border/70 bg-muted/30 p-3">
                                            <IconButton
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                icon="file-copy-line"
                                                aria-label="Copy embed code"
                                                className="absolute top-2 right-2"
                                                onClick={() =>
                                                    copyText(snippet, "Embed snippet copied")
                                                }
                                            />
                                            <pre className="max-h-48 overflow-auto pr-8 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
                                                {snippet || "No embed snippet available yet."}
                                            </pre>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-xs font-medium text-foreground">
                                                Follow the steps below to embed the PropFlow
                                                campaign form on your website or landing page.
                                            </p>
                                            <ol className="list-decimal space-y-1.5 pl-4 text-xs text-muted-foreground">
                                                <li>Copy the embed code above.</li>
                                                <li>
                                                    Paste the code in the HTML of your website or
                                                    landing page.
                                                </li>
                                                <li>
                                                    Reload the page in a browser — the form should
                                                    now appear in place of the{" "}
                                                    <code className="rounded bg-muted px-1">
                                                        #propflow-form
                                                    </code>{" "}
                                                    div.
                                                </li>
                                            </ol>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="landing" className="border-border/70 px-2">
                                    <ToolTrigger icon="global-line" label="Landing Page" />
                                    <AccordionContent className="space-y-4 px-1 pb-4">
                                        {landingUrl ? (
                                            <div className="space-y-0.5">
                                                <FieldLabel>Landing URL</FieldLabel>
                                                <div className="flex gap-2">
                                                    <Input readOnly value={landingUrl} />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            copyText(
                                                                landingUrl,
                                                                "Landing URL copied"
                                                            )
                                                        }
                                                    >
                                                        Copy
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : null}
                                        <Input
                                            label="Headline"
                                            value={landing.headline}
                                            onChange={(event) =>
                                                setLanding((current) => ({
                                                    ...current,
                                                    headline: event.target.value,
                                                }))
                                            }
                                        />
                                        <Input
                                            label="Subheadline"
                                            value={landing.subheadline}
                                            onChange={(event) =>
                                                setLanding((current) => ({
                                                    ...current,
                                                    subheadline: event.target.value,
                                                }))
                                            }
                                        />
                                        <div className="space-y-0.5">
                                            <FieldLabel>Body</FieldLabel>
                                            <Textarea
                                                rows={3}
                                                value={landing.body}
                                                onChange={(event) =>
                                                    setLanding((current) => ({
                                                        ...current,
                                                        body: event.target.value,
                                                    }))
                                                }
                                            />
                                        </div>
                                        <div className="space-y-0.5">
                                            <FieldLabel>Highlights (one per line)</FieldLabel>
                                            <Textarea
                                                rows={3}
                                                value={landing.highlights}
                                                onChange={(event) =>
                                                    setLanding((current) => ({
                                                        ...current,
                                                        highlights: event.target.value,
                                                    }))
                                                }
                                            />
                                        </div>
                                        <Input
                                            label="CTA label"
                                            value={landing.cta_label}
                                            onChange={(event) =>
                                                setLanding((current) => ({
                                                    ...current,
                                                    cta_label: event.target.value,
                                                }))
                                            }
                                        />
                                        <div className="space-y-0.5">
                                            <FieldLabel>Thank-you message</FieldLabel>
                                            <Textarea
                                                rows={2}
                                                value={landing.thank_you_message}
                                                onChange={(event) =>
                                                    setLanding((current) => ({
                                                        ...current,
                                                        thank_you_message: event.target.value,
                                                    }))
                                                }
                                            />
                                        </div>
                                        <Input
                                            label="Redirect URL"
                                            value={landing.redirect_url}
                                            onChange={(event) =>
                                                setLanding((current) => ({
                                                    ...current,
                                                    redirect_url: event.target.value,
                                                }))
                                            }
                                        />
                                        <PanelActions
                                            processing={processing}
                                            onSave={() => saveCampaign()}
                                            label="Save landing"
                                        />
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="gallery" className="border-border/70 px-2">
                                    <ToolTrigger icon="image-line" label="Gallery Images" />
                                    <AccordionContent className="space-y-4 px-1 pb-4">
                                        <Input
                                            label="Hero image URL"
                                            value={landing.hero_image}
                                            onChange={(event) =>
                                                setLanding((current) => ({
                                                    ...current,
                                                    hero_image: event.target.value,
                                                }))
                                            }
                                            placeholder="https://..."
                                        />
                                        {landing.hero_image ? (
                                            <div className="overflow-hidden rounded-lg border border-border">
                                                <img
                                                    src={landing.hero_image}
                                                    alt=""
                                                    className="aspect-[16/10] w-full object-cover"
                                                />
                                            </div>
                                        ) : (
                                            <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
                                                Multi-image gallery is coming soon. For now, set a
                                                hero image URL.
                                            </div>
                                        )}
                                        <PanelActions
                                            processing={processing}
                                            onSave={() => saveCampaign()}
                                            label="Save image"
                                        />
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </ScrollArea>
                    </aside>
                </div>
            </Layout.Content>
        </Layout>
    );
}

CampaignShow.layout = (page) => <PortalLayout children={page} />;

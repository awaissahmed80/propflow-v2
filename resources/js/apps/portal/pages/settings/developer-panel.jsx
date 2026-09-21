import { useEffect, useMemo, useState } from "react";
import { Link, router, usePage } from "@inertiajs/react";
import { toast } from "sonner";
import {
    rotate as rotateSecret,
    update as updateWebhook,
} from "@/actions/App/Http/Controllers/Portal/LeadWebhookController";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { SelectBox } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatDateTime, formatRelativeTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { SettingsSection } from "./settings-section";

const TABS = [
    { id: "webhook", label: "Webhook" },
    { id: "statuses", label: "Statuses" },
];

function pathFrom(url) {
    const raw = String(url || "/");

    if (raw.startsWith("//") || raw.startsWith("http://") || raw.startsWith("https://")) {
        try {
            const pathname = new URL(raw.startsWith("//") ? `https:${raw}` : raw).pathname;

            return pathname === "" ? "/" : pathname;
        } catch {
            return "/";
        }
    }

    return raw.startsWith("/") ? raw : `/${raw}`;
}

function copyText(value, successMessage) {
    if (!value) {
        toast.error("Nothing to copy");
        return;
    }

    navigator.clipboard.writeText(value).then(
        () => toast.success(successMessage),
        () => toast.error("Could not copy"),
    );
}

function readForm(webhook) {
    return {
        enabled: Boolean(webhook?.enabled),
        default_source: webhook?.default_source || "",
        default_campaign_id: webhook?.default_campaign_id ? String(webhook.default_campaign_id) : "",
        default_lead_stage_id: webhook?.default_lead_stage_id ? String(webhook.default_lead_stage_id) : "",
        default_assignee_id: webhook?.default_assignee_id ? String(webhook.default_assignee_id) : "",
    };
}

function payloadFrom(form) {
    return {
        enabled: Boolean(form.enabled),
        default_source: form.default_source || null,
        default_campaign_id: form.default_campaign_id ? Number(form.default_campaign_id) : null,
        default_lead_stage_id: form.default_lead_stage_id ? Number(form.default_lead_stage_id) : null,
        default_assignee_id: form.default_assignee_id ? Number(form.default_assignee_id) : null,
    };
}

function CopyField({ label, value, secret = false, revealed = true, onReveal, actions = null }) {
    const shown = !secret || revealed ? value || "" : value ? "•".repeat(Math.min(String(value).length, 24)) : "";

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <div className="flex items-center gap-0.5">
                    {secret ? (
                        <IconButton
                            type="button"
                            size="sm"
                            variant="ghost"
                            icon={revealed ? "eye-off-line" : "eye-line"}
                            aria-label={revealed ? "Hide signing secret" : "Show signing secret"}
                            onClick={onReveal}
                        />
                    ) : null}
                    <IconButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        icon="file-copy-line"
                        aria-label={`Copy ${label}`}
                        disabled={!value}
                        onClick={() => copyText(value, `${label} copied`)}
                    />
                    {actions}
                </div>
            </div>
            <div className="rounded-md border border-border/80 bg-muted/40 px-3 py-2 font-mono text-xs break-all text-foreground">
                {shown || "—"}
            </div>
        </div>
    );
}

function WebhookSection({
    leadWebhook,
    form,
    setForm,
    processing,
    revealed,
    setRevealed,
    errors,
    campaignOptions,
    stageOptions,
    assigneeOptions,
    sample,
    onSave,
    onRotate,
}) {
    return (
        <SettingsSection
            title="Webhook"
            icon="webhook-line"
            description="Post a signed JSON body to this URL. Phone or email is required. budget and notes are optional."
            actions={
                <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                        {form.enabled ? "On" : "Off"}
                    </span>
                    <Switch
                        checked={form.enabled}
                        disabled={processing}
                        aria-label="Lead webhook"
                        onCheckedChange={(checked) => {
                            const next = { ...form, enabled: Boolean(checked) };
                            setForm(next);
                            onSave(next, checked ? "Lead webhook turned on" : "Lead webhook turned off");
                        }}
                    />
                </div>
            }
        >
            <div className="space-y-5">
                <CopyField label="Webhook URL" value={leadWebhook?.url} />
                <CopyField
                    label="Signing secret"
                    value={leadWebhook?.signing_secret}
                    secret
                    revealed={revealed}
                    onReveal={() => setRevealed((current) => !current)}
                    actions={
                        <IconButton
                            type="button"
                            size="sm"
                            variant="ghost"
                            icon="refresh-line"
                            aria-label="Rotate signing secret"
                            disabled={processing || !leadWebhook?.signing_secret}
                            onClick={onRotate}
                        />
                    }
                />
                <p className="text-xs text-muted-foreground">
                    Sign the raw body with HMAC-SHA256 and send{" "}
                    <span className="font-mono text-foreground">
                        {leadWebhook?.signature_header || "X-Propflow-Signature"}
                    </span>
                    {" "}as sha256= followed by the digest.
                    {!leadWebhook?.signing_secret ? " Turn the webhook on to generate a signing secret." : ""}
                </p>

                <div className="grid gap-4 border-t border-border/60 pt-5 md:grid-cols-2">
                    <Input
                        label="Default source"
                        value={form.default_source}
                        placeholder="Webhook"
                        error={errors.default_source}
                        onChange={(event) =>
                            setForm((current) => ({ ...current, default_source: event.target.value }))
                        }
                    />
                    <SelectBox
                        label="Default campaign"
                        clearable
                        value={form.default_campaign_id}
                        options={campaignOptions}
                        placeholder="No campaign"
                        error={errors.default_campaign_id}
                        onValueChange={(value) =>
                            setForm((current) => ({ ...current, default_campaign_id: value || "" }))
                        }
                    />
                    <SelectBox
                        label="Default stage"
                        clearable
                        value={form.default_lead_stage_id}
                        options={stageOptions}
                        placeholder="New"
                        error={errors.default_lead_stage_id}
                        onValueChange={(value) =>
                            setForm((current) => ({ ...current, default_lead_stage_id: value || "" }))
                        }
                    />
                    <SelectBox
                        label="Default assignee"
                        clearable
                        value={form.default_assignee_id}
                        options={assigneeOptions}
                        placeholder="Unassigned"
                        error={errors.default_assignee_id}
                        onValueChange={(value) =>
                            setForm((current) => ({ ...current, default_assignee_id: value || "" }))
                        }
                    />
                </div>

                <div className="space-y-2 border-t border-border/60 pt-5">
                    <p className="text-xs font-medium text-muted-foreground">Campaign codes</p>
                    <p className="text-xs text-muted-foreground">
                        Send an active campaign’s public id as{" "}
                        <span className="font-mono">campaign_code</span>. An unknown code is rejected.
                    </p>
                    {(leadWebhook?.campaigns || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No active campaigns yet.</p>
                    ) : (
                        <ul className="divide-y divide-border/70">
                            {leadWebhook.campaigns.map((campaign) => (
                                <li key={campaign.id} className="flex items-center justify-between gap-3 py-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-foreground">{campaign.title}</p>
                                        <p className="truncate font-mono text-xs text-muted-foreground">{campaign.public_id}</p>
                                    </div>
                                    <IconButton
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        icon="file-copy-line"
                                        aria-label={`Copy code for ${campaign.title}`}
                                        onClick={() => copyText(campaign.public_id, "Campaign code copied")}
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="space-y-2 border-t border-border/60 pt-5">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-medium text-muted-foreground">Example payload</p>
                        <IconButton
                            type="button"
                            size="sm"
                            variant="ghost"
                            icon="file-copy-line"
                            aria-label="Copy example payload"
                            onClick={() => copyText(sample, "Example copied")}
                        />
                    </div>
                    <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 font-mono text-xs text-foreground">{sample}</pre>
                </div>

                <div className="flex justify-end border-t border-border/60 pt-5">
                    <Button type="button" disabled={processing} onClick={() => onSave(form, "Webhook settings saved")}>
                        Save
                    </Button>
                </div>
            </div>
        </SettingsSection>
    );
}

function StatusesTab({ deliveries }) {
    if (deliveries.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-16 text-center text-sm text-muted-foreground">
                No webhook requests yet.
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-border/80 bg-background">
            <table className="w-full text-left text-sm">
                <thead className="border-b border-border/70 bg-muted/30 text-xs font-medium text-muted-foreground">
                    <tr>
                        <th className="px-4 py-2.5 font-medium">When</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5 font-medium">HTTP</th>
                        <th className="px-4 py-2.5 font-medium">Lead</th>
                        <th className="px-4 py-2.5 font-medium">Detail</th>
                    </tr>
                </thead>
                <tbody>
                    {deliveries.map((delivery) => (
                        <tr key={delivery.id} className="border-b border-border/60 last:border-b-0">
                            <td className="px-4 py-3 whitespace-nowrap text-muted-foreground" title={formatDateTime(delivery.created_at)}>
                                {formatRelativeTime(delivery.created_at)}
                            </td>
                            <td className="px-4 py-3">
                                <span
                                    className={cn(
                                        "font-medium",
                                        delivery.status === "accepted"
                                            ? "text-emerald-700 dark:text-emerald-400"
                                            : "text-destructive",
                                    )}
                                >
                                    {delivery.status === "accepted" ? "Accepted" : "Rejected"}
                                </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{delivery.http_status}</td>
                            <td className="px-4 py-3">
                                {delivery.lead_code ? (
                                    <Link
                                        href={`/leads#${delivery.lead_code}`}
                                        className="font-mono text-xs text-primary hover:underline"
                                    >
                                        {delivery.lead_code}
                                    </Link>
                                ) : (
                                    <span className="text-muted-foreground">—</span>
                                )}
                            </td>
                            <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">
                                {delivery.message || (delivery.lead_code ? "Lead created" : "—")}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function DeveloperPanel({
    section,
    leadWebhook = null,
    stages = [],
    assignees = [],
}) {
    const { errors = {} } = usePage().props;
    const [tab, setTab] = useState("webhook");
    const [processing, setProcessing] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const [form, setForm] = useState(() => readForm(leadWebhook));

    useEffect(() => {
        setForm(readForm(leadWebhook));
    }, [leadWebhook]);

    const campaignOptions = useMemo(
        () =>
            (leadWebhook?.campaigns || []).map((campaign) => ({
                value: String(campaign.id),
                label: campaign.title,
            })),
        [leadWebhook?.campaigns],
    );

    const stageOptions = useMemo(
        () =>
            stages.map((stage) => ({
                value: String(stage.id),
                label: stage.title,
            })),
        [stages],
    );

    const assigneeOptions = useMemo(
        () =>
            assignees.map((assignee) => ({
                value: String(assignee.id),
                label: assignee.display_name,
            })),
        [assignees],
    );

    const sample = useMemo(() => {
        const campaign = leadWebhook?.campaigns?.[0];

        return JSON.stringify(
            {
                first_name: "Cathy",
                last_name: "Grady",
                phone_number: "+923001234567",
                email_address: "cathy@example.com",
                campaign_code: campaign?.public_id || "campaign-public-id",
                source: "Partner CRM",
            },
            null,
            2,
        );
    }, [leadWebhook?.campaigns]);

    const save = (next, successMessage) => {
        setProcessing(true);

        router.put(pathFrom(updateWebhook.url()), payloadFrom(next), {
            preserveScroll: true,
            onSuccess: () => {
                if (successMessage) {
                    toast.success(successMessage);
                }
            },
            onError: (formErrors) => {
                toast.error(Object.values(formErrors)[0] || "Unable to save webhook settings");
            },
            onFinish: () => setProcessing(false),
        });
    };

    const rotate = () => {
        if (!window.confirm("Rotate the signing secret? The current secret will stop working immediately.")) {
            return;
        }

        setProcessing(true);
        setRevealed(true);

        router.post(pathFrom(rotateSecret.url()), {}, {
            preserveScroll: true,
            onSuccess: () => toast.success("Signing secret rotated"),
            onError: () => toast.error("Unable to rotate the signing secret"),
            onFinish: () => setProcessing(false),
        });
    };

    const deliveries = leadWebhook?.deliveries || [];

    return (
        <div className="space-y-6">
            <div className="sticky top-0 z-10 -mx-6 border-b border-border/60 bg-background/95 px-6 py-3 backdrop-blur-sm">
                <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-foreground shadow-xs ring-1 ring-border/70">
                        <Icon name={section?.icon || "code-s-slash-line"} className="text-base" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold tracking-tight text-foreground">
                            {section?.label ?? "Developer"}
                        </h2>
                        <p className="truncate text-xs text-muted-foreground">
                            Accept leads from your own systems with a signed webhook.
                        </p>
                    </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Developer">
                    {TABS.map((item) => {
                        const active = tab === item.id;
                        const count = item.id === "statuses" ? deliveries.length : null;

                        return (
                            <button
                                key={item.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setTab(item.id)}
                                className={cn(
                                    "rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
                                    active
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                                )}
                            >
                                {item.label}
                                {count ? <span className="ml-1.5 text-xs opacity-80">{count}</span> : null}
                            </button>
                        );
                    })}
                </div>
            </div>

            {tab === "webhook" ? (
                <WebhookSection
                    leadWebhook={leadWebhook}
                    form={form}
                    setForm={setForm}
                    processing={processing}
                    revealed={revealed}
                    setRevealed={setRevealed}
                    errors={errors}
                    campaignOptions={campaignOptions}
                    stageOptions={stageOptions}
                    assigneeOptions={assigneeOptions}
                    sample={sample}
                    onSave={save}
                    onRotate={rotate}
                />
            ) : (
                <StatusesTab deliveries={deliveries} />
            )}
        </div>
    );
}

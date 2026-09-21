import { useEffect, useMemo, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import { toast } from "sonner";
import {
    disconnect as disconnectMeta,
    redirect as connectMeta,
    update as updateMeta,
} from "@/actions/App/Http/Controllers/Portal/MetaIntegrationController";
import {
    disconnect as disconnectWhatsApp,
    redirect as connectWhatsApp,
    update as updateWhatsApp,
} from "@/actions/App/Http/Controllers/Portal/WhatsAppIntegrationController";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
    Popover,
    PopoverContent,
    PopoverDescription,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
} from "@/components/ui/popover";
import { SelectBox } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const SETUP_GUIDES = {
    meta: {
        title: "What you need",
        description: "To sync Meta Lead Ads into Propflow:",
        steps: [
            "A Facebook Page you admin",
            "A Lead Ads (Instant) form on that Page",
            "Grant Page and lead permissions when connecting",
            "After connect, choose the Page and create a Facebook Lead Ads campaign",
        ],
    },
    whatsapp: {
        title: "What you need",
        description: "To take campaign leads from WhatsApp:",
        steps: [
            "A WhatsApp Business Account with a phone number",
            "Access through the Facebook Business that owns it",
            "Connect with WhatsApp Business permissions",
            "After connect, choose the number and create a WhatsApp campaign",
            "Message and conversation charges stay on your Meta bill",
        ],
    },
    google: {
        title: "Coming soon",
        description: "Google Lead Forms will connect here. You’ll need:",
        steps: [
            "A Google Ads account with lead form extensions",
            "Permission to link that account to Propflow",
        ],
    },
};

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

function formatRelativeTime(iso) {
    if (!iso) {
        return null;
    }

    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();

    if (Number.isNaN(diffMs)) {
        return null;
    }

    const minutes = Math.max(0, Math.round(diffMs / 60000));

    if (minutes < 1) {
        return "just now";
    }

    if (minutes < 60) {
        return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    }

    const hours = Math.round(minutes / 60);

    if (hours < 48) {
        return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    }

    const days = Math.round(hours / 24);

    return `${days} day${days === 1 ? "" : "s"} ago`;
}

function statusMeta(integration) {
    if (!integration.available && integration.status === "inactive") {
        return { label: "Coming soon", tone: "muted", dot: "bg-muted-foreground/50" };
    }

    switch (integration.status) {
        case "connected":
            return { label: "Connected", tone: "success", dot: "bg-emerald-500" };
        case "error":
            return { label: "Sync error", tone: "danger", dot: "bg-destructive" };
        case "syncing":
            return { label: "Syncing", tone: "warning", dot: "bg-amber-500" };
        default:
            return { label: "Inactive", tone: "muted", dot: "bg-muted-foreground/40" };
    }
}

function IntegrationSetupInfo({ provider, name }) {
    const guide = SETUP_GUIDES[provider] ?? {
        title: "What you need",
        description: `Setup details for ${name}.`,
        steps: ["Connect your account when this integration becomes available."],
    };

    return (
        <Popover>
            <PopoverTrigger
                aria-label={`Setup requirements for ${name}`}
                className={cn(
                    "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors",
                    "hover:bg-accent hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                )}
            >
                <Icon name="information-line" className="text-base" />
            </PopoverTrigger>
            <PopoverContent align="end" side="bottom" className="w-72 gap-0 p-0">
                <PopoverHeader className="border-b border-border/70 px-3.5 py-3">
                    <PopoverTitle className="text-sm">{guide.title}</PopoverTitle>
                    <PopoverDescription className="text-xs leading-relaxed">
                        {guide.description}
                    </PopoverDescription>
                </PopoverHeader>
                <ol className="space-y-2 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
                    {guide.steps.map((step, index) => (
                        <li key={step} className="flex gap-2">
                            <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground">
                                {index + 1}
                            </span>
                            <span>{step}</span>
                        </li>
                    ))}
                </ol>
            </PopoverContent>
        </Popover>
    );
}

function defaultLeadSettings(integration, stages = []) {
    const stored = integration?.lead_settings || {};
    const fallbackStage =
        stages.find((stage) => stage.label === "new")?.id ?? stages[0]?.id ?? "";

    return {
        sync_frequency: stored.sync_frequency || "realtime",
        default_owner: stored.default_owner || "round_robin",
        default_lead_stage_id: String(stored.default_lead_stage_id || fallbackStage || ""),
        notify_on_new_leads: Boolean(stored.notify_on_new_leads),
        deduplicate_by_email: Boolean(stored.deduplicate_by_email),
        auto_tag_source: Boolean(stored.auto_tag_source),
        page_id: integration?.external_id || "",
    };
}

function defaultWhatsAppLeadSettings(integration, stages = []) {
    const stored = integration?.lead_settings || {};
    const fallbackStage =
        stages.find((stage) => stage.label === "new")?.id ?? stages[0]?.id ?? "";

    return {
        sync_frequency: stored.sync_frequency || "realtime",
        default_owner: stored.default_owner || "round_robin",
        default_lead_stage_id: String(stored.default_lead_stage_id || fallbackStage || ""),
        notify_on_new_leads: Boolean(stored.notify_on_new_leads),
        deduplicate_by_phone: stored.deduplicate_by_phone !== false,
        auto_tag_source: stored.auto_tag_source !== false,
        phone_number_id: integration?.external_id || "",
    };
}

function IntegrationCard({ integration, onConnect, onConfigure, onDisconnect }) {
    const status = statusMeta(integration);
    const connected = integration.status === "connected";
    const errored = integration.status === "error";
    const relativeSync = formatRelativeTime(integration.last_synced_at);
    const pageCount = Array.isArray(integration.pages) ? integration.pages.length : 0;
    const phoneCount = Array.isArray(integration.phones) ? integration.phones.length : 0;
    const isWhatsApp = integration.provider === "whatsapp";
    const connectLabel =
        integration.provider === "meta"
            ? "Connect with Facebook"
            : integration.provider === "whatsapp"
              ? "Connect WhatsApp"
              : "Connect";

    return (
        <article className="flex flex-col rounded-xl border border-border/80 bg-card p-5 shadow-xs">
            <div className="flex items-start gap-3">
                <span
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                    style={{ backgroundColor: integration.brand_color }}
                >
                    <Icon name={integration.icon} className="text-xl" />
                </span>
                <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-bold tracking-tight text-foreground">
                        {integration.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {integration.description}
                    </p>
                </div>
                <IntegrationSetupInfo provider={integration.provider} name={integration.name} />
            </div>

            <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                {connected || errored || integration.status === "syncing" ? (
                    <>
                        {integration.external_name ? (
                            <p>
                                {isWhatsApp ? "Number" : "Page"}:{" "}
                                <span className="text-foreground">{integration.external_name}</span>
                                {!isWhatsApp && pageCount > 1 ? (
                                    <span className="text-muted-foreground">
                                        {" "}
                                        (+{pageCount - 1} more)
                                    </span>
                                ) : null}
                                {isWhatsApp && phoneCount > 1 ? (
                                    <span className="text-muted-foreground">
                                        {" "}
                                        (+{phoneCount - 1} more)
                                    </span>
                                ) : null}
                            </p>
                        ) : null}
                        <p>
                            Last sync:{" "}
                            <span className="text-foreground">
                                {errored && integration.last_error
                                    ? `Failed — ${relativeSync || "recently"}`
                                    : relativeSync || "Never"}
                            </span>
                        </p>
                        <p>
                            Leads synced:{" "}
                            <span className="font-medium text-foreground">
                                {Number(integration.leads_synced_count || 0).toLocaleString()}
                            </span>
                        </p>
                    </>
                ) : (
                    <p>
                        Status:{" "}
                        <span className="text-foreground">
                            {integration.available ? "Not connected" : "Coming soon"}
                        </span>
                    </p>
                )}
            </div>

            <div className="mt-4 flex items-center gap-2">
                <span className={cn("size-2 rounded-full", status.dot)} />
                <span
                    className={cn(
                        "text-xs font-medium",
                        status.tone === "success" && "text-emerald-600 dark:text-emerald-400",
                        status.tone === "danger" && "text-destructive",
                        status.tone === "warning" && "text-amber-600 dark:text-amber-400",
                        status.tone === "muted" && "text-muted-foreground"
                    )}
                >
                    {status.label}
                </span>
            </div>

            <div className="mt-5 flex gap-2">
                {!integration.available ? (
                    <Button type="button" variant="outline" className="w-full" disabled>
                        Coming soon
                    </Button>
                ) : connected || errored ? (
                    <>
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={() => onConfigure(integration)}
                        >
                            {errored ? "View error" : "Configure"}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1 text-destructive hover:text-destructive"
                            onClick={() => onDisconnect(integration)}
                        >
                            Disconnect
                        </Button>
                    </>
                ) : (
                    <Button
                        type="button"
                        variant="unstyled"
                        className="w-full border-0 font-semibold shadow-xs hover:brightness-95"
                        style={{
                            backgroundColor: isWhatsApp
                                ? "#128C7E"
                                : integration.brand_color || "#0866FF",
                            color: "#ffffff",
                        }}
                        onClick={() => onConnect(integration)}
                    >
                        {connectLabel}
                    </Button>
                )}
            </div>
        </article>
    );
}

function ToggleRow({ title, description, checked, onCheckedChange, disabled, last = false }) {
    return (
        <div className={cn("flex items-start justify-between gap-4 py-4", !last && "border-b border-border/60")}>
            <div className="min-w-0">
                <p className="text-base font-bold tracking-tight text-foreground">{title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            </div>
            <Switch
                className="mt-0.5 shrink-0"
                checked={checked}
                disabled={disabled}
                onCheckedChange={onCheckedChange}
            />
        </div>
    );
}

function MetaConfigureDialog({
    open,
    onOpenChange,
    integration,
    stages = [],
    assignees = [],
    processing,
    onSave,
}) {
    const [form, setForm] = useState(() => defaultLeadSettings(integration, stages));

    useEffect(() => {
        if (!open) {
            return;
        }

        setForm(defaultLeadSettings(integration, stages));
    }, [open, integration, stages]);

    if (!integration) {
        return null;
    }

    const syncOptions = [
        { value: "realtime", label: "Real-time" },
        { value: "hourly", label: "Hourly" },
        { value: "daily", label: "Daily" },
    ];

    const ownerOptions = [
        { value: "round_robin", label: "Auto-assign (round robin)" },
        ...assignees.map((user) => ({
            value: String(user.id),
            label: user.display_name,
        })),
    ];

    const stageOptions = stages.map((stage) => ({
        value: String(stage.id),
        label: stage.title,
    }));

    const pageOptions = (integration.pages || []).map((page) => ({
        value: String(page.id),
        label: page.instagram?.username
            ? `${page.name} · @${page.instagram.username}`
            : page.name,
    }));

    const updateField = (key, value) => {
        setForm((current) => ({ ...current, [key]: value }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
                <DialogHeader className="border-b border-border px-6 py-4">
                    <div className="flex items-start gap-3 pr-6">
                        <span
                            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                            style={{ backgroundColor: integration.brand_color || "#0866FF" }}
                        >
                            <Icon name={integration.icon || "meta-fill"} className="text-lg" />
                        </span>
                        <div className="min-w-0">
                            <DialogTitle>Configure Meta</DialogTitle>
                            <DialogDescription className="mt-0.5">
                                Lead Ads, Messenger & Instagram
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4 px-6 py-5">
                    {integration.last_error ? (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                            {integration.last_error}
                        </div>
                    ) : null}

                    {pageOptions.length > 1 ? (
                        <SelectBox
                            label="Primary Facebook Page"
                            value={form.page_id}
                            onValueChange={(value) => updateField("page_id", value)}
                            options={pageOptions}
                            placeholder="Select page"
                        />
                    ) : null}

                    <SelectBox
                        label="Sync frequency"
                        value={form.sync_frequency}
                        onValueChange={(value) => updateField("sync_frequency", value)}
                        options={syncOptions}
                        placeholder="Select"
                    />

                    <SelectBox
                        label="Default owner for new leads"
                        value={form.default_owner}
                        onValueChange={(value) => updateField("default_owner", value)}
                        options={ownerOptions}
                        placeholder="Select"
                    />

                    <SelectBox
                        label="Default pipeline stage"
                        value={form.default_lead_stage_id}
                        onValueChange={(value) => updateField("default_lead_stage_id", value)}
                        options={stageOptions}
                        placeholder="Select"
                    />

                    <div className="rounded-lg border border-border/70 px-4">
                        <ToggleRow
                            title="Notify On New Leads"
                            description="Send a Slack/email alert when a lead syncs in"
                            checked={form.notify_on_new_leads}
                            disabled={processing}
                            onCheckedChange={(checked) =>
                                updateField("notify_on_new_leads", Boolean(checked))
                            }
                        />
                        <ToggleRow
                            title="Deduplicate By Email"
                            description="Skip creating a lead if the email already exists"
                            checked={form.deduplicate_by_email}
                            disabled={processing}
                            onCheckedChange={(checked) =>
                                updateField("deduplicate_by_email", Boolean(checked))
                            }
                        />
                        <ToggleRow
                            title="Auto-Tag Source"
                            description="Tag every synced lead with this integration's name"
                            checked={form.auto_tag_source}
                            disabled={processing}
                            last
                            onCheckedChange={(checked) =>
                                updateField("auto_tag_source", Boolean(checked))
                            }
                        />
                    </div>
                </div>

                <DialogFooter className="border-t border-border bg-popover px-6 py-4">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={processing}
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        loading={processing}
                        disabled={!form.default_lead_stage_id}
                        onClick={() => onSave(form)}
                    >
                        Save changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function WhatsAppConfigureDialog({
    open,
    onOpenChange,
    integration,
    stages = [],
    assignees = [],
    processing,
    onSave,
}) {
    const [form, setForm] = useState(() => defaultWhatsAppLeadSettings(integration, stages));

    useEffect(() => {
        if (!open) {
            return;
        }

        setForm(defaultWhatsAppLeadSettings(integration, stages));
    }, [open, integration, stages]);

    if (!integration) {
        return null;
    }

    const syncOptions = [
        { value: "realtime", label: "Real-time" },
        { value: "hourly", label: "Hourly" },
        { value: "daily", label: "Daily" },
    ];

    const ownerOptions = [
        { value: "round_robin", label: "Auto-assign (round robin)" },
        ...assignees.map((user) => ({
            value: String(user.id),
            label: user.display_name,
        })),
    ];

    const stageOptions = stages.map((stage) => ({
        value: String(stage.id),
        label: stage.title,
    }));

    const phoneOptions = (integration.phones || []).map((phone) => ({
        value: String(phone.id),
        label: phone.verified_name
            ? `${phone.display_phone_number} · ${phone.verified_name}`
            : phone.display_phone_number,
    }));

    const updateField = (key, value) => {
        setForm((current) => ({ ...current, [key]: value }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
                <DialogHeader className="border-b border-border px-6 py-4">
                    <div className="flex items-start gap-3 pr-6">
                        <span
                            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                            style={{ backgroundColor: integration.brand_color || "#25D366" }}
                        >
                            <Icon name={integration.icon || "whatsapp-fill"} className="text-lg" />
                        </span>
                        <div className="min-w-0">
                            <DialogTitle>Configure WhatsApp</DialogTitle>
                            <DialogDescription className="mt-0.5">
                                Campaign intake from WhatsApp messages
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4 px-6 py-5">
                    <p className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                        {integration.billing_disclaimer ||
                            "Propflow connects your WhatsApp Business account. Message and conversation charges are billed by Meta to your business account."}
                    </p>

                    {integration.last_error ? (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                            {integration.last_error}
                        </div>
                    ) : null}

                    {phoneOptions.length > 0 ? (
                        <SelectBox
                            label="Primary WhatsApp number"
                            value={form.phone_number_id}
                            onValueChange={(value) => updateField("phone_number_id", value)}
                            options={phoneOptions}
                            placeholder="Select number"
                        />
                    ) : null}

                    <SelectBox
                        label="Sync frequency"
                        value={form.sync_frequency}
                        onValueChange={(value) => updateField("sync_frequency", value)}
                        options={syncOptions}
                        placeholder="Select"
                    />

                    <SelectBox
                        label="Default owner for new leads"
                        value={form.default_owner}
                        onValueChange={(value) => updateField("default_owner", value)}
                        options={ownerOptions}
                        placeholder="Select"
                    />

                    <SelectBox
                        label="Default pipeline stage"
                        value={form.default_lead_stage_id}
                        onValueChange={(value) => updateField("default_lead_stage_id", value)}
                        options={stageOptions}
                        placeholder="Select"
                    />

                    <div className="rounded-lg border border-border/70 px-4">
                        <ToggleRow
                            title="Notify On New Leads"
                            description="Send an alert when a WhatsApp lead syncs in"
                            checked={form.notify_on_new_leads}
                            disabled={processing}
                            onCheckedChange={(checked) =>
                                updateField("notify_on_new_leads", Boolean(checked))
                            }
                        />
                        <ToggleRow
                            title="Deduplicate By Phone"
                            description="Append to an open campaign lead when the same number messages again"
                            checked={form.deduplicate_by_phone}
                            disabled={processing}
                            onCheckedChange={(checked) =>
                                updateField("deduplicate_by_phone", Boolean(checked))
                            }
                        />
                        <ToggleRow
                            title="Auto-Tag Source"
                            description="Tag every synced lead as WhatsApp"
                            checked={form.auto_tag_source}
                            disabled={processing}
                            last
                            onCheckedChange={(checked) =>
                                updateField("auto_tag_source", Boolean(checked))
                            }
                        />
                    </div>
                </div>

                <DialogFooter className="border-t border-border bg-popover px-6 py-4">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={processing}
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        loading={processing}
                        disabled={!form.default_lead_stage_id}
                        onClick={() => onSave(form)}
                    >
                        Save changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function IntegrationsPanel({
    integrations = [],
    stages = [],
    assignees = [],
}) {
    const page = usePage();
    const [processing, setProcessing] = useState(false);
    const [configureOpen, setConfigureOpen] = useState(false);
    const [activeProvider, setActiveProvider] = useState("meta");

    const items = useMemo(() => integrations, [integrations]);
    const meta = items.find((item) => item.provider === "meta");
    const whatsapp = items.find((item) => item.provider === "whatsapp");
    const active = items.find((item) => item.provider === activeProvider) || meta;

    useEffect(() => {
        const success = page.props?.flash?.success;
        const error = page.props?.flash?.error;

        if (typeof success === "string" && success) {
            toast.success(success);
        }

        if (typeof error === "string" && error) {
            toast.error(error);
        }

        if (page.props?.flash?.open_meta_config && meta?.status === "connected") {
            setActiveProvider("meta");
            setConfigureOpen(true);
        }

        if (page.props?.flash?.open_whatsapp_config && whatsapp?.status === "connected") {
            setActiveProvider("whatsapp");
            setConfigureOpen(true);
        }
    }, [
        page.props?.flash?.success,
        page.props?.flash?.error,
        page.props?.flash?.open_meta_config,
        page.props?.flash?.open_whatsapp_config,
        meta?.status,
        whatsapp?.status,
    ]);

    const startConnect = (integration) => {
        if (integration.provider === "meta") {
            window.location.href = pathFrom(connectMeta.url());
            return;
        }

        if (integration.provider === "whatsapp") {
            window.location.href = pathFrom(connectWhatsApp.url());
        }
    };

    const openConfigure = (integration) => {
        setActiveProvider(integration.provider);
        setConfigureOpen(true);
    };

    const handleDisconnect = async (integration) => {
        if (integration.provider === "meta") {
            const confirmed = await confirm(
                "Disconnect Meta Lead Ads? Incoming lead webhooks will stop until you reconnect.",
                "Disconnect Meta"
            );

            if (!confirmed) {
                return;
            }

            setProcessing(true);
            router.delete(pathFrom(disconnectMeta.url()), {
                preserveScroll: true,
                onSuccess: () => toast.success("Meta disconnected"),
                onError: (errors) => toast.error(errors.message || "Unable to disconnect"),
                onFinish: () => setProcessing(false),
            });
            return;
        }

        if (integration.provider === "whatsapp") {
            const confirmed = await confirm(
                "Disconnect WhatsApp Business? Incoming campaign messages will stop until you reconnect.",
                "Disconnect WhatsApp"
            );

            if (!confirmed) {
                return;
            }

            setProcessing(true);
            router.delete(pathFrom(disconnectWhatsApp.url()), {
                preserveScroll: true,
                onSuccess: () => toast.success("WhatsApp disconnected"),
                onError: (errors) => toast.error(errors.message || "Unable to disconnect"),
                onFinish: () => setProcessing(false),
            });
        }
    };

    const handleSaveMetaConfig = (form) => {
        setProcessing(true);
        router.put(
            pathFrom(updateMeta.url()),
            {
                sync_frequency: form.sync_frequency,
                default_owner: form.default_owner,
                default_lead_stage_id: Number(form.default_lead_stage_id),
                notify_on_new_leads: form.notify_on_new_leads,
                deduplicate_by_email: form.deduplicate_by_email,
                auto_tag_source: form.auto_tag_source,
                page_id: form.page_id || null,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success("Meta Lead Ads settings saved");
                    setConfigureOpen(false);
                },
                onError: (errors) =>
                    toast.error(
                        errors.default_lead_stage_id ||
                            errors.default_owner ||
                            errors.page_id ||
                            errors.message ||
                            "Unable to save settings"
                    ),
                onFinish: () => setProcessing(false),
            }
        );
    };

    const handleSaveWhatsAppConfig = (form) => {
        setProcessing(true);
        router.put(
            pathFrom(updateWhatsApp.url()),
            {
                sync_frequency: form.sync_frequency,
                default_owner: form.default_owner,
                default_lead_stage_id: Number(form.default_lead_stage_id),
                notify_on_new_leads: form.notify_on_new_leads,
                deduplicate_by_phone: form.deduplicate_by_phone,
                auto_tag_source: form.auto_tag_source,
                phone_number_id: form.phone_number_id || null,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success("WhatsApp settings saved");
                    setConfigureOpen(false);
                },
                onError: (errors) =>
                    toast.error(
                        errors.default_lead_stage_id ||
                            errors.default_owner ||
                            errors.phone_number_id ||
                            errors.message ||
                            "Unable to save settings"
                    ),
                onFinish: () => setProcessing(false),
            }
        );
    };

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                    Integrations
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                    Connect lead sources and sync your CRM automatically.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map((integration) => (
                    <IntegrationCard
                        key={integration.provider}
                        integration={integration}
                        onConnect={startConnect}
                        onConfigure={openConfigure}
                        onDisconnect={handleDisconnect}
                    />
                ))}
            </div>

            {activeProvider === "whatsapp" ? (
                <WhatsAppConfigureDialog
                    open={configureOpen}
                    onOpenChange={setConfigureOpen}
                    integration={active}
                    stages={stages}
                    assignees={assignees}
                    processing={processing}
                    onSave={handleSaveWhatsAppConfig}
                />
            ) : (
                <MetaConfigureDialog
                    open={configureOpen}
                    onOpenChange={setConfigureOpen}
                    integration={active}
                    stages={stages}
                    assignees={assignees}
                    processing={processing}
                    onSave={handleSaveMetaConfig}
                />
            )}
        </div>
    );
}

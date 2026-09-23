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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatRelativeTime, statusMeta } from "./integrations-helpers";

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

export function IntegrationSetupInfo({ provider, name }) {
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

export function IntegrationCard({ integration, onConnect, onConfigure, onDisconnect }) {
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

export function ToggleRow({ title, description, checked, onCheckedChange, disabled, last = false }) {
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

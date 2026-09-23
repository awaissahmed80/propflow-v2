export function pathFrom(url) {
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

export function formatRelativeTime(iso) {
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

export function statusMeta(integration) {
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

export function defaultLeadSettings(integration, stages = []) {
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

export function defaultWhatsAppLeadSettings(integration, stages = []) {
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

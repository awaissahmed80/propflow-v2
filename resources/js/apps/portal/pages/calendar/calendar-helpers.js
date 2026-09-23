import { toSelectedList } from "@/components/ui/filter-menu";
import { toDayjs } from "@/lib/datetime";

export const MODULE_DOT = {
    yellow: "bg-yellow-500",
    blue: "bg-blue-500",
    emerald: "bg-emerald-500",
    violet: "bg-violet-500",
    slate: "bg-slate-500",
};

export const MODULE_SOFT = {
    yellow: "bg-yellow-500/12 border-yellow-500/25",
    blue: "bg-blue-500/12 border-blue-500/25",
    emerald: "bg-emerald-500/12 border-emerald-500/25",
    violet: "bg-violet-500/12 border-violet-500/25",
    slate: "bg-slate-500/12 border-slate-500/25",
};

export const MODULE_BAR = {
    yellow: "bg-yellow-500",
    blue: "bg-blue-500",
    emerald: "bg-emerald-500",
    violet: "bg-violet-500",
    slate: "bg-slate-500",
};

export const MODULE_ICON = {
    leads: "customer-service-line",
    orders: "book-2-line",
    payments: "money-dollar-circle-line",
    campaigns: "focus-3-line",
    projects: "community-line",
};

export function toFilterParam(value) {
    const list = toSelectedList(value);

    return list.length > 0 ? list.join(",") : "";
}

export function pathFrom(url) {
    const raw = String(url || "/");

    if (raw.startsWith("//") || raw.startsWith("http://") || raw.startsWith("https://")) {
        try {
            return new URL(raw.startsWith("//") ? `https:${raw}` : raw).pathname || "/";
        } catch {
            return "/";
        }
    }

    return raw.startsWith("/") ? raw : `/${raw}`;
}

export function eventTimeLabel(event) {
    if (event?.allDay) {
        return "All day";
    }

    const when = toDayjs(event?.when);

    return when ? when.format("h:mm A") : "—";
}

export function detailMatchesEvent(event, openedLead, openedOrder, openedCampaign, openedProject) {
    const type = event?.subject?.type;
    const code = event?.subject?.code;

    if (!type || !code) {
        return null;
    }

    if (type === "lead" && openedLead?.code === code) {
        return { kind: "lead", data: openedLead };
    }

    if (type === "order" && openedOrder?.code === code) {
        return { kind: "order", data: openedOrder };
    }

    if (type === "campaign" && (openedCampaign?.slug === code || openedCampaign?.public_id === code)) {
        return { kind: "campaign", data: openedCampaign };
    }

    if (type === "project" && openedProject?.code === code) {
        return { kind: "project", data: openedProject };
    }

    return null;
}

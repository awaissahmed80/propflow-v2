import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { update } from "@/actions/App/Http/Controllers/Portal/OrderController";
import { Avatar } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { StageBadge } from "@/components/ui/stage-badge";
import { cn } from "@/lib/utils";
import { statusTitle, statusColor } from "./booking-stage-dialogs";

function pathFrom(url) {
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


const MANUAL_STATUS_LABELS = ["hold", "in_progress"];

const AUTOMATED_STATUS_LABELS = [
    "overdue",
    "defaulter",
    "litigation",
    "completed",
    "cancelled",
];

export function StatusControl({ order, status, orderStatuses = [], locked = false }) {
    const statusLabel = statusTitle(status, orderStatuses);
    const color =
        statusColor(status, orderStatuses) || "var(--muted-foreground)";
    const isAutomated = AUTOMATED_STATUS_LABELS.includes(status);
    const manualOptions = (orderStatuses || []).filter(
        (item) =>
            item?.label &&
            MANUAL_STATUS_LABELS.includes(item.label) &&
            item.is_enabled !== false,
    );

    const patchStatus = (next) => {
        if (!next || next === status || locked) {
            return;
        }

        router.patch(
            pathFrom(update.url(order.code)),
            { status: next },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => toast.success("Status updated"),
                onError: (errors) =>
                    toast.error(Object.values(errors)[0] || "Unable to update status"),
            },
        );
    };

    if (locked || isAutomated || manualOptions.length === 0) {
        return (
            <StageBadge
                label={statusLabel || status || "—"}
                color={color}
            />
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <button
                        type="button"
                        className="inline-flex max-w-40 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-90"
                        style={{
                            backgroundColor: `${color}22`,
                            borderColor: `${color}55`,
                            color,
                        }}
                    >
                        <span className="truncate">{statusLabel || status}</span>
                        <Icon name="arrow-down-s-line" className="shrink-0 text-sm opacity-70" />
                    </button>
                }
            />
            <DropdownMenuContent align="end" className="min-w-40">
                {manualOptions.map((item) => (
                    <DropdownMenuItem
                        key={item.label}
                        disabled={item.label === status}
                        className={cn(item.label === status && "bg-accent")}
                        onClick={() => patchStatus(item.label)}
                    >
                        <span
                            className="size-2 shrink-0 rounded-full"
                            style={{
                                backgroundColor:
                                    statusColor(item.label, orderStatuses) ||
                                    "var(--muted-foreground)",
                            }}
                            aria-hidden
                        />
                        {item.title || statusTitle(item.label, orderStatuses)}
                        {item.label === status ? (
                            <Icon name="check-line" className="ml-auto text-sm" />
                        ) : null}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function BuyerBlock({ contact, deal = null, stage = "token" }) {
    if (!contact) {
        return (
            <div className="min-w-0 text-sm text-muted-foreground">
                No buyer linked
            </div>
        );
    }

    const name = contact.display_name || "Buyer";
    const booking = deal?.booking || {};
    const pastToken =
        Boolean(booking.verified_at) ||
        ["booking_kyc", "active", "closed"].includes(stage);

    const lines = [contact.phone_number].filter(Boolean);

    if (pastToken) {
        const identity =
            booking.identity_number ||
            contact.cnic ||
            null;
        const identityLine = identity
            ? `${(booking.identity_kind || "cnic").toUpperCase()} ${identity}`
            : null;

        lines.push(
            ...[
                contact.email_address,
                identityLine,
                booking.local_phone && booking.local_phone !== contact.phone_number
                    ? `Local ${booking.local_phone}`
                    : null,
                contact.address,
            ].filter(Boolean),
        );
    }

    return (
        <div className="flex min-w-0 items-start gap-2.5">
            <Avatar
                name={name}
                size="default"
                className="size-14 shrink-0"
                textClass="text-base"
            />
            <div className="min-w-0 flex-1">
                <p className="truncate text-xl font-bold tracking-tight text-foreground">
                    {name}
                </p>
                {lines.map((line) => (
                    <p key={line} className="truncate text-sm text-muted-foreground">
                        {line}
                    </p>
                ))}
            </div>
        </div>
    );
}

export function ProjectDetailsCard({ order, deal }) {
    const project = order?.project;
    const unit = order?.unit;
    const booking = deal?.booking || {};

    const unitTitle = [unit?.name, unit?.code].filter(Boolean).join(" · ") || null;
    const unitMeta = [
        unit?.size != null
            ? `${Number(unit.size)}${unit.area_type ? ` ${unit.area_type}` : ""}`.trim()
            : null,
        unit?.type,
        booking.category && booking.category !== "standard" ? booking.category : null,
    ]
        .filter(Boolean)
        .join(" · ");

    const plotLine = [
        booking.plot_or_file,
        booking.dimensions,
        booking.block,
        booking.sector,
        booking.phase,
    ]
        .filter(Boolean)
        .join(" · ");

    const lines = [
        project?.title,
        unitTitle,
        unitMeta || null,
        plotLine || null,
        project?.location,
    ].filter(Boolean);

    if (!project && !unit) {
        return (
            <section className="text-sm text-muted-foreground">
                No project linked
            </section>
        );
    }

    return (
        <section>
            <div className="flex min-w-0 items-start gap-2.5">
                {project?.thumbnail ? (
                    <img
                        src={project.thumbnail}
                        alt=""
                        className="size-10 shrink-0 rounded-md object-cover"
                    />
                ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Icon name="community-line" className="text-lg" />
                    </span>
                )}
                <div className="min-w-0 flex-1 space-y-0.5">
                    <h3 className="text-sm font-semibold text-foreground">Project Details</h3>
                    {lines.map((line) => (
                        <p
                            key={line}
                            className={cn(
                                "truncate text-sm",
                                line === project?.title
                                    ? "font-medium text-foreground"
                                    : "text-muted-foreground",
                            )}
                        >
                            {line}
                        </p>
                    ))}
                </div>
            </div>
        </section>
    );
}

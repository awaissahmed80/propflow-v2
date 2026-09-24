import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { update } from "@/actions/App/Http/Controllers/Portal/OrderController";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { StageBadge } from "@/components/ui/stage-badge";
import { formatMoney } from "@/lib/currency";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { ProjectCardPopover, projectLocationLabel } from "../../components/project-card";
import {
    UNIT_STATUS_LABELS,
    unitSizeLabel,
    unitStatusTone,
} from "../../components/unit-card";
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

function OverviewMetric({ label, value, hint = null, tone = "default" }) {
    const valueTone =
        tone === "success"
            ? "text-emerald-700 dark:text-emerald-400"
            : tone === "warning"
              ? "text-amber-700 dark:text-amber-400"
              : "text-foreground";

    return (
        <div className="min-w-0 rounded-xl border border-border/70 bg-background px-3.5 py-3 shadow-xs">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p
                className={cn(
                    "mt-1 truncate text-lg font-semibold tracking-tight tabular-nums",
                    valueTone,
                )}
            >
                {value}
            </p>
            {hint ? (
                <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
            ) : null}
        </div>
    );
}

export function DealOverviewSection({
    order,
    totalPrice,
    bookingAmount,
    paid,
    remaining,
}) {
    const outstanding = Number(remaining) || 0;
    const paidAmount = Number(paid) || 0;

    return (
        <section className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                    <Icon name="funds-line" className="text-base" />
                    Deal Overview
                </h3>
                <p className="text-xs text-muted-foreground">
                    Booked{" "}
                    <span className="font-medium text-foreground">
                        {formatDateTime(order?.booked_at) || "—"}
                    </span>
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <OverviewMetric
                    label="Total Price"
                    value={formatMoney(totalPrice)}
                />
                <OverviewMetric
                    label="Booking Amount"
                    value={
                        bookingAmount != null ? formatMoney(bookingAmount) : "—"
                    }
                />
                <OverviewMetric
                    label="Paid"
                    value={formatMoney(paidAmount)}
                    tone={paidAmount > 0 ? "success" : "default"}
                />
                <OverviewMetric
                    label="Remaining"
                    value={formatMoney(outstanding)}
                    tone={outstanding > 0 ? "warning" : "success"}
                />
            </div>
        </section>
    );
}

/**
 * Compact unit + project summary for booking overview.
 *
 * @param {object} props
 * @param {object} props.order
 * @param {object} [props.deal]
 */
export function BookingPropertyCard({ order }) {
    const project = order?.project;
    const unit = order?.unit;

    if (!project && !unit) {
        return (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
                No unit or project linked
            </div>
        );
    }

    const unitName = unit?.name || "—";
    const sizeLabel = unitSizeLabel(unit);
    const statusLabel = UNIT_STATUS_LABELS[unit?.status] || unit?.status || null;
    const features = Array.isArray(unit?.features)
        ? unit.features.filter(Boolean)
        : [];
    const address = projectLocationLabel(project);
    const hasPrice = unit?.price != null && Number(unit.price) > 0;

    const facts = [
        sizeLabel ? { label: "Size", value: sizeLabel } : null,
        unit?.type ? { label: "Type", value: unit.type } : null,
        unit?.block?.title ? { label: "Block", value: unit.block.title } : null,
        unit?.sector ? { label: "Sector", value: unit.sector } : null,
        unit?.quantity != null
            ? { label: "Quantity", value: String(Number(unit.quantity)) }
            : null,
        hasPrice ? { label: "List price", value: formatMoney(unit.price) } : null,
    ].filter(Boolean);

    return (
        <article className="rounded-xl border border-border/70 bg-card p-2.5 shadow-xs">
            <div className="flex min-w-0 gap-3">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-20">
                    {project?.thumbnail ? (
                        <img
                            src={project.thumbnail}
                            alt=""
                            className="absolute inset-0 size-full object-cover"
                        />
                    ) : (
                        <div className="flex size-full items-center justify-center text-muted-foreground">
                            <Icon name="community-line" className="text-xl" />
                        </div>
                    )}
                </div>

                <div className="min-w-0 flex-1 space-y-2 py-0.5 pr-0.5">
                    <div className="flex min-w-0 items-center justify-between gap-2">
                        <h4 className="truncate text-sm font-semibold tracking-tight text-foreground">
                            Unit {unitName}
                        </h4>
                        {statusLabel ? (
                            <span
                                className={cn(
                                    "shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium",
                                    unitStatusTone(unit?.status),
                                )}
                            >
                                {statusLabel}
                            </span>
                        ) : null}
                    </div>

                    {facts.length > 0 ? (
                        <div
                            className={cn(
                                "grid gap-x-3 gap-y-1.5",
                                facts.length === 1
                                    ? "grid-cols-1"
                                    : "grid-cols-2 sm:grid-cols-3",
                            )}
                        >
                            {facts.map((fact) => (
                                <div key={fact.label} className="min-w-0">
                                    <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                                        {fact.label}
                                    </p>
                                    <p className="truncate text-xs font-medium text-foreground">
                                        {fact.value}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {unit?.description ? (
                        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {unit.description}
                        </p>
                    ) : null}

                    {features.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {features.map((feature) => (
                                <span
                                    key={String(feature)}
                                    className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                                >
                                    {String(feature)}
                                </span>
                            ))}
                        </div>
                    ) : null}

                    <div className="space-y-0.5 border-t border-border/70 pt-2">
                        {project?.title ? (
                            project.code ? (
                                <ProjectCardPopover
                                    project={project}
                                    className="-ml-1 max-w-full px-1 py-0 text-xs font-medium text-foreground"
                                >
                                    <span className="truncate">{project.title}</span>
                                </ProjectCardPopover>
                            ) : (
                                <p className="truncate text-xs font-medium text-foreground">
                                    {project.title}
                                </p>
                            )
                        ) : (
                            <p className="text-xs text-muted-foreground">No project linked</p>
                        )}
                        {address && address !== "—" ? (
                            <p className="truncate text-xs text-muted-foreground">
                                {address}
                            </p>
                        ) : null}
                    </div>
                </div>
            </div>
        </article>
    );
}

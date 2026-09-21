import { useMemo, useState } from "react";
import { Link, router } from "@inertiajs/react";
import { toast } from "sonner";
import { cancel } from "@/actions/App/Http/Controllers/Portal/OrderController";
import { showBookingForm as bookingForm } from "@/actions/App/Http/Controllers/Portal/DealController";
import { ContactCard, LeadCard, UserCard } from "@/components/ui/entity-card";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatMoney } from "@/lib/currency";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { resolveBookingStages, stageTitle, BookingStageDialog } from "./booking-stage-dialogs";

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

function nextActionForStage(stage) {
    if (stage === "booking") {
        return "booking";
    }

    if (stage === "plan") {
        return "plan";
    }

    if (stage === "tracking") {
        return "tracking";
    }

    if (stage === "transfer") {
        return "transfer";
    }

    if (stage === "handover") {
        return "handover";
    }

    return null;
}

function stageIndex(stageId, stages) {
    if (stageId === "delivered") {
        return stages.length;
    }

    const index = stages.findIndex((item) => item.id === stageId);

    return index < 0 ? 0 : index;
}

function StageProgress({ stages, currentStage, color }) {
    const current = stageIndex(currentStage, stages);
    const label =
        currentStage === "delivered"
            ? "Delivered"
            : stages[Math.min(current, stages.length - 1)]?.label || "Booking";

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-medium text-foreground">{label}</p>
                <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {Math.min(current + 1, stages.length)}/{stages.length}
                </p>
            </div>
            <div className="flex items-center gap-1">
                {stages.map((item, index) => {
                    const done = index < current;
                    const active = index === current;

                    return (
                        <span
                            key={item.id}
                            title={item.label}
                            className={cn(
                                "h-1.5 min-w-0 flex-1 rounded-full",
                                !done && !active && "bg-border",
                            )}
                            style={
                                done || active
                                    ? { backgroundColor: color || "var(--primary)" }
                                    : undefined
                            }
                        />
                    );
                })}
            </div>
        </div>
    );
}

export default function BookingDetailPanel({ payload, orderStages = [], onClose }) {
    const order = payload?.order;
    const deal = payload?.deal;
    const stages = resolveBookingStages(orderStages);
    const [tab, setTab] = useState("overview");
    const [dialogAction, setDialogAction] = useState(null);

    const stage = deal?.stage || order?.stage || "booking";
    const cancelled = order?.status === "cancelled";
    const delivered = order?.status === "delivered" || stage === "delivered";
    const stageColor =
        (orderStages || []).find((item) => item.label === stage)?.color ||
        stages.find((item) => item.id === stage)?.color ||
        "var(--primary)";

    const leadHref = order?.lead?.code ? `/leads?lead=${order.lead.code}` : null;

    const advanceLabel = useMemo(() => {
        if (cancelled || delivered) {
            return null;
        }

        const action = nextActionForStage(stage);

        if (action === "booking") {
            return "Complete Booking & KYC";
        }

        if (action === "plan") {
            return "Set payment plan";
        }

        if (action === "tracking") {
            return "Record payment";
        }

        if (action === "transfer") {
            return "Record balloting";
        }

        if (action === "handover") {
            return deal?.handover_ready_at ? "Mark delivered" : "Ready for handover";
        }

        return null;
    }, [cancelled, delivered, stage, deal?.handover_ready_at]);

    if (!order) {
        return null;
    }

    const openAdvance = () => {
        if (stage === "handover" && deal?.handover_ready_at) {
            setDialogAction("deliver");
            return;
        }

        setDialogAction(nextActionForStage(stage));
    };

    const selectStage = (item) => {
        if (cancelled || delivered || item.id === stage) {
            return;
        }

        const action =
            item.id === "handover" && deal?.handover_ready_at
                ? "deliver"
                : nextActionForStage(item.id) || nextActionForStage(stage);

        if (action) {
            setDialogAction(action);
        }
    };

    const handleCancel = () => {
        if (!window.confirm(`Cancel booking ${order.code}? The unit will be released.`)) {
            return;
        }

        router.post(
            pathFrom(cancel.url(order.code)),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success("Booking cancelled");
                    onClose?.();
                },
                onError: () => toast.error("Unable to cancel booking"),
            },
        );
    };

    const installments = deal?.installments || [];
    const paid = Number(deal?.ledger?.total_paid) || 0;
    const outstanding = Number(deal?.ledger?.total_outstanding) || 0;
    const collectionTotal = paid + outstanding;
    const collectionPct =
        collectionTotal > 0 ? Math.min(100, Math.round((paid / collectionTotal) * 100)) : 0;

    return (
        <div className="flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden bg-card">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                    <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: stageColor }}
                        aria-hidden
                    />
                    <span className="truncate font-mono text-xs text-muted-foreground">{order.code}</span>
                    {cancelled ? (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                            Cancelled
                        </span>
                    ) : null}
                    {delivered ? (
                        <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium tracking-wide text-emerald-700 uppercase dark:text-emerald-300">
                            Delivered
                        </span>
                    ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <Button type="button" size="sm" variant="outline" className="max-w-36 gap-1">
                                    <span className="truncate">
                                        {stageTitle(stage, orderStages)}
                                    </span>
                                    <Icon name="arrow-down-s-line" className="shrink-0 opacity-60" />
                                </Button>
                            }
                        />
                        <DropdownMenuContent align="end" className="min-w-44">
                            {stages.map((item) => (
                                <DropdownMenuItem
                                    key={item.id}
                                    disabled={cancelled || delivered}
                                    onClick={() => selectStage(item)}
                                    className={cn(item.id === stage && "bg-accent")}
                                >
                                    {item.label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <IconButton
                        type="button"
                        size="sm"
                        className="rounded-full"
                        icon="close-line"
                        aria-label="Close"
                        variant="ghost"
                        onClick={onClose}
                    />
                </div>
            </div>

            <div className="shrink-0 space-y-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold tracking-tight text-foreground">
                        {order.contact?.display_name || "Booking"}
                    </h2>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {[order.project?.title, order.unit?.code || order.unit?.name]
                            .filter(Boolean)
                            .join(" · ") || "No unit linked"}
                    </p>
                </div>
                <StageProgress
                    stages={stages}
                    currentStage={delivered ? "delivered" : stage}
                    color={stageColor}
                />
            </div>

            <div className="flex shrink-0 gap-1 border-b border-border px-4 py-2">
                {[
                    ["overview", "Overview"],
                    ["installments", "Installment Plan"],
                ].map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setTab(id)}
                        className={cn(
                            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                            tab === id
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-4 px-4 py-4">
                    {tab === "overview" ? (
                        <>
                            {!cancelled && !delivered && advanceLabel ? (
                                <Button type="button" className="w-full" onClick={openAdvance}>
                                    {advanceLabel}
                                </Button>
                            ) : null}

                            <section className="rounded-xl border border-border/80 p-3">
                                <div className="mb-3 flex items-center justify-between gap-2">
                                    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                        Deal
                                    </h3>
                                    <span className="truncate text-[11px] font-medium capitalize text-muted-foreground">
                                        {order.booking_kind || "—"}
                                    </span>
                                </div>
                                <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
                                    <div className="min-w-0">
                                        <dt className="text-[11px] text-muted-foreground">Sale amount</dt>
                                        <dd className="truncate text-sm font-semibold tabular-nums">
                                            {formatMoney(order.agreed_price)}
                                        </dd>
                                    </div>
                                    <div className="min-w-0">
                                        <dt className="text-[11px] text-muted-foreground">Booked</dt>
                                        <dd className="truncate text-sm font-medium">
                                            {formatDateTime(order.booked_at) || "—"}
                                        </dd>
                                    </div>
                                </dl>
                                {deal?.ledger ? (
                                    <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
                                        <div className="flex items-center justify-between gap-2 text-xs">
                                            <span className="text-muted-foreground">
                                                Paid{" "}
                                                <span className="font-semibold tabular-nums text-foreground">
                                                    {formatMoney(paid)}
                                                </span>
                                            </span>
                                            <span className="text-muted-foreground">
                                                Due{" "}
                                                <span className="font-semibold tabular-nums text-foreground">
                                                    {formatMoney(outstanding)}
                                                </span>
                                            </span>
                                        </div>
                                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                            <div
                                                className="h-full rounded-full bg-emerald-500"
                                                style={{ width: `${collectionPct}%` }}
                                            />
                                        </div>
                                    </div>
                                ) : null}
                            </section>

                            <section className="rounded-xl border border-border/80 p-3">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                        Payment plan
                                    </h3>
                                    {deal?.plan ? (
                                        <button
                                            type="button"
                                            className="text-[11px] font-medium text-primary hover:underline"
                                            onClick={() => setTab("installments")}
                                        >
                                            View schedule
                                        </button>
                                    ) : null}
                                </div>
                                {deal?.plan ? (
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-foreground">
                                            {deal.plan.title || "Payment plan"}
                                        </p>
                                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                                            {deal.plan.summary ||
                                                `${deal.plan.frequency || "Monthly"} · ${deal.plan.installment_count || 0} installments`}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No payment plan set yet.
                                    </p>
                                )}
                            </section>

                            <section className="space-y-2">
                                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                    People
                                </h3>
                                <div className="grid grid-cols-1 gap-2">
                                    <LeadCard lead={order.lead} href={leadHref} size="sm" />
                                    <ContactCard contact={order.contact} size="sm" />
                                    <UserCard user={order.assignee} label="Operations" size="sm" />
                                    <UserCard user={order.sold_by} label="Sales" size="sm" />
                                </div>
                            </section>

                            {leadHref ? (
                                <Link
                                    href={leadHref}
                                    className="flex items-center justify-between gap-2 rounded-xl border border-border/80 px-3 py-2.5 text-sm transition-colors hover:bg-muted/40"
                                >
                                    <span className="min-w-0 truncate text-muted-foreground">
                                        Open linked lead
                                    </span>
                                    <Icon
                                        name="arrow-right-s-line"
                                        className="shrink-0 text-muted-foreground"
                                    />
                                </Link>
                            ) : null}
                        </>
                    ) : null}

                    {tab === "installments" ? (
                        <section className="space-y-3">
                            {deal?.plan ? (
                                <div className="rounded-xl border border-border/80 p-3">
                                    <p className="truncate text-sm font-semibold text-foreground">
                                        {deal.plan.title || "Payment plan"}
                                    </p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        {deal.plan.summary ||
                                            `${deal.plan.frequency || "Monthly"} · ${deal.plan.installment_count || 0} installments`}
                                    </p>
                                    {deal.ledger ? (
                                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs">
                                            <span className="text-muted-foreground">
                                                Paid{" "}
                                                <span className="font-semibold tabular-nums text-foreground">
                                                    {formatMoney(paid)}
                                                </span>
                                            </span>
                                            <span className="text-muted-foreground">
                                                Due{" "}
                                                <span className="font-semibold tabular-nums text-foreground">
                                                    {formatMoney(outstanding)}
                                                </span>
                                            </span>
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}

                            {installments.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
                                    No installment schedule yet. Set the payment plan to generate rows.
                                </div>
                            ) : (
                                <ul className="overflow-hidden rounded-xl border border-border/80">
                                    {installments.map((row, index) => {
                                        const isPaid =
                                            String(row.status || "").toLowerCase() === "paid";

                                        return (
                                            <li
                                                key={row.id || row.sequence}
                                                className={cn(
                                                    "flex min-w-0 items-center gap-2.5 px-3 py-2.5",
                                                    index > 0 && "border-t border-border/60",
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                                                        isPaid
                                                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                                            : "bg-muted text-muted-foreground",
                                                    )}
                                                >
                                                    {isPaid ? (
                                                        <Icon name="check-line" className="text-xs" />
                                                    ) : (
                                                        row.sequence || index + 1
                                                    )}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium text-foreground">
                                                        {row.label}
                                                    </p>
                                                    <p className="truncate text-[11px] text-muted-foreground">
                                                        {row.due_on || "No due date"} · {row.status}
                                                    </p>
                                                </div>
                                                <p className="shrink-0 text-sm font-semibold tabular-nums">
                                                    {formatMoney(row.amount)}
                                                </p>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>
                    ) : null}
                </div>
            </ScrollArea>

            <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-4 py-3">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(pathFrom(bookingForm.url(order.code)), "_blank")}
                >
                    Print form
                </Button>
                {!cancelled && !delivered ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={handleCancel}
                    >
                        Cancel booking
                    </Button>
                ) : null}
            </div>

            <BookingStageDialog
                open={Boolean(dialogAction)}
                onOpenChange={(next) => {
                    if (!next) {
                        setDialogAction(null);
                    }
                }}
                action={dialogAction}
                order={order}
                deal={deal}
            />
        </div>
    );
}

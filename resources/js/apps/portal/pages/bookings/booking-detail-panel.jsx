import { useEffect, useMemo, useState } from "react";
import { Link, router } from "@inertiajs/react";
import { toast } from "sonner";
import { cancel } from "@/actions/App/Http/Controllers/Portal/OrderController";
import { FilePreview } from "@/components/file-preview";
import { UserCard } from "@/components/ui/entity-card";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { StageBadge } from "@/components/ui/stage-badge";
import { formatMoney } from "@/lib/currency";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { ActivityTimeline } from "./booking-activity-timeline";
import { BookingAssigneeMenu } from "./booking-assignment-menus";
import {
    BuyerBlock,
    ProjectDetailsCard,
    StatusControl,
} from "./booking-detail-sections";
import { InstallmentsTab } from "./booking-installments-tab";
import { BookingDocumentsSection } from "./booking-documents-section";
import { NoteComposer } from "./booking-note-composer";
import { PaymentsTab } from "./booking-payments-tab";
import {
    resolveBookingStages,
    stageTitle,
    stageColor,
    BookingStageDialog,
} from "./booking-stage-dialogs";

const PANEL_TABS = [
    ["overview", "Overview"],
    ["documents", "Documents"],
    ["activity", "Activity"],
    ["plan", "Payment Plan"],
    ["payments", "Payment History"],
];

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

function bookingAmountValue(order, deal) {
    if (order?.token_amount != null && Number(order.token_amount) > 0) {
        return Number(order.token_amount);
    }

    if (order?.booking_amount != null && Number(order.booking_amount) > 0) {
        return Number(order.booking_amount);
    }

    if (deal?.plan?.down_payment != null && Number(deal.plan.down_payment) > 0) {
        return Number(deal.plan.down_payment);
    }

    return null;
}

/**
 * Split booking actions into Ops/Accounts (formal) vs Sales liaison CTAs.
 */
function splitActions({ stage, status, deal, cancelled, closed, liaisonActive }) {
    if (cancelled || closed) {
        return { primary: [], more: [], liaison: [] };
    }

    const primary = [];
    const more = [];
    const liaison = [];
    const tokenVerified = Boolean(deal?.booking?.verified_at);

    if (stage === "token") {
        primary.push({
            id: "verify",
            label: "Verify token",
            group: "ops",
        });
        liaison.push({
            id: "verification_queue",
            label: "Monitor verification queue",
            href: "/receivables/verification?mine=1",
        });
    }

    if (stage === "booking_kyc") {
        primary.push({
            id: "enter_kyc",
            label: "Enter Booking & KYC",
            group: "ops",
        });
    }

    if (stage === "active") {
        primary.push({
            id: "payment",
            label: "Record payment",
            group: "ops",
        });
    }

    if (tokenVerified && !deal?.plan?.template && (stage === "booking_kyc" || stage === "active")) {
        more.push({ id: "plan", label: "Set payment plan", group: "ops" });
    }

    if (stage === "active") {
        if (deal?.balloting_enabled && !deal?.booking?.balloted_at) {
            more.push({ id: "ballot", label: "Record balloting", group: "ops" });
        }

        more.push({
            id: "litigation",
            label: status === "litigation" ? "Clear litigation" : "Set litigation",
            group: "ops",
        });

        if (Number(deal?.ledger?.total_outstanding) <= 0) {
            if (deal?.handover_ready_at) {
                more.push({ id: "deliver", label: "Complete / handover", group: "ops" });
            } else {
                more.push({ id: "handover", label: "Ready for handover", group: "ops" });
            }
        }
    }

    if (liaisonActive) {
        liaison.push({
            id: "transfer",
            label: "Transfer file (initiate)",
        });
    }

    more.push({ id: "cancel", label: "Cancel booking", destructive: true, group: "ops" });

    return { primary, more, liaison };
}

export default function BookingDetailPanel({
    payload,
    orderStages = [],
    orderStatuses = [],
    projects: _projects = [],
    assignees = [],
    activityTypes: _activityTypes = [],
    onClose,
}) {
    const order = payload?.order;
    const deal = payload?.deal;
    const stages = resolveBookingStages(orderStages);
    const [tab, setTab] = useState("overview");
    const [dialogAction, setDialogAction] = useState(null);
    const [printableOpen, setPrintableOpen] = useState(false);
    const [printableFiles, setPrintableFiles] = useState([]);
    const [printableIndex, setPrintableIndex] = useState(0);

    const stage = deal?.stage || order?.stage || "token";
    const status = deal?.status || order?.status || "hold";
    const cancelled = status === "cancelled";
    const closed = stage === "closed" || status === "completed" || status === "cancelled";
    const completed = status === "completed";
    const open = !cancelled && !closed;
    const liaisonActive =
        deal?.liaison_active !== undefined ? Boolean(deal.liaison_active) : open;
    const hasPlan = Boolean(deal?.plan?.template);
    const tokenVerified = Boolean(deal?.booking?.verified_at);
    const canSetPlan = tokenVerified && !hasPlan && open;
    const stageLabel = stageTitle(stage, orderStages);

    const leadHref = order?.lead?.code ? `/leads?lead=${order.lead.code}` : null;
    const { primary, more, liaison } = useMemo(
        () => splitActions({ stage, status, deal, cancelled, closed, liaisonActive }),
        [stage, status, deal, cancelled, closed, liaisonActive],
    );
    const primaryAction = primary[0] || null;

    useEffect(() => {
        if (tab === "plan" && !hasPlan) {
            setTab("overview");
        }
    }, [tab, hasPlan]);

    useEffect(() => {
        setTab("overview");
        setDialogAction(null);
    }, [order?.code]);

    const openPrintable = (file) => {
        if (!file?.url) {
            return;
        }

        setPrintableFiles([file]);
        setPrintableIndex(0);
        setPrintableOpen(true);
    };

    const handleCancel = () => {
        if (
            !window.confirm(
                `Cancel the booking for ${order.contact?.display_name || "this buyer"}? The unit will be released.`,
            )
        ) {
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

    const runMoreAction = (action) => {
        if (action.id === "cancel") {
            handleCancel();
            return;
        }

        if (action.id === "verification_queue" && action.href) {
            router.get(action.href);
            return;
        }

        setDialogAction(action.id);
    };

    if (!order) {
        return null;
    }

    const totalPrice = deal?.net_price ?? order?.agreed_price;
    const bookingAmount = bookingAmountValue(order, deal);
    const paid = Number(deal?.ledger?.total_paid) || 0;
    const remaining = Number(deal?.ledger?.total_outstanding) || 0;
    const recentActivity = deal?.activities || [];

    return (
        <div className="flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden bg-card">
            <div className="shrink-0 space-y-3 border-b border-border px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium tracking-wide text-muted-foreground">
                        #{order.code}
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
                        <StageBadge
                            label={stageLabel}
                            color={stageColor(stage, orderStages) || undefined}
                        />
                        {more.length > 0 || liaison.length > 0 ? (
                            <DropdownMenu>
                                <Tooltip content="More actions">
                                    <DropdownMenuTrigger
                                        render={
                                            <IconButton
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                icon="more-2-fill"
                                                aria-label="More actions"
                                                tooltip={false}
                                            />
                                        }
                                    />
                                </Tooltip>
                                <DropdownMenuContent align="end" className="min-w-52">
                                    {liaison.length > 0 ? (
                                        <>
                                            <p className="px-2 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                                                Sales liaison
                                            </p>
                                            {liaison.map((action) => (
                                                <DropdownMenuItem
                                                    key={action.id}
                                                    onClick={() => runMoreAction(action)}
                                                >
                                                    {action.label}
                                                </DropdownMenuItem>
                                            ))}
                                            <DropdownMenuSeparator />
                                            <p className="px-2 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                                                Operations / Accounts
                                            </p>
                                        </>
                                    ) : null}
                                    {more.map((action, index) => {
                                        const showSeparator =
                                            action.destructive &&
                                            index > 0 &&
                                            !more[index - 1]?.destructive;

                                        return (
                                            <span key={action.id} className="contents">
                                                {showSeparator ? <DropdownMenuSeparator /> : null}
                                                <DropdownMenuItem
                                                    className={cn(
                                                        action.destructive && "text-destructive",
                                                    )}
                                                    onClick={() => runMoreAction(action)}
                                                >
                                                    {action.label}
                                                </DropdownMenuItem>
                                            </span>
                                        );
                                    })}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : null}
                        <IconButton
                            type="button"
                            size="sm"
                            className="rounded-full"
                            icon="close-line"
                            aria-label="Close booking details"
                            tooltip="Close"
                            variant="ghost"
                            onClick={onClose}
                        />
                    </div>
                </div>

                {liaisonActive ? (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground">
                        Sales remains the customer touchpoint until handover. Operations /
                        Accounts own formal verification and ledgers.
                    </div>
                ) : null}

                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <BuyerBlock
                            contact={order.contact}
                            deal={deal}
                            stage={stage}
                        />
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        <StatusControl
                            order={order}
                            status={status}
                            orderStatuses={orderStatuses}
                            locked={!open}
                        />
                        {primaryAction ? (
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => setDialogAction(primaryAction.id)}
                            >
                                {primaryAction.label}
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-1 border-b border-border px-4 py-2">
                <TooltipProvider delay={200}>
                    {PANEL_TABS.map(([id, label]) => {
                        const disabled = id === "plan" && !hasPlan;
                        const active = tab === id;

                        if (disabled) {
                            return (
                                <Tooltip key={id}>
                                    <TooltipTrigger
                                        render={
                                            <span className="inline-flex">
                                                <button
                                                    type="button"
                                                    disabled
                                                    className="cursor-not-allowed rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground/50"
                                                >
                                                    {label}
                                                </button>
                                            </span>
                                        }
                                    />
                                    <TooltipContent>
                                        Set a payment plan to view the schedule
                                    </TooltipContent>
                                </Tooltip>
                            );
                        }

                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setTab(id)}
                                className={cn(
                                    "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                                    active
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                                )}
                            >
                                {label}
                            </button>
                        );
                    })}
                </TooltipProvider>
            </div>

            <ScrollArea className="min-h-0 flex-1">
                <div className="divide-y divide-border px-4">
                    {tab === "overview" ? (
                        <>
                            <section className="py-4">
                                <h3 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                                    Deal Overview
                                </h3>
                                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    <div className="min-w-0">
                                        <dt className="text-sm text-muted-foreground">Total Price</dt>
                                        <dd className="truncate text-sm font-semibold tabular-nums">
                                            {formatMoney(totalPrice)}
                                        </dd>
                                    </div>
                                    <div className="min-w-0">
                                        <dt className="text-sm text-muted-foreground">Booking Amount</dt>
                                        <dd className="truncate text-sm font-semibold tabular-nums">
                                            {bookingAmount != null ? formatMoney(bookingAmount) : "—"}
                                        </dd>
                                    </div>
                                    <div className="min-w-0">
                                        <dt className="text-sm text-muted-foreground">Paid</dt>
                                        <dd className="truncate text-sm font-semibold tabular-nums">
                                            {formatMoney(paid)}
                                        </dd>
                                    </div>
                                    <div className="min-w-0">
                                        <dt className="text-sm text-muted-foreground">Remaining</dt>
                                        <dd className="truncate text-sm font-semibold tabular-nums">
                                            {formatMoney(remaining)}
                                        </dd>
                                    </div>
                                </dl>
                            </section>

                            <div className="grid gap-4 py-4 sm:grid-cols-2 sm:gap-6">
                                <section>
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                                            Payment Plan
                                        </h3>
                                        {hasPlan ? (
                                            <button
                                                type="button"
                                                className="text-sm font-medium text-primary hover:underline"
                                                onClick={() => setTab("plan")}
                                            >
                                                View schedule
                                            </button>
                                        ) : null}
                                    </div>
                                    {hasPlan ? (
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-foreground">
                                                {deal.plan.title || "Payment plan"}
                                            </p>
                                            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                                                {deal.plan.summary ||
                                                    `${deal.plan.frequency || "Monthly"} · ${deal.plan.installment_count || 0} installments`}
                                            </p>
                                        </div>
                                    ) : canSetPlan ? (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="w-full"
                                            onClick={() => setDialogAction("plan")}
                                        >
                                            Add payment plan
                                        </Button>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            {open && !tokenVerified
                                                ? "Verify the token before setting a payment plan."
                                                : "No payment plan set."}
                                        </p>
                                    )}
                                </section>

                                <ProjectDetailsCard order={order} deal={deal} />
                            </div>

                            <section className="py-4">
                                <h3 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                                    Team
                                </h3>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium text-muted-foreground">Sales</p>
                                        <UserCard user={order.sold_by} label="Sold by" size="sm" />
                                        <p className="text-sm text-muted-foreground">
                                            Booked {formatDateTime(order.booked_at) || "—"}
                                        </p>
                                        {leadHref ? (
                                            <Link
                                                href={leadHref}
                                                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                                            >
                                                Open lead
                                                <Icon name="arrow-right-s-line" className="text-sm" />
                                            </Link>
                                        ) : null}
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium text-muted-foreground">
                                            Assignee
                                        </p>
                                        <BookingAssigneeMenu order={order} assignees={assignees} />
                                        <p className="text-xs text-muted-foreground">
                                            Primary liaison for the buyer until handover.
                                        </p>
                                    </div>
                                </div>
                            </section>

                            {(deal?.transfers || []).length > 0 && (
                                <section className="py-4">
                                    <h3 className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                                        Transfer history
                                    </h3>
                                    <ul className="divide-y divide-border text-sm">
                                        {deal.transfers.map((row) => (
                                            <li key={row.id} className="py-2.5 first:pt-0 last:pb-0">
                                                {row.from || "Previous buyer"} → {row.to || "New buyer"}
                                                <span className="mt-0.5 block text-sm text-muted-foreground">
                                                    Outstanding {formatMoney(row.outstanding)} ·{" "}
                                                    {row.ndc_cleared ? "NDC cleared" : "NDC outstanding"}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}
                            
                        </>
                    ) : null}

                    {tab === "documents" ? (
                        <div className="py-4">
                            <BookingDocumentsSection
                                order={order}
                                deal={deal}
                                liaisonActive={liaisonActive}
                                onPreview={openPrintable}
                            />
                        </div>
                    ) : null}

                    {tab === "activity" ? (
                        <div className="py-4">
                            <ActivityTimeline
                                entries={deal?.activities || []}
                                active={tab === "activity"}
                                showHeader={false}
                            />
                        </div>
                    ) : null}

                    {tab === "plan" && hasPlan ? (
                        <div className="py-4">
                            <InstallmentsTab
                                order={order}
                                deal={deal}
                                liaisonActive={liaisonActive}
                                onLogRecovery={() => setTab("activity")}
                                onPreview={openPrintable}
                            />
                        </div>
                    ) : null}

                    {tab === "payments" ? (
                        <div className="py-4">
                            <PaymentsTab
                                order={order}
                                deal={deal}
                                canRecord={open}
                                onPreview={openPrintable}
                            />
                        </div>
                    ) : null}
                </div>
            </ScrollArea>

            {tab === "activity" ? (
                <NoteComposer
                    orderCode={order.code}
                    locked={cancelled || completed}
                />
            ) : null}

            <FilePreview
                open={printableOpen}
                onOpenChange={setPrintableOpen}
                files={printableFiles}
                index={printableIndex}
                onIndexChange={setPrintableIndex}
            />

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

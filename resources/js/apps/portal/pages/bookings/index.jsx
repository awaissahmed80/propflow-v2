import { useEffect, useMemo, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { isPagePending, PageSkeleton } from "../../components/page-skeleton";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { formatDateTime } from "@/lib/datetime";
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import BookingDetailPanel from "./booking-detail-panel";
import {
    resolveBookingStages,
    stageTitle,
    statusColor,
    statusTitle,
} from "./booking-stage-dialogs";

function bookingCodeFromLocation() {
    if (typeof window === "undefined") {
        return "";
    }

    const hash = window.location.hash.replace(/^#/, "");

    if (hash) {
        try {
            return decodeURIComponent(hash);
        } catch {
            return hash;
        }
    }

    return new URLSearchParams(window.location.search).get("booking") || "";
}

function writeBookingHash(code) {
    if (typeof window === "undefined") {
        return;
    }

    const url = new URL(window.location.href);

    url.searchParams.delete("booking");
    url.hash = code || "";

    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (next === current) {
        return;
    }

    window.history.replaceState(window.history.state, "", next);
}

function stageMeta(order, orderStages = []) {
    const stage = order?.stage || "token";
    const status = order?.status || "hold";
    const match = (orderStages || []).find((item) => item.label === stage);
    const color =
        statusColor(status, stage, orderStages) || match?.color || "#3B82F6";
    const statusLabel = statusTitle(status, stage, orderStages);

    return {
        label: statusLabel
            ? `${stageTitle(stage, orderStages)} · ${statusLabel}`
            : stageTitle(stage, orderStages),
        color,
        id: stage,
        status,
    };
}

function stageProgressIndex(stageId, stages) {
    if (stageId === "closed" || stageId === "cancelled" || stageId === "completed") {
        const closed = stages.findIndex((item) => item.id === "closed");

        return closed < 0 ? stages.length : closed;
    }

    const index = stages.findIndex((item) => item.id === stageId);

    return index < 0 ? 0 : index;
}

function MiniStageRail({ stageId, stages, color }) {
    const current = stageProgressIndex(stageId, stages);

    return (
        <div className="flex items-center gap-1" aria-hidden>
            {stages.map((stage, index) => {
                const done = index < current;
                const active = index === current;

                return (
                    <span
                        key={stage.id}
                        className={cn(
                            "h-1 flex-1 rounded-full transition-colors",
                            done || active ? "opacity-100" : "bg-border opacity-70",
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
    );
}

export default function BookingsIndex({
    orders,
    pagination,
    openedBooking = null,
    orderStages = [],
    projects = [],
    assignees = [],
    activityTypes = [],
}) {
    const pending = isPagePending(orders);
    const rows = orders ?? [];
    const pager = pagination ?? { current_page: 1, last_page: 1, total: 0 };
    const stages = useMemo(() => resolveBookingStages(orderStages), [orderStages]);
    const statusOptions = useMemo(() => {
        return stages.flatMap((stage) =>
            (stage.statuses || [])
                .filter((status) => status.is_enabled !== false)
                .map((status) => ({
                    value: `${stage.id}:${status.label}`,
                    stage: stage.id,
                    status: status.label,
                    label: `${stage.label} · ${status.title || status.label}`,
                    color: status.color || stage.color,
                })),
        );
    }, [stages]);
    const [selectedCode, setSelectedCode] = useState(
        () => openedBooking?.order?.code || bookingCodeFromLocation(),
    );
    const [stageFilter, setStageFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const openBookingCode = useRef(selectedCode || null);
    const requestedBookingCode = useRef(null);

    const filteredRows = useMemo(() => {
        return rows.filter((order) => {
            if (stageFilter !== "all" && order.stage !== stageFilter) {
                return false;
            }

            if (statusFilter !== "all" && order.status !== statusFilter) {
                return false;
            }

            return true;
        });
    }, [rows, stageFilter, statusFilter]);

    const stats = useMemo(() => {
        const active = rows.filter(
            (order) => order.stage !== "closed" && order.status !== "cancelled",
        ).length;
        const unpaid = rows.reduce((sum, order) => sum + (Number(order.unpaid_count) || 0), 0);

        return {
            total: pager.total || rows.length,
            active,
            unpaid,
        };
    }, [rows, pager.total]);

    useEffect(() => {
        const code = bookingCodeFromLocation();

        if (!code || orders === undefined) {
            return;
        }

        if (openedBooking?.order?.code === code) {
            openBookingCode.current = code;
            setSelectedCode(code);
            writeBookingHash(code);

            return;
        }

        if (requestedBookingCode.current === code) {
            return;
        }

        requestedBookingCode.current = code;
        openBookingCode.current = code;
        setSelectedCode(code);
        router.get(
            "/bookings",
            { booking: code },
            {
                only: ["openedBooking"],
                preserveState: true,
                preserveScroll: true,
                preserveUrl: true,
                replace: true,
                onFinish: () => writeBookingHash(openBookingCode.current),
            },
        );
    }, [openedBooking, orders]);

    const panelOpen = Boolean(selectedCode && openedBooking?.order?.code === selectedCode);

    const openBooking = (code) => {
        if (!code) {
            return;
        }

        openBookingCode.current = code;
        setSelectedCode(code);
        writeBookingHash(code);

        if (openedBooking?.order?.code === code) {
            return;
        }

        requestedBookingCode.current = code;
        router.get(
            "/bookings",
            { booking: code },
            {
                only: ["openedBooking"],
                preserveState: true,
                preserveScroll: true,
                preserveUrl: true,
                replace: true,
                onFinish: () => writeBookingHash(openBookingCode.current),
            },
        );
    };

    const closePanel = () => {
        openBookingCode.current = null;
        requestedBookingCode.current = null;
        setSelectedCode("");
        writeBookingHash(null);
    };

    const visitPage = (page) => {
        router.get(
            "/bookings",
            { page },
            {
                preserveState: true,
                preserveScroll: true,
                onFinish: () => writeBookingHash(openBookingCode.current),
            },
        );
    };

    if (pending) {
        return <PageSkeleton title="Bookings" variant="table" />;
    }

    return (
        <Layout>
            <Layout.Header metaTitle="Bookings" breadcrumbs={[{ label: "Bookings" }]} />
            <Layout.Content className="relative flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar className="gap-4">
                    <div className="min-w-0 flex-1">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Bookings</h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            Contract files in motion — token through closed.
                        </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-1.5 text-center">
                            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                                Files
                            </p>
                            <p className="text-sm font-semibold tabular-nums text-foreground">
                                {stats.total}
                            </p>
                        </div>
                        <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-1.5 text-center">
                            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                                Active
                            </p>
                            <p className="text-sm font-semibold tabular-nums text-foreground">
                                {stats.active}
                            </p>
                        </div>
                        <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-1.5 text-center">
                            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                                Unpaid
                            </p>
                            <p className="text-sm font-semibold tabular-nums text-foreground">
                                {stats.unpaid}
                            </p>
                        </div>
                    </div>
                </Layout.Toolbar>

                <div className="space-y-2 border-b border-border/70 bg-background px-6 py-2.5">
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                        <button
                            type="button"
                            onClick={() => {
                                setStageFilter("all");
                                setStatusFilter("all");
                            }}
                            className={cn(
                                "inline-flex shrink-0 items-center rounded-md border px-3 py-1 text-xs font-medium transition-colors",
                                stageFilter === "all"
                                    ? "border-primary/40 bg-primary/10 text-primary"
                                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                            )}
                        >
                            All
                        </button>
                        {stages.map((stage) => (
                            <button
                                key={stage.id}
                                type="button"
                                onClick={() => {
                                    setStageFilter(stage.id);
                                    setStatusFilter("all");
                                }}
                                className={cn(
                                    "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-medium transition-colors",
                                    stageFilter === stage.id
                                        ? "border-primary/40 bg-primary/10 text-primary"
                                        : "border-border bg-background text-muted-foreground hover:text-foreground",
                                )}
                            >
                                <span
                                    className="size-1.5 rounded-full"
                                    style={{ backgroundColor: stage.color || "var(--muted-foreground)" }}
                                />
                                {stage.label}
                            </button>
                        ))}
                    </div>
                    {statusOptions.length > 0 ? (
                        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                            <button
                                type="button"
                                onClick={() => setStatusFilter("all")}
                                className={cn(
                                    "inline-flex shrink-0 items-center rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                                    statusFilter === "all"
                                        ? "border-primary/40 bg-primary/10 text-primary"
                                        : "border-border bg-background text-muted-foreground hover:text-foreground",
                                )}
                            >
                                Any status
                            </button>
                            {(stageFilter === "all"
                                ? statusOptions
                                : statusOptions.filter((option) => option.stage === stageFilter)
                            ).map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setStatusFilter(option.status)}
                                    className={cn(
                                        "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                                        statusFilter === option.status
                                            ? "border-primary/40 bg-primary/10 text-primary"
                                            : "border-border bg-background text-muted-foreground hover:text-foreground",
                                    )}
                                >
                                    <span
                                        className="size-1.5 rounded-full"
                                        style={{
                                            backgroundColor:
                                                option.color || "var(--muted-foreground)",
                                        }}
                                    />
                                    {option.label.split(" · ").pop()}
                                </button>
                            ))}
                        </div>
                    ) : null}
                </div>

                <div
                    className="grid min-h-0 flex-1 overflow-hidden transition-[grid-template-columns] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{
                        gridTemplateColumns: panelOpen
                            ? "minmax(0, 1.1fr) minmax(22rem, 0.9fr)"
                            : "minmax(0, 1fr) 0fr",
                    }}
                >
                    <div className="min-h-0 min-w-0 overflow-auto px-6 py-4">
                        {filteredRows.length === 0 ? (
                            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
                                <span className="mb-3 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                                    <Icon name="book-2-line" className="text-2xl" />
                                </span>
                                <p className="text-sm font-medium text-foreground">
                                    {rows.length === 0 ? "No bookings yet" : "No bookings in this stage"}
                                </p>
                                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                                    {rows.length === 0
                                        ? "Close a lead as won to open the first contract file."
                                        : "Try another stage filter or clear the selection."}
                                </p>
                                {stageFilter !== "all" || statusFilter !== "all" ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="mt-4"
                                        onClick={() => {
                                            setStageFilter("all");
                                            setStatusFilter("all");
                                        }}
                                    >
                                        Show all bookings
                                    </Button>
                                ) : null}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredRows.map((order) => {
                                    const active = selectedCode === order.code;
                                    const meta = stageMeta(order, orderStages);
                                    const buyer = order.contact?.display_name || "Buyer";

                                    return (
                                        <button
                                            key={order.id}
                                            type="button"
                                            onClick={() => openBooking(order.code)}
                                            className={cn(
                                                "group relative w-full cursor-pointer overflow-hidden rounded-2xl border text-left transition-all duration-200",
                                                active
                                                    ? "border-primary/35 bg-primary/[0.06] shadow-sm ring-1 ring-primary/15"
                                                    : "border-border/80 bg-background hover:border-border hover:bg-muted/25 hover:shadow-xs",
                                            )}
                                        >
                                            <span
                                                className="absolute inset-y-0 left-0 w-1"
                                                style={{ backgroundColor: meta.color }}
                                                aria-hidden
                                            />
                                            <div
                                                className={cn(
                                                    "grid items-center gap-x-6 gap-y-3 px-4 py-3.5 pl-5",
                                                    panelOpen
                                                        ? "sm:grid-cols-2"
                                                        : "md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(11rem,0.85fr)]",
                                                )}
                                            >
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <Avatar
                                                        name={buyer}
                                                        size="sm"
                                                        className="size-9 shrink-0"
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="truncate text-sm font-semibold text-foreground">
                                                                {buyer}
                                                            </span>
                                                            <span className="rounded-md border border-border/80 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                                                                {order.booking_kind || "booking"}
                                                            </span>
                                                            {order.unpaid_count ? (
                                                                <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                                                                    {order.unpaid_count} unpaid
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                                            {order.contact?.phone_number ||
                                                                order.contact?.email_address ||
                                                                "No contact details"}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="min-w-0 space-y-1.5">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        {order.project?.thumbnail ? (
                                                            <img
                                                                src={order.project.thumbnail}
                                                                alt=""
                                                                className="size-7 shrink-0 rounded-md object-cover"
                                                            />
                                                        ) : (
                                                            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                                                <Icon name="community-line" className="text-sm" />
                                                            </span>
                                                        )}
                                                        <span className="truncate text-sm font-medium text-foreground">
                                                            {order.project?.title || "No project"}
                                                        </span>
                                                    </div>
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        {order.assignee ? (
                                                            <>
                                                                <Avatar
                                                                    name={order.assignee.display_name}
                                                                    src={order.assignee.avatar || undefined}
                                                                    size="sm"
                                                                    className="size-7 shrink-0"
                                                                    textClass="text-[9px]"
                                                                />
                                                                <span className="truncate text-sm text-foreground">
                                                                    {order.assignee.display_name}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <span className="text-sm text-muted-foreground">
                                                                Unassigned
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="truncate text-xs text-muted-foreground">
                                                        {order.unit?.name || "No unit linked"}
                                                    </p>
                                                </div>

                                                <div className={cn("min-w-0", panelOpen && "sm:col-span-2")}>
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold tabular-nums text-foreground">
                                                                {formatMoney(order.agreed_price)}
                                                            </p>
                                                            <p className="text-[11px] text-muted-foreground">
                                                                {formatDateTime(order.booked_at) || "—"}
                                                            </p>
                                                        </div>
                                                        <Icon
                                                            name="arrow-right-s-line"
                                                            className={cn(
                                                                "mt-0.5 shrink-0 text-muted-foreground transition-transform",
                                                                active && "translate-x-0.5 text-primary",
                                                            )}
                                                        />
                                                    </div>
                                                    <div className="mt-2">
                                                        <span
                                                            className="mb-1.5 inline-flex max-w-full items-center gap-1.5 truncate text-xs font-medium"
                                                            style={{ color: meta.color }}
                                                        >
                                                            <span
                                                                className="size-1.5 shrink-0 rounded-full"
                                                                style={{ backgroundColor: meta.color }}
                                                            />
                                                            {meta.label}
                                                        </span>
                                                        <MiniStageRail
                                                            stageId={meta.id}
                                                            stages={stages}
                                                            color={meta.color}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {pager.last_page > 1 ? (
                            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                                <span>
                                    {pager.from}–{pager.to} of {pager.total}
                                </span>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={pager.current_page <= 1}
                                        onClick={() => visitPage(pager.current_page - 1)}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={pager.current_page >= pager.last_page}
                                        onClick={() => visitPage(pager.current_page + 1)}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <aside
                        className={cn(
                            "min-h-0 min-w-0 overflow-hidden bg-background transition-[border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                            panelOpen
                                ? "border-l border-border"
                                : "border-l border-transparent",
                        )}
                        aria-hidden={!panelOpen}
                    >
                        <div
                            className={cn(
                                "h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
                                panelOpen ? "translate-x-0" : "translate-x-full",
                            )}
                        >
                            {panelOpen ? (
                                <BookingDetailPanel
                                    payload={openedBooking}
                                    orderStages={orderStages}
                                    projects={projects}
                                    assignees={assignees}
                                    activityTypes={activityTypes}
                                    onClose={closePanel}
                                />
                            ) : null}
                        </div>
                    </aside>
                </div>
            </Layout.Content>
        </Layout>
    );
}

BookingsIndex.layout = (page) => <PortalLayout children={page} />;

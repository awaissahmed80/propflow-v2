import { useEffect, useMemo, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { bulk as bulkOrders } from "@/actions/App/Http/Controllers/Portal/OrderController";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { isPagePending, PageSkeleton } from "../../components/page-skeleton";
import { Button } from "@/components/ui/button";
import { CheckboxControl } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterInput } from "@/components/ui/filter-input";
import { ActiveFilters, FilterMenu, toSelectedList } from "@/components/ui/filter-menu";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { StageBadge } from "@/components/ui/stage-badge";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDateTime } from "@/lib/datetime";
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import BookingDetailPanel from "./booking-detail-panel";
import {
    stageTitle,
    stageColor,
    statusColor,
    statusTitle,
} from "./booking-stage-dialogs";

function toFilterParam(value) {
    const list = toSelectedList(value);

    return list.length > 0 ? list.join(",") : "";
}

/**
 * @param {number} current
 * @param {number} last
 * @returns {Array<number | "ellipsis">}
 */
function paginationItems(current, last) {
    if (last <= 7) {
        return Array.from({ length: last }, (_, index) => index + 1);
    }

    const items = [1];

    if (current > 3) {
        items.push("ellipsis");
    }

    const start = Math.max(2, current - 1);
    const end = Math.min(last - 1, current + 1);

    for (let page = start; page <= end; page += 1) {
        items.push(page);
    }

    if (current < last - 2) {
        items.push("ellipsis");
    }

    items.push(last);

    return items;
}

const emptyPagination = {
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
    from: null,
    to: null,
};

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

function BookingRow({
    order,
    compact = false,
    selected = false,
    checked = false,
    orderStages = [],
    orderStatuses = [],
    onToggleCheck,
    onOpen,
}) {
    const buyer = order.contact?.display_name || "Buyer";
    const contactDetail =
        order.contact?.phone_number || order.contact?.email_address || null;
    const stageLabel = stageTitle(order.stage, orderStages);
    const statusLabel = statusTitle(order.status, orderStatuses) || "—";
    const stageTone = stageColor(order.stage, orderStages);
    const statusTone = statusColor(order.status, orderStatuses);
    const soldBy = order.sold_by;

    return (
        <tr
            role="button"
            tabIndex={0}
            onClick={() => onOpen(order)}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(order);
                }
            }}
            className={cn(
                "cursor-pointer border-b border-border last:border-0 hover:bg-muted/40",
                selected && "bg-primary/5 hover:bg-primary/10",
                checked && !selected && "bg-muted/30",
            )}
        >
            <td
                className="w-10 px-3 py-3 align-middle"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
            >
                <CheckboxControl
                    checked={checked}
                    onCheckedChange={(value) => onToggleCheck?.(order.id, Boolean(value))}
                    aria-label={`Select ${buyer}`}
                />
            </td>
            <td className="px-4 py-3 align-middle">
                <div className="flex min-w-0 items-center gap-3">
                    <Avatar
                        name={buyer === "Buyer" ? "" : buyer}
                        size="default"
                        className="size-10 shrink-0"
                        textClass="text-xs"
                    />
                    <div className="min-w-0">
                        {order.code ? (
                            <div className="truncate text-xs font-medium text-muted-foreground">
                                {order.code}
                            </div>
                        ) : null}
                        <div className="truncate font-medium text-foreground">
                            {buyer}
                        </div>
                        {contactDetail ? (
                            <div className="truncate text-xs text-muted-foreground">
                                {contactDetail}
                            </div>
                        ) : null}
                    </div>
                </div>
            </td>
            {!compact ? (
                <td className="whitespace-nowrap px-4 py-3 align-middle text-sm text-muted-foreground">
                    {formatDateTime(order.booked_at) || "—"}
                </td>
            ) : null}
            <td className="px-4 py-3 align-middle">
                {soldBy ? (
                    <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar
                            name={soldBy.display_name}
                            src={soldBy.avatar || undefined}
                            size="sm"
                            className="size-7 shrink-0"
                            textClass="text-[9px]"
                        />
                        {!compact ? (
                            <span className="truncate text-sm text-foreground">
                                {soldBy.display_name}
                            </span>
                        ) : null}
                    </div>
                ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                )}
            </td>
            {!compact ? (
                <td className="px-4 py-3 align-middle">
                    {order.project ? (
                        <div className="flex min-w-0 items-center gap-2.5">
                            {order.project.thumbnail ? (
                                <img
                                    src={order.project.thumbnail}
                                    alt=""
                                    className="size-8 shrink-0 rounded-md object-cover"
                                />
                            ) : (
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                    <Icon name="community-line" className="text-base" />
                                </span>
                            )}
                            <div className="min-w-0">
                                <div className="truncate text-sm text-foreground">
                                    {order.project.title}
                                </div>
                                <div className="truncate text-xs text-muted-foreground">
                                    {[order.unit?.name || order.unit?.code, order.project.location]
                                        .filter(Boolean)
                                        .join(" · ") || "—"}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                    )}
                </td>
            ) : null}
            <td className="px-4 py-3 align-middle">
                <div className="min-w-0">
                    <div className="whitespace-nowrap text-sm font-medium tabular-nums text-foreground">
                        {formatMoney(order.agreed_price)}
                    </div>
                    {!compact ? (
                        <div className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                            Bal. {formatMoney(order.balance_due)}
                        </div>
                    ) : null}
                </div>
            </td>
            <td className="px-4 py-3 align-middle">
                <StageBadge label={stageLabel} color={stageTone} />
            </td>
            <td className="px-4 py-3 align-middle">
                <StageBadge label={statusLabel} color={statusTone} />
            </td>
        </tr>
    );
}

export default function BookingsIndex({
    orders: ordersProp,
    pagination = emptyPagination,
    filters = {},
    openedBooking = null,
    orderStages = [],
    orderStatuses = [],
    projects = [],
    assignees = [],
    activityTypes = [],
}) {
    const pending = isPagePending(ordersProp);
    const orders = ordersProp ?? [];
    const [search, setSearch] = useState(filters.q || "");
    const [selectedCode, setSelectedCode] = useState(
        () => openedBooking?.order?.code || bookingCodeFromLocation(),
    );
    const [checkedIds, setCheckedIds] = useState([]);
    const [bulkBusy, setBulkBusy] = useState(false);
    const searchTimeout = useRef(null);
    const openBookingCode = useRef(selectedCode || null);
    const requestedBookingCode = useRef(null);

    const appliedFilters = useMemo(
        () => ({
            stage: toSelectedList(filters.stage),
            status: toSelectedList(filters.status),
            project: toSelectedList(filters.project),
            assigned_to: toSelectedList(filters.assigned_to),
        }),
        [filters.stage, filters.status, filters.project, filters.assigned_to],
    );

    const currentPage = Number(pagination.current_page) || 1;
    const lastPage = Math.max(1, Number(pagination.last_page) || 1);
    const pageItems = useMemo(
        () => paginationItems(currentPage, lastPage),
        [currentPage, lastPage],
    );

    useEffect(() => {
        const code = bookingCodeFromLocation();

        if (!code || ordersProp === undefined) {
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
    }, [openedBooking, ordersProp]);

    useEffect(() => {
        setSearch(filters.q || "");
    }, [filters.q]);

    useEffect(() => {
        setCheckedIds([]);
    }, [
        currentPage,
        filters.q,
        filters.stage,
        filters.status,
        filters.project,
        filters.assigned_to,
    ]);

    useEffect(() => {
        return () => {
            if (searchTimeout.current) {
                clearTimeout(searchTimeout.current);
            }
        };
    }, []);

    const pageOrderIds = useMemo(
        () => orders.map((order) => order.id).filter(Boolean),
        [orders],
    );

    const checkedOnPage = useMemo(
        () => pageOrderIds.filter((id) => checkedIds.includes(id)),
        [pageOrderIds, checkedIds],
    );

    const allPageChecked =
        pageOrderIds.length > 0 && checkedOnPage.length === pageOrderIds.length;
    const somePageChecked =
        checkedOnPage.length > 0 && checkedOnPage.length < pageOrderIds.length;
    const hasChecked = checkedIds.length > 0;

    const filterSections = useMemo(() => {
        const stageOptions = (orderStages || [])
            .filter((stage) => stage.is_enabled !== false)
            .map((stage) => ({
                value: stage.label,
                label: stage.title || stage.label,
                color: stage.color || undefined,
            }));

        const statusOptions = (orderStatuses || [])
            .filter((status) => status.is_enabled !== false)
            .map((status) => ({
                value: status.label,
                label: status.title || status.label,
                color: status.color || undefined,
            }));

        const projectOptions = (projects || []).map((project) => ({
            value: String(project.id),
            label: project.title,
            thumbnail: project.thumbnail || undefined,
        }));

        const assigneeOptions = (assignees || []).map((user) => ({
            value: String(user.id),
            label: user.display_name,
            avatar: user.avatar || undefined,
        }));

        return [
            { key: "stage", label: "Stage", type: "stage", options: stageOptions },
            { key: "status", label: "Status", type: "stage", options: statusOptions },
            { key: "project", label: "Project", type: "projects", options: projectOptions },
            ...(assigneeOptions.length > 0
                ? [{
                    key: "assigned_to",
                    label: "Assignee",
                    type: "people",
                    options: assigneeOptions,
                }]
                : []),
        ];
    }, [orderStages, orderStatuses, projects, assignees]);

    const visitBookings = (next = {}) => {
        const page = Object.prototype.hasOwnProperty.call(next, "page")
            ? next.page
            : currentPage;

        const params = {
            q: Object.prototype.hasOwnProperty.call(next, "q") ? next.q : search,
            stage: toFilterParam(
                Object.prototype.hasOwnProperty.call(next, "stage")
                    ? next.stage
                    : appliedFilters.stage,
            ),
            status: toFilterParam(
                Object.prototype.hasOwnProperty.call(next, "status")
                    ? next.status
                    : appliedFilters.status,
            ),
            project: toFilterParam(
                Object.prototype.hasOwnProperty.call(next, "project")
                    ? next.project
                    : appliedFilters.project,
            ),
            assigned_to: toFilterParam(
                Object.prototype.hasOwnProperty.call(next, "assigned_to")
                    ? next.assigned_to
                    : appliedFilters.assigned_to,
            ),
            page: page > 1 ? String(page) : "",
        };

        Object.keys(params).forEach((key) => {
            if (!params[key]) {
                delete params[key];
            }
        });

        router.get("/bookings", params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: [
                "orders",
                "pagination",
                "filters",
                "openedBooking",
                "orderStages",
                "orderStatuses",
                "projects",
                "assignees",
                "activityTypes",
            ],
            onFinish: () => writeBookingHash(openBookingCode.current),
        });
    };

    const toggleOrderCheck = (orderId, nextChecked) => {
        setCheckedIds((prev) => {
            if (nextChecked) {
                return prev.includes(orderId) ? prev : [...prev, orderId];
            }

            return prev.filter((id) => id !== orderId);
        });
    };

    const toggleCheckAllOnPage = (nextChecked) => {
        setCheckedIds((prev) => {
            if (nextChecked) {
                const merged = new Set([...prev, ...pageOrderIds]);

                return Array.from(merged);
            }

            return prev.filter((id) => !pageOrderIds.includes(id));
        });
    };

    const runBulkAction = async ({
        action,
        assigned_to,
        status,
        confirmMessage,
        confirmTitle,
        successMessage,
        errorMessage,
    }) => {
        if (checkedIds.length === 0 || bulkBusy) {
            return;
        }

        if (confirmMessage) {
            const confirmed = await confirm(confirmMessage, confirmTitle || "Confirm");

            if (!confirmed) {
                return;
            }
        }

        setBulkBusy(true);

        router.post(
            bulkOrders.url(),
            {
                ids: checkedIds,
                action,
                ...(action === "assign" ? { assigned_to } : {}),
                ...(action === "status" ? { status } : {}),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(successMessage);
                    setCheckedIds([]);
                },
                onError: (errors) =>
                    toast.error(
                        errors.ids ||
                            errors.action ||
                            errors.assigned_to ||
                            errors.status ||
                            errors.message ||
                            errorMessage,
                    ),
                onFinish: () => setBulkBusy(false),
            },
        );
    };

    const handleBulkAssign = (userId) =>
        runBulkAction({
            action: "assign",
            assigned_to: userId,
            successMessage: "Assignee updated",
            errorMessage: "Could not update assignee",
        });

    const handleBulkStatus = (statusLabel) =>
        runBulkAction({
            action: "status",
            status: statusLabel,
            successMessage: "Status updated",
            errorMessage: "Could not update status",
        });

    const handleBulkCancel = () =>
        runBulkAction({
            action: "cancel",
            confirmMessage: `Cancel ${checkedIds.length} booking${checkedIds.length === 1 ? "" : "s"}? Open units may be released.`,
            confirmTitle: "Cancel bookings",
            successMessage: "Bookings cancelled",
            errorMessage: "Could not cancel bookings",
        });

    const handleSearchChange = (event) => {
        const value = event.target.value;
        setSearch(value);

        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }

        searchTimeout.current = setTimeout(() => {
            visitBookings({ q: value.trim(), page: 1 });
        }, 300);
    };

    const handleFiltersApply = (next) => {
        visitBookings({
            stage: next.stage || [],
            status: next.status || [],
            project: next.project || [],
            assigned_to: next.assigned_to || [],
            page: 1,
        });
    };

    const handleFiltersClear = () => {
        handleFiltersApply({
            stage: [],
            status: [],
            project: [],
            assigned_to: [],
        });
    };

    const goToPage = (page) => {
        const nextPage = Number(page);

        if (
            !Number.isFinite(nextPage) ||
            nextPage < 1 ||
            nextPage > lastPage ||
            nextPage === currentPage
        ) {
            return;
        }

        visitBookings({ page: nextPage });
    };

    const openBooking = (orderOrCode) => {
        const code = typeof orderOrCode === "string" ? orderOrCode : orderOrCode?.code;

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

    const panelOpen = Boolean(selectedCode && openedBooking?.order?.code === selectedCode);
    const compact = panelOpen;

    const hasFilters =
        Boolean(filters.q) ||
        appliedFilters.stage.length > 0 ||
        appliedFilters.status.length > 0 ||
        appliedFilters.project.length > 0 ||
        appliedFilters.assigned_to.length > 0;

    const rangeLabel =
        pagination.total > 0
            ? `Showing ${pagination.from}–${pagination.to} of ${pagination.total}`
            : "No results";

    if (pending) {
        return <PageSkeleton title="Bookings" variant="table" />;
    }

    return (
        <Layout>
            <Layout.Header metaTitle="Bookings" breadcrumbs={[{ label: "Bookings" }]} />

            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar className="flex-wrap">
                    <div className="mr-2 shrink-0">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Bookings
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            Contract files in motion
                        </p>
                    </div>

                    <FilterInput
                        value={search}
                        onChange={handleSearchChange}
                        placeholder="Search bookings..."
                        className="w-56"
                    />

                    <FilterMenu
                        sections={filterSections}
                        value={appliedFilters}
                        onApply={handleFiltersApply}
                    />

                    {hasChecked ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                render={
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="gap-1.5 font-medium"
                                        disabled={bulkBusy}
                                    >
                                        <Icon name="cursor-line" className="text-base" />
                                        Bulk Actions
                                        <Icon name="arrow-down-s-line" className="text-base opacity-70" />
                                    </Button>
                                }
                            />
                            <DropdownMenuContent align="start" className="min-w-52">
                                {(assignees || []).length > 0 ? (
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>
                                            Assign
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent className="min-w-44">
                                            {(assignees || []).map((user) => (
                                                <DropdownMenuItem
                                                    key={user.id}
                                                    className="gap-2"
                                                    disabled={bulkBusy}
                                                    onClick={() => handleBulkAssign(user.id)}
                                                >
                                                    <Avatar
                                                        name={user.display_name}
                                                        src={user.avatar || undefined}
                                                        size="sm"
                                                        className="size-5 shrink-0"
                                                        textClass="text-[8px]"
                                                    />
                                                    {user.display_name}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                ) : null}

                                {(orderStatuses || []).filter((s) => s.is_enabled !== false).length > 0 ? (
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>
                                            Set status
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent className="min-w-44">
                                            {(orderStatuses || [])
                                                .filter((status) => status.is_enabled !== false)
                                                .map((status) => (
                                                    <DropdownMenuItem
                                                        key={status.label}
                                                        className="gap-2"
                                                        disabled={bulkBusy}
                                                        onClick={() => handleBulkStatus(status.label)}
                                                    >
                                                        <span
                                                            className="size-2 shrink-0 rounded-full"
                                                            style={{
                                                                backgroundColor:
                                                                    status.color ||
                                                                    "var(--muted-foreground)",
                                                            }}
                                                            aria-hidden
                                                        />
                                                        {status.title || status.label}
                                                    </DropdownMenuItem>
                                                ))}
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                ) : null}

                                <DropdownMenuItem
                                    variant="destructive"
                                    disabled={bulkBusy}
                                    onClick={handleBulkCancel}
                                >
                                    Cancel
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : null}

                    <div className="ml-auto flex items-center gap-2">
                        <Button
                            type="button"
                            className="shrink-0"
                            onClick={() => toast.info("Coming soon")}
                        >
                            <Icon name="add-line" className="text-base" />
                            New Booking
                        </Button>
                    </div>
                </Layout.Toolbar>

                <ActiveFilters
                    sections={filterSections}
                    value={appliedFilters}
                    onChange={handleFiltersApply}
                    onClear={handleFiltersClear}
                    className="shrink-0"
                />

                <div
                    className="grid min-h-0 flex-1 overflow-hidden transition-[grid-template-columns] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{
                        gridTemplateColumns: panelOpen
                            ? "minmax(0, 1.1fr) minmax(22rem, 0.9fr)"
                            : "minmax(0, 1fr) 0fr",
                    }}
                >
                    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
                        <ScrollArea className="min-h-0 flex-1 overflow-hidden">
                            <div className="px-6 py-6">
                                {orders.length === 0 ? (
                                    <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-6 text-center">
                                        <div className="mb-4 flex size-14 items-center justify-center rounded-md bg-primary/10 text-primary">
                                            <Icon name="book-2-line" className="text-2xl" />
                                        </div>
                                        <h2 className="text-lg font-semibold tracking-tight">
                                            {hasFilters
                                                ? "No bookings match your filters"
                                                : "No bookings yet"}
                                        </h2>
                                        <p className="mt-2 max-w-md text-sm text-muted-foreground">
                                            {hasFilters
                                                ? "Try another stage, status, project, or search term."
                                                : "Close a lead as won to open the first contract file."}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-border bg-card">
                                        <table
                                            className={cn(
                                                "w-full text-left text-sm",
                                                compact ? "min-w-[640px]" : "min-w-[1200px]",
                                            )}
                                        >
                                            <thead className="sticky top-0 z-10 border-b border-border bg-muted/40 text-muted-foreground backdrop-blur-sm">
                                                <tr>
                                                    <th className="w-10 px-3 py-3">
                                                        <CheckboxControl
                                                            checked={allPageChecked}
                                                            indeterminate={somePageChecked}
                                                            onCheckedChange={(value) =>
                                                                toggleCheckAllOnPage(Boolean(value))
                                                            }
                                                            aria-label="Select all bookings on this page"
                                                        />
                                                    </th>
                                                    <th className="min-w-44 px-4 py-3 font-medium">
                                                        Booking
                                                    </th>
                                                    {!compact ? (
                                                        <th className="min-w-36 px-4 py-3 font-medium">
                                                            Date / Time
                                                        </th>
                                                    ) : null}
                                                    <th className="min-w-28 px-4 py-3 font-medium">
                                                        {compact ? "Agent" : "Sale Agent"}
                                                    </th>
                                                    {!compact ? (
                                                        <th className="min-w-44 px-4 py-3 font-medium">
                                                            Project / Unit
                                                        </th>
                                                    ) : null}
                                                    <th className="w-32 whitespace-nowrap px-4 py-3 font-medium">
                                                        {compact ? "Amount" : "Amount / Bal. Due"}
                                                    </th>
                                                    <th className="min-w-28 px-4 py-3 font-medium">
                                                        Stage
                                                    </th>
                                                    <th className="min-w-28 px-4 py-3 font-medium">
                                                        Status
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {orders.map((order) => (
                                                    <BookingRow
                                                        key={order.id}
                                                        order={order}
                                                        compact={compact}
                                                        selected={selectedCode === order.code}
                                                        checked={checkedIds.includes(order.id)}
                                                        orderStages={orderStages}
                                                        orderStatuses={orderStatuses}
                                                        onToggleCheck={toggleOrderCheck}
                                                        onOpen={openBooking}
                                                    />
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        {lastPage > 1 ? (
                            <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-background px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-muted-foreground">
                                    {rangeLabel}
                                </p>
                                <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                                    <PaginationContent>
                                        <PaginationItem>
                                            <PaginationPrevious
                                                href="#"
                                                text="Prev"
                                                className={cn(
                                                    currentPage <= 1 &&
                                                        "pointer-events-none opacity-50",
                                                )}
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    goToPage(currentPage - 1);
                                                }}
                                            />
                                        </PaginationItem>
                                        {pageItems.map((item, index) =>
                                            item === "ellipsis" ? (
                                                <PaginationItem key={`ellipsis-${index}`}>
                                                    <PaginationEllipsis />
                                                </PaginationItem>
                                            ) : (
                                                <PaginationItem key={item}>
                                                    <PaginationLink
                                                        href="#"
                                                        isActive={item === currentPage}
                                                        onClick={(event) => {
                                                            event.preventDefault();
                                                            goToPage(item);
                                                        }}
                                                    >
                                                        {item}
                                                    </PaginationLink>
                                                </PaginationItem>
                                            ),
                                        )}
                                        <PaginationItem>
                                            <PaginationNext
                                                href="#"
                                                text="Next"
                                                className={cn(
                                                    currentPage >= lastPage &&
                                                        "pointer-events-none opacity-50",
                                                )}
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    goToPage(currentPage + 1);
                                                }}
                                            />
                                        </PaginationItem>
                                    </PaginationContent>
                                </Pagination>
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
                                    orderStatuses={orderStatuses}
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

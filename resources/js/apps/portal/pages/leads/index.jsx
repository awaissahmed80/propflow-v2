import { useEffect, useMemo, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { bulk as bulkLeads } from "@/actions/App/Http/Controllers/Portal/LeadController";
import { index } from "@/routes/portal/leads";
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
import { HeatIcon } from "@/components/ui/heat-icon";
import { StageBadge } from "@/components/ui/stage-badge";
import { Icon } from "@/components/ui/icon";
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
import {
    TooltipProvider,
} from "@/components/ui/tooltip";
import { formatDateTime, formatRelativeTime } from "@/lib/datetime";
import { formatMoney } from "@/lib/currency";
import { HEAT_LABELS } from "@/lib/heat";
import { cn } from "@/lib/utils";
import LeadDetailPanel from "./lead-detail-panel";
import LeadForm from "./lead-form";
import { LeadsKanbanBoard } from "./kanban/leads-kanban-board";

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

function leadCodeFromLocation() {
    const hash = window.location.hash.replace(/^#/, "");

    if (hash) {
        try {
            return decodeURIComponent(hash);
        } catch {
            return hash;
        }
    }

    return new URLSearchParams(window.location.search).get("lead") || "";
}

function writeLeadHash(code) {
    const url = new URL(window.location.href);

    url.searchParams.delete("lead");
    url.hash = code || "";

    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (next === current) {
        return;
    }

    window.history.replaceState(window.history.state, "", next);
}

function findLoadedLead(code, leads, board) {
    return (
        leads.find((lead) => lead.code === code) ||
        board.flatMap((column) => column.leads || []).find((lead) => lead.code === code) ||
        null
    );
}

function LeadRow({
    lead,
    compact = false,
    selected = false,
    checked = false,
    onToggleCheck,
    onOpen,
}) {
    const contactName = lead.contact?.display_name || "—";
    const contactDetail =
        lead.contact?.phone_number ||
        lead.contact?.email_address ||
        lead.source ||
        null;

    return (
        <tr
            role="button"
            tabIndex={0}
            onClick={() => onOpen(lead)}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(lead);
                }
            }}
            className={cn(
                "cursor-pointer border-b border-border last:border-0 hover:bg-muted/40",
                selected && "bg-primary/5 hover:bg-primary/10",
                checked && !selected && "bg-muted/30"
            )}
        >
            <td
                className="w-10 px-3 py-3 align-middle"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
            >
                <CheckboxControl
                    checked={checked}
                    onCheckedChange={(value) => onToggleCheck?.(lead.id, Boolean(value))}
                    aria-label={`Select ${contactName}`}
                />
            </td>
            <td className="px-4 py-3 align-middle">
                <div className="flex min-w-0 items-center gap-3">
                    <Avatar
                        name={contactName === "—" ? "" : contactName}
                        size="default"
                        className="size-10 shrink-0"
                        textClass="text-xs"
                    />
                    <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate font-medium text-foreground">
                                {contactName}
                            </span>
                            {!compact ? <HeatIcon tag={lead.tag} /> : null}
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
                <td className="px-4 py-3 align-middle">
                    {lead.project ? (
                        <div className="flex min-w-0 items-center gap-2.5">
                            {lead.project.thumbnail ? (
                                <img
                                    src={lead.project.thumbnail}
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
                                    {lead.project.title}
                                </div>
                                {lead.project.code ? (
                                    <div className="truncate text-xs text-muted-foreground">
                                        {lead.project.code}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                    )}
                </td>
            ) : null}
            <td className="px-4 py-3 align-middle">
                {lead.stage ? (
                    <StageBadge
                        label={lead.stage.title}
                        color={lead.stage.color}
                    />
                ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                )}
            </td>
            {compact ? (
                <td className="px-4 py-3 align-middle text-sm text-muted-foreground">
                    <span className="line-clamp-2">
                        {lead.next_action || "—"}
                    </span>
                </td>
            ) : null}
            <td className="px-4 py-3 align-middle">
                {lead.assignee ? (
                    <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar
                            name={lead.assignee.display_name}
                            src={lead.assignee.avatar || undefined}
                            size="sm"
                            className="size-7 shrink-0"
                            textClass="text-[9px]"
                        />
                        {!compact ? (
                            <span className="truncate text-sm text-foreground">
                                {lead.assignee.display_name}
                            </span>
                        ) : null}
                    </div>
                ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                )}
            </td>
            {!compact ? (
                <>
                    <td className="whitespace-nowrap px-4 py-3 align-middle text-sm text-foreground">
                        {formatMoney(lead.budget)}
                    </td>
                    <td className="px-4 py-3 align-middle text-sm text-muted-foreground">
                        <span title={formatDateTime(lead.last_activity_at)}>
                            {formatRelativeTime(lead.last_activity_at)}
                        </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-sm text-muted-foreground">
                        {formatDateTime(lead.created_at)}
                    </td>
                </>
            ) : null}
        </tr>
    );
}

function Leads({
    leads: leadsProp,
    board: boardProp,
    view = "table",
    pagination = emptyPagination,
    filters = {},
    formOptions = {},
    openedLead = null,
}) {
    const pending = isPagePending(leadsProp);
    const leads = leadsProp ?? [];
    const board = boardProp ?? [];
    const isArchive = view === "archive";
    const currentView = isArchive ? "archive" : view === "kanban" ? "kanban" : "table";
    const layoutView = isArchive || currentView === "table" ? "table" : "kanban";
    const [search, setSearch] = useState(filters.q || "");
    const [leadFormOpen, setLeadFormOpen] = useState(false);
    const [editingLead, setEditingLead] = useState(null);
    const [selectedLead, setSelectedLead] = useState(null);
    const [checkedIds, setCheckedIds] = useState([]);
    const [bulkBusy, setBulkBusy] = useState(false);
    const searchTimeout = useRef(null);
    const openLeadCode = useRef(null);
    const requestedLeadCode = useRef(null);

    const appliedFilters = useMemo(
        () => ({
            project: toSelectedList(filters.project),
            stage: toSelectedList(filters.stage),
            tag: toSelectedList(filters.tag),
            assigned_to: toSelectedList(filters.assigned_to),
            next_action: toSelectedList(filters.next_action),
        }),
        [filters.project, filters.stage, filters.tag, filters.assigned_to, filters.next_action]
    );

    useEffect(() => {
        if (!selectedLead) {
            return;
        }

        const fresh = leads.find((lead) => lead.id === selectedLead.id);

        if (fresh) {
            setSelectedLead(fresh);
            return;
        }

        if (openedLead && openedLead.id === selectedLead.id) {
            return;
        }

        if (openLeadCode.current && openLeadCode.current === selectedLead.code) {
            return;
        }

        if (leadCodeFromLocation() === selectedLead.code) {
            return;
        }

        setSelectedLead(null);
    }, [leads, selectedLead?.id, openedLead]);

    useEffect(() => {
        const code = leadCodeFromLocation();

        if (!code || leadsProp === undefined) {
            return;
        }

        if (openedLead?.code === code) {
            openLeadCode.current = code;
            setSelectedLead(openedLead);
            writeLeadHash(code);

            return;
        }

        const found = findLoadedLead(code, leads, board);

        if (found) {
            openLeadCode.current = code;
            setSelectedLead((current) => (current?.id === found.id ? current : found));

            return;
        }

        if (requestedLeadCode.current === code) {
            return;
        }

        requestedLeadCode.current = code;
        router.get(index.url(), { lead: code }, {
            only: ["openedLead"],
            preserveState: true,
            preserveScroll: true,
            preserveUrl: true,
            replace: true,
        });
    }, [openedLead, leads, board, leadsProp]);

    const panelOpen = Boolean(selectedLead);
    const compact = panelOpen;

    const currentPage = Number(pagination.current_page) || 1;
    const lastPage = Math.max(1, Number(pagination.last_page) || 1);
    const pageItems = useMemo(
        () => paginationItems(currentPage, lastPage),
        [currentPage, lastPage]
    );

    useEffect(() => {
        setSearch(filters.q || "");
    }, [filters.q]);

    useEffect(() => {
        setCheckedIds([]);
    }, [currentView, currentPage, filters.q, filters.project, filters.stage, filters.tag, filters.assigned_to, filters.next_action]);

    useEffect(() => {
        return () => {
            if (searchTimeout.current) {
                clearTimeout(searchTimeout.current);
            }
        };
    }, []);

    const pageLeadIds = useMemo(
        () => leads.map((lead) => lead.id).filter(Boolean),
        [leads]
    );

    const checkedOnPage = useMemo(
        () => pageLeadIds.filter((id) => checkedIds.includes(id)),
        [pageLeadIds, checkedIds]
    );

    const allPageChecked =
        pageLeadIds.length > 0 && checkedOnPage.length === pageLeadIds.length;
    const somePageChecked =
        checkedOnPage.length > 0 && checkedOnPage.length < pageLeadIds.length;
    const hasChecked = checkedIds.length > 0;
    const filterSections = useMemo(() => {
        const projectOptions = (formOptions.projects || []).map((project) => ({
            value: project.code,
            label: project.title,
            thumbnail: project.thumbnail || undefined,
        }));

        const stageOptions = (formOptions.stages || []).map((stage) => ({
            value: stage.label,
            label: stage.title,
            color: stage.color || undefined,
        }));

        const tagOptions = (formOptions.tags || []).map((value) => ({
            value,
            label: HEAT_LABELS[value] || value,
        }));

        const assigneeOptions = (formOptions.assignees || []).map((user) => ({
            value: String(user.id),
            label: user.display_name,
            avatar: user.avatar || undefined,
        }));

        const nextActionOptions = (formOptions.next_actions || []).map((item) => {
            const title = typeof item === "string" ? item : item.title;

            return {
                value: title,
                label: title,
            };
        });

        return [
            { key: "stage", label: "Stage", type: "stage", options: stageOptions },
            { key: "project", label: "Project", type: "projects", options: projectOptions },
            { key: "tag", label: "Heat", type: "heat", options: tagOptions },
            {
                key: "next_action",
                label: "Next Action",
                type: "chips",
                options: nextActionOptions,
            },
            ...(assigneeOptions.length > 0
                ? [{
                    key: "assigned_to",
                    label: "Assignee",
                    type: "people",
                    options: assigneeOptions,
                }]
                : []),
        ];
    }, [formOptions.projects, formOptions.stages, formOptions.tags, formOptions.next_actions, formOptions.assignees]);

    const visitLeads = (next = {}) => {
        const page = Object.prototype.hasOwnProperty.call(next, "page")
            ? next.page
            : currentPage;
        const nextView = Object.prototype.hasOwnProperty.call(next, "view")
            ? next.view
            : currentView;

        const params = {
            view:
                nextView === "archive"
                    ? "archive"
                    : nextView === "kanban"
                      ? "kanban"
                      : "table",
            q: Object.prototype.hasOwnProperty.call(next, "q") ? next.q : search,
            project: toFilterParam(
                Object.prototype.hasOwnProperty.call(next, "project")
                    ? next.project
                    : appliedFilters.project
            ),
            stage: toFilterParam(
                Object.prototype.hasOwnProperty.call(next, "stage")
                    ? next.stage
                    : appliedFilters.stage
            ),
            tag: toFilterParam(
                Object.prototype.hasOwnProperty.call(next, "tag")
                    ? next.tag
                    : appliedFilters.tag
            ),
            assigned_to: toFilterParam(
                Object.prototype.hasOwnProperty.call(next, "assigned_to")
                    ? next.assigned_to
                    : appliedFilters.assigned_to
            ),
            next_action: toFilterParam(
                Object.prototype.hasOwnProperty.call(next, "next_action")
                    ? next.next_action
                    : appliedFilters.next_action
            ),
            page:
                (nextView === "table" || nextView === "archive") && page > 1
                    ? String(page)
                    : "",
        };

        Object.keys(params).forEach((key) => {
            if (!params[key]) {
                delete params[key];
            }
        });

        router.get(index.url(), params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ["leads", "board", "view", "pagination", "filters", "formOptions", "openedLead"],
            onFinish: () => writeLeadHash(openLeadCode.current),
        });
    };

    const setView = (nextView) => {
        if (nextView === currentView) {
            return;
        }

        setSelectedLead(null);
        setCheckedIds([]);
        openLeadCode.current = null;
        visitLeads({ view: nextView, page: 1 });
    };

    const toggleLeadCheck = (leadId, nextChecked) => {
        setCheckedIds((prev) => {
            if (nextChecked) {
                return prev.includes(leadId) ? prev : [...prev, leadId];
            }

            return prev.filter((id) => id !== leadId);
        });
    };

    const toggleCheckAllOnPage = (nextChecked) => {
        setCheckedIds((prev) => {
            if (nextChecked) {
                const merged = new Set([...prev, ...pageLeadIds]);

                return Array.from(merged);
            }

            return prev.filter((id) => !pageLeadIds.includes(id));
        });
    };

    const runBulkAction = async ({
        action,
        assigned_to,
        lead_stage_id,
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
            bulkLeads.url(),
            {
                ids: checkedIds,
                action,
                ...(action === "assign" ? { assigned_to } : {}),
                ...(action === "stage" ? { lead_stage_id } : {}),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(successMessage);
                    setCheckedIds([]);
                    setSelectedLead(null);
                },
                onError: (errors) =>
                    toast.error(
                        errors.ids ||
                            errors.action ||
                            errors.assigned_to ||
                            errors.lead_stage_id ||
                            errors.message ||
                            errorMessage
                    ),
                onFinish: () => setBulkBusy(false),
            }
        );
    };

    const handleBulkArchive = () =>
        runBulkAction({
            action: "archive",
            confirmMessage: `Archive ${checkedIds.length} lead${checkedIds.length === 1 ? "" : "s"}? You can restore them later.`,
            confirmTitle: "Archive leads",
            successMessage: "Leads archived",
            errorMessage: "Could not archive leads",
        });

    const handleBulkRestore = () =>
        runBulkAction({
            action: "restore",
            successMessage: "Leads restored to pipeline",
            errorMessage: "Could not restore leads",
        });

    const handleBulkDelete = () =>
        runBulkAction({
            action: "destroy",
            confirmMessage: `Permanently delete ${checkedIds.length} archived lead${checkedIds.length === 1 ? "" : "s"}? This cannot be undone from the archive.`,
            confirmTitle: "Delete leads",
            successMessage: "Leads deleted",
            errorMessage: "Could not delete leads",
        });

    const handleBulkAssign = (userId) =>
        runBulkAction({
            action: "assign",
            assigned_to: userId,
            successMessage: "Assignee updated",
            errorMessage: "Could not update assignee",
        });

    const handleBulkStage = (stageId) =>
        runBulkAction({
            action: "stage",
            lead_stage_id: stageId,
            successMessage: "Stage updated",
            errorMessage: "Could not update stage",
        });

    const handleSearchChange = (event) => {
        const value = event.target.value;
        setSearch(value);

        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }

        searchTimeout.current = setTimeout(() => {
            visitLeads({ q: value.trim(), page: 1 });
        }, 300);
    };

    const handleFiltersApply = (next) => {
        visitLeads({
            project: next.project || [],
            stage: next.stage || [],
            tag: next.tag || [],
            assigned_to: next.assigned_to || [],
            next_action: next.next_action || [],
            page: 1,
        });
    };

    const handleFiltersClear = () => {
        handleFiltersApply({
            project: [],
            stage: [],
            tag: [],
            assigned_to: [],
            next_action: [],
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

        visitLeads({ page: nextPage });
    };

    const openCreate = () => {
        setEditingLead(null);
        setLeadFormOpen(true);
    };

    const openLead = (lead) => {
        if (!lead?.code) {
            return;
        }

        openLeadCode.current = lead.code;
        setSelectedLead(lead);
        writeLeadHash(lead.code);
    };

    const clearSelection = () => {
        openLeadCode.current = null;
        setSelectedLead(null);
        writeLeadHash(null);
    };

    const openEdit = (lead) => {
        setEditingLead(lead);
        setLeadFormOpen(true);
    };

    const hasFilters =
        Boolean(filters.q) ||
        appliedFilters.project.length > 0 ||
        appliedFilters.stage.length > 0 ||
        appliedFilters.tag.length > 0 ||
        appliedFilters.assigned_to.length > 0 ||
        appliedFilters.next_action.length > 0;

    const rangeLabel =
        pagination.total > 0
            ? `Showing ${pagination.from}–${pagination.to} of ${pagination.total}`
            : "No results";

    if (pending) {
        return <PageSkeleton title="Leads" variant="table" />;
    }

    return (
        <TooltipProvider delay={200}>
        <Layout>
            <Layout.Header metaTitle="Leads" breadcrumbs={[{ label: "Leads" }]} />

            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar className="flex-wrap">
                    <div className="mr-2 shrink-0">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Leads
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            {isArchive ? "Archived Leads" : "Sales Pipelines"}
                        </p>
                    </div>

                    <FilterInput
                        value={search}
                        onChange={handleSearchChange}
                        placeholder="Search leads..."
                        className="w-56"
                    />

                    <FilterMenu
                        sections={filterSections}
                        value={appliedFilters}
                        onApply={handleFiltersApply}
                    />

                    {hasChecked && layoutView === "table" ? (
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
                                {isArchive ? (
                                    <>
                                        <DropdownMenuItem
                                            disabled={bulkBusy}
                                            onClick={handleBulkRestore}
                                        >
                                            Restore
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            variant="destructive"
                                            disabled={bulkBusy}
                                            onClick={handleBulkDelete}
                                        >
                                            Delete permanently
                                        </DropdownMenuItem>
                                    </>
                                ) : (
                                    <>
                                        {(formOptions.assignees || []).length > 0 ? (
                                            <DropdownMenuSub>
                                                <DropdownMenuSubTrigger>
                                                    Assign Lead Owner
                                                </DropdownMenuSubTrigger>
                                                <DropdownMenuSubContent className="min-w-44">
                                                    {(formOptions.assignees || []).map((user) => (
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

                                        {(formOptions.stages || []).length > 0 ? (
                                            <DropdownMenuSub>
                                                <DropdownMenuSubTrigger>
                                                    Move to Stage
                                                </DropdownMenuSubTrigger>
                                                <DropdownMenuSubContent className="min-w-44">
                                                    {(formOptions.stages || []).map((stage) => (
                                                        <DropdownMenuItem
                                                            key={stage.id}
                                                            className="gap-2"
                                                            disabled={bulkBusy}
                                                            onClick={() => handleBulkStage(stage.id)}
                                                        >
                                                            <span
                                                                className="size-2 shrink-0 rounded-full"
                                                                style={{
                                                                    backgroundColor:
                                                                        stage.color ||
                                                                        "var(--muted-foreground)",
                                                                }}
                                                                aria-hidden
                                                            />
                                                            {stage.title}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuSubContent>
                                            </DropdownMenuSub>
                                        ) : null}

                                        <DropdownMenuItem
                                            disabled={bulkBusy}
                                            onClick={handleBulkArchive}
                                        >
                                            Archive
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : null}

                    <div className="ml-auto flex items-center gap-2">
                        <div className="inline-flex items-center rounded-md border border-border bg-background p-0.5">
                            <Button
                                type="button"
                                size="sm"
                                variant={!isArchive ? "secondary" : "ghost"}
                                className="gap-1.5"
                                onClick={() => {
                                    if (isArchive) {
                                        setView("table");
                                    }
                                }}
                            >
                                <Icon name="flow-chart" className="text-base" />
                                Pipeline
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={isArchive ? "secondary" : "ghost"}
                                className="gap-1.5"
                                onClick={() => setView("archive")}
                            >
                                <Icon name="archive-line" className="text-base" />
                                Archive
                            </Button>
                        </div>

                        {!isArchive ? (
                            <div className="inline-flex items-center rounded-md border border-border bg-background p-0.5">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={currentView === "kanban" ? "secondary" : "ghost"}
                                    className="gap-1.5"
                                    onClick={() => setView("kanban")}
                                >
                                    <Icon name="kanban-view-2" className="text-base" />
                                    Kanban
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={currentView === "table" ? "secondary" : "ghost"}
                                    className="gap-1.5"
                                    onClick={() => setView("table")}
                                >
                                    <Icon name="table-line" className="text-base" />
                                    Table
                                </Button>
                            </div>
                        ) : null}

                        {!isArchive ? (
                            <Button type="button" className="shrink-0" onClick={openCreate}>
                                <Icon name="add-line" className="text-base" />
                                New Lead
                            </Button>
                        ) : null}
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
                        {layoutView === "kanban" ? (
                            <div className="min-h-0 flex-1 overflow-hidden">
                                {board.length === 0 && leads.length === 0 ? (
                                    <div className="flex min-h-[22rem] flex-col items-center justify-center px-6 text-center">
                                        <div className="mb-4 flex size-14 items-center justify-center rounded-md bg-primary/10 text-primary">
                                            <Icon
                                                name="customer-service-line"
                                                className="text-2xl"
                                            />
                                        </div>
                                        <h2 className="text-lg font-semibold tracking-tight">
                                            {hasFilters
                                                ? "No leads match your filters"
                                                : "Add your first lead"}
                                        </h2>
                                        <p className="mt-2 max-w-md text-sm text-muted-foreground">
                                            {hasFilters
                                                ? "Try another project, stage, or search term."
                                                : "Track inquiries against projects and units, then drag them through stages."}
                                        </p>
                                        {!hasFilters ? (
                                            <Button
                                                type="button"
                                                className="mt-5"
                                                onClick={openCreate}
                                            >
                                                <Icon name="add-line" className="text-base" />
                                                Create lead
                                            </Button>
                                        ) : null}
                                    </div>
                                ) : (
                                    <LeadsKanbanBoard
                                        board={board}
                                        filters={filters}
                                        selectedLeadId={selectedLead?.id ?? null}
                                        doNothingTitle={
                                            (formOptions.next_actions || []).find(
                                                (item) => item?.label === "do_nothing"
                                            )?.title || "Do Nothing"
                                        }
                                        onOpenLead={openLead}
                                    />
                                )}
                            </div>
                        ) : (
                            <>
                        <ScrollArea className="min-h-0 flex-1 overflow-hidden">
                            <div className="px-6 py-6">
                                {leads.length === 0 ? (
                                    <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-6 text-center">
                                        <div className="mb-4 flex size-14 items-center justify-center rounded-md bg-primary/10 text-primary">
                                            <Icon
                                                name="customer-service-line"
                                                className="text-2xl"
                                            />
                                        </div>
                                        <h2 className="text-lg font-semibold tracking-tight">
                                            {hasFilters
                                                ? "No leads match your filters"
                                                : isArchive
                                                  ? "Archive is empty"
                                                  : "Add your first lead"}
                                        </h2>
                                        <p className="mt-2 max-w-md text-sm text-muted-foreground">
                                            {hasFilters
                                                ? "Try another project, stage, or search term."
                                                : isArchive
                                                  ? "Archived leads will show up here for review, restore, or permanent removal."
                                                  : "Track inquiries against projects and units, then move them through stages."}
                                        </p>
                                        {!hasFilters && !isArchive ? (
                                            <Button
                                                type="button"
                                                className="mt-5"
                                                onClick={openCreate}
                                            >
                                                <Icon name="add-line" className="text-base" />
                                                Create lead
                                            </Button>
                                        ) : null}
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-border bg-card">
                                        <table
                                            className={cn(
                                                "w-full text-left text-sm",
                                                compact ? "min-w-[520px]" : "min-w-[960px]"
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
                                                            aria-label="Select all leads on this page"
                                                        />
                                                    </th>
                                                    <th className="min-w-44 px-4 py-3 font-medium">
                                                        {compact ? "Contact" : "Lead"}
                                                    </th>
                                                    {!compact ? (
                                                        <th className="min-w-44 px-4 py-3 font-medium">
                                                            Project
                                                        </th>
                                                    ) : null}
                                                    <th className="w-32 px-4 py-3 font-medium">
                                                        {compact ? "Status" : "Stage"}
                                                    </th>
                                                    {compact ? (
                                                        <th className="min-w-32 px-4 py-3 font-medium">
                                                            Next action
                                                        </th>
                                                    ) : null}
                                                    <th className="min-w-28 px-4 py-3 font-medium">
                                                        {compact ? "Assigned" : "Assignee"}
                                                    </th>
                                                    {!compact ? (
                                                        <>
                                                            <th className="w-28 whitespace-nowrap px-4 py-3 font-medium">
                                                                Budget
                                                            </th>
                                                            <th className="min-w-36 px-4 py-3 font-medium">
                                                                Last activity
                                                            </th>
                                                            <th className="min-w-36 px-4 py-3 font-medium">
                                                                Created
                                                            </th>
                                                        </>
                                                    ) : null}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {leads.map((lead) => (
                                                    <LeadRow
                                                        key={lead.id}
                                                        lead={lead}
                                                        compact={compact}
                                                        selected={
                                                            selectedLead?.id === lead.id
                                                        }
                                                        checked={checkedIds.includes(lead.id)}
                                                        onToggleCheck={toggleLeadCheck}
                                                        onOpen={openLead}
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
                                                        "pointer-events-none opacity-50"
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
                                            )
                                        )}
                                        <PaginationItem>
                                            <PaginationNext
                                                href="#"
                                                text="Next"
                                                className={cn(
                                                    currentPage >= lastPage &&
                                                        "pointer-events-none opacity-50"
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
                            </>
                        )}
                    </div>

                    <aside
                        className={cn(
                            "min-h-0 min-w-0 overflow-hidden bg-background transition-[border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                            panelOpen
                                ? "border-l border-border"
                                : "border-l border-transparent"
                        )}
                        aria-hidden={!panelOpen}
                    >
                        <div
                            className={cn(
                                "h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
                                panelOpen ? "translate-x-0" : "translate-x-full"
                            )}
                        >
                            {selectedLead ? (
                                <LeadDetailPanel
                                    lead={selectedLead}
                                    stages={formOptions.stages || []}
                                    projects={formOptions.projects || []}
                                    units={formOptions.units || []}
                                    assignees={formOptions.assignees || []}
                                    activityTypes={formOptions.activity_types || []}
                                    nextActionTypes={formOptions.next_actions || []}
                                    onClose={clearSelection}
                                    onEdit={openEdit}
                                />
                            ) : null}
                        </div>
                    </aside>
                </div>
            </Layout.Content>

            <LeadForm
                isOpen={leadFormOpen}
                onClose={() => {
                    setLeadFormOpen(false);
                    setEditingLead(null);
                }}
                data={editingLead}
                projects={formOptions.projects || []}
                stages={formOptions.stages || []}
                assignees={formOptions.assignees || []}
                sources={formOptions.sources || []}
            />
        </Layout>
        </TooltipProvider>
    );
}

Leads.layout = (page) => <PortalLayout children={page} />;

export default Leads;

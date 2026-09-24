import { useEffect, useMemo, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import {
    bulk as bulkUnits,
    destroy,
} from "@/actions/App/Http/Controllers/Portal/UnitController";
import { index } from "@/routes/portal/inventory";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { isPagePending, PageSkeleton } from "../../components/page-skeleton";
import { ProjectCardPopover } from "../../components/project-card";
import { formatUnitQuantity } from "../../components/unit-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckboxControl } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterInput } from "@/components/ui/filter-input";
import {
    ActiveFilters,
    FilterMenu,
    isRangeActive,
    sectionBounds,
    toRangeValue,
    toSelectedList,
} from "@/components/ui/filter-menu";
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
import { Tooltip } from "@/components/ui/tooltip";
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import UnitForm from "./unit-form";

function toFilterParam(value) {
    const list = toSelectedList(value);

    return list.length > 0 ? list.join(",") : "";
}

/**
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

const STATUS_LABELS = {
    AVAILABLE: "Available",
    RESERVED: "Reserved",
    TOKEN: "Token",
    HOLD: "On Hold",
    SOLD: "Sold",
    INACTIVE: "Inactive",
};

/** Shared status swatch colors (filters + badges). */
const STATUS_COLORS = {
    AVAILABLE: "#10b981",
    RESERVED: "#0ea5e9",
    TOKEN: "#8b5cf6",
    HOLD: "#f59e0b",
    SOLD: "#3b82f6",
    INACTIVE: "#94a3b8",
};

function statusTone(status) {
    switch (status) {
        case "AVAILABLE":
            return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
        case "RESERVED":
            return "bg-sky-500/15 text-sky-700 dark:text-sky-400";
        case "TOKEN":
            return "bg-violet-500/15 text-violet-700 dark:text-violet-400";
        case "HOLD":
            return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
        case "SOLD":
            return "bg-primary/10 text-primary";
        default:
            return "bg-muted text-muted-foreground";
    }
}

function formatSize(size, areaType) {
    if (size == null || size === "") {
        return "—";
    }

    return `${Number(size).toLocaleString()}${areaType ? ` ${areaType}` : ""}`;
}

function UnitRow({ unit, projectCard, checked = false, onToggleCheck, onEdit, onDelete }) {
    return (
        <tr
            className={cn(
                "border-b border-border last:border-0 hover:bg-muted/40",
                checked && "bg-muted/30"
            )}
        >
            <td className="w-10 px-3 py-3 align-middle">
                <CheckboxControl
                    checked={checked}
                    onCheckedChange={(value) => onToggleCheck?.(unit.id, Boolean(value))}
                    aria-label={`Select ${unit.name || "unit"}`}
                />
            </td>
            <td className="w-28 max-w-28 px-4 py-3 align-middle">
                <div className="truncate font-medium text-foreground">{unit.name || "Unit"}</div>
            </td>
            <td className="px-4 py-3 align-middle text-sm text-foreground">
                {projectCard ? (
                    <ProjectCardPopover project={projectCard} className="gap-2.5">
                        {projectCard.thumbnail ? (
                            <img
                                src={projectCard.thumbnail}
                                alt=""
                                className="size-8 shrink-0 rounded-md object-cover"
                            />
                        ) : (
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                <Icon name="community-line" className="text-base" />
                            </span>
                        )}
                        <span className="min-w-0 truncate">{projectCard.title}</span>
                    </ProjectCardPopover>
                ) : (
                    "—"
                )}
            </td>
            <td className="px-4 py-3 align-middle text-sm text-muted-foreground">
                {unit.block?.title || "—"}
            </td>
            <td className="px-4 py-3 align-middle text-sm text-muted-foreground">
                {unit.type || "—"}
            </td>
            <td className="px-4 py-3 align-middle text-sm text-muted-foreground">
                {unit.sector || "—"}
            </td>
            <td className="px-4 py-3 align-middle text-sm text-muted-foreground">
                {formatSize(unit.size, unit.area_type)}
            </td>
            <td className="px-4 py-3 align-middle text-sm tabular-nums text-foreground">
                {formatUnitQuantity(unit)}
            </td>
            <td className="whitespace-nowrap px-4 py-3 align-middle text-sm tabular-nums text-foreground">
                {formatMoney(unit.price)}
            </td>
            <td className="px-4 py-3 align-middle">
                <Badge className={cn("gap-1.5 font-normal", statusTone(unit.status))}>
                    <span
                        className="size-1.5 shrink-0 rounded-sm"
                        style={{
                            backgroundColor:
                                STATUS_COLORS[unit.status] || "var(--muted-foreground)",
                        }}
                        aria-hidden
                    />
                    {STATUS_LABELS[unit.status] || unit.status || "—"}
                </Badge>
            </td>
            <td className="px-4 py-3 align-middle text-right">
                <DropdownMenu>
                    <Tooltip content="More actions">
                        <DropdownMenuTrigger
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label={`Actions for ${unit.name || "unit"}`}
                        >
                            <Icon name="more-2-fill" className="text-lg" />
                        </DropdownMenuTrigger>
                    </Tooltip>
                    <DropdownMenuContent align="end" className="min-w-36">
                        <DropdownMenuItem className="gap-2" onClick={() => onEdit(unit)}>
                            <Icon name="pencil-line" className="text-base" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            variant="destructive"
                            className="gap-2"
                            onClick={() => onDelete(unit)}
                        >
                            <Icon name="delete-bin-line" className="text-base" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </td>
        </tr>
    );
}

function Inventory({
    units: unitsProp,
    pagination = emptyPagination,
    filters = {},
    formOptions = {},
}) {
    const pending = isPagePending(unitsProp);
    const units = unitsProp ?? [];
    const [search, setSearch] = useState(filters.q || "");
    const [unitFormOpen, setUnitFormOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState(null);
    const [blocks, setBlocks] = useState(formOptions.blocks || []);
    const [checkedIds, setCheckedIds] = useState([]);
    const [bulkBusy, setBulkBusy] = useState(false);
    const searchTimeout = useRef(null);

    const priceBounds = useMemo(
        () => formOptions.price || { min: 0, max: 10000000, step: 100000 },
        [formOptions.price]
    );

    const projectsById = useMemo(() => {
        const map = new Map();

        for (const project of formOptions.projects || []) {
            map.set(project.id, project);
        }

        return map;
    }, [formOptions.projects]);

    const appliedFilters = useMemo(
        () => ({
            project: toSelectedList(filters.project),
            status: toSelectedList(filters.status),
            type: toSelectedList(filters.type),
            price: toRangeValue(filters.price, priceBounds),
        }),
        [filters.project, filters.status, filters.type, filters.price, priceBounds]
    );

    const priceFilterActive = isRangeActive(appliedFilters.price, priceBounds);

    const currentPage = Number(pagination.current_page) || 1;
    const lastPage = Math.max(1, Number(pagination.last_page) || 1);
    const pageItems = useMemo(
        () => paginationItems(currentPage, lastPage),
        [currentPage, lastPage]
    );

    useEffect(() => {
        setBlocks(formOptions.blocks || []);
    }, [formOptions.blocks]);

    useEffect(() => {
        setSearch(filters.q || "");
    }, [filters.q]);

    useEffect(() => {
        setCheckedIds([]);
    }, [
        currentPage,
        filters.q,
        filters.project,
        filters.status,
        filters.type,
        filters.price,
    ]);

    useEffect(() => {
        return () => {
            if (searchTimeout.current) {
                clearTimeout(searchTimeout.current);
            }
        };
    }, []);

    const pageUnitIds = useMemo(
        () => units.map((unit) => unit.id).filter(Boolean),
        [units]
    );

    const checkedOnPage = useMemo(
        () => pageUnitIds.filter((id) => checkedIds.includes(id)),
        [pageUnitIds, checkedIds]
    );

    const allPageChecked =
        pageUnitIds.length > 0 && checkedOnPage.length === pageUnitIds.length;
    const somePageChecked =
        checkedOnPage.length > 0 && checkedOnPage.length < pageUnitIds.length;
    const hasChecked = checkedIds.length > 0;

    const filterSections = useMemo(() => {
        const statusOptions = (formOptions.statuses || []).map((value) => ({
            value,
            label: STATUS_LABELS[value] || value,
            color: STATUS_COLORS[value],
        }));

        const projectOptions = (formOptions.projects || []).map((project) => ({
            value: project.code,
            label: project.title,
            thumbnail: project.thumbnail || undefined,
        }));

        const typeOptions = (formOptions.types?.length
            ? formOptions.types
            : Array.from(new Set(units.map((unit) => unit.type).filter(Boolean)))
        )
            .map((value) => ({ value, label: value }));

        return [
            { key: "status", label: "Status", type: "status", options: statusOptions },
            { key: "project", label: "Project", type: "projects", options: projectOptions },
            ...(typeOptions.length > 0
                ? [{ key: "type", label: "Type", type: "chips", options: typeOptions }]
                : []),
            {
                key: "price",
                label: "Value",
                type: "range",
                min: priceBounds.min,
                max: priceBounds.max,
                step: priceBounds.step,
            },
        ];
    }, [
        formOptions.statuses,
        formOptions.projects,
        formOptions.types,
        units,
        priceBounds.min,
        priceBounds.max,
        priceBounds.step,
    ]);

    const visitInventory = (next = {}) => {
        const page = Object.prototype.hasOwnProperty.call(next, "page")
            ? next.page
            : currentPage;

        const priceRange = toRangeValue(
            Object.prototype.hasOwnProperty.call(next, "price")
                ? next.price
                : appliedFilters.price,
            priceBounds
        );
        const priceActive = isRangeActive(priceRange, priceBounds);

        const params = {
            q: Object.prototype.hasOwnProperty.call(next, "q")
                ? next.q
                : search,
            project: toFilterParam(
                Object.prototype.hasOwnProperty.call(next, "project")
                    ? next.project
                    : appliedFilters.project
            ),
            status: toFilterParam(
                Object.prototype.hasOwnProperty.call(next, "status")
                    ? next.status
                    : appliedFilters.status
            ),
            type: toFilterParam(
                Object.prototype.hasOwnProperty.call(next, "type")
                    ? next.type
                    : appliedFilters.type
            ),
            page: page > 1 ? String(page) : "",
        };

        if (priceActive) {
            params.price_min = priceRange[0];
            params.price_max = priceRange[1];
        }

        Object.keys(params).forEach((key) => {
            if (!params[key] && params[key] !== 0) {
                delete params[key];
            }
        });

        router.get(index.url(), params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ["units", "pagination", "filters", "formOptions"],
        });
    };

    const handleSearchChange = (event) => {
        const value = event.target.value;
        setSearch(value);

        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }

        searchTimeout.current = setTimeout(() => {
            visitInventory({ q: value.trim(), page: 1 });
        }, 300);
    };

    const handleFiltersApply = (next) => {
        visitInventory({
            project: next.project || [],
            status: next.status || [],
            type: next.type || [],
            price: next.price || sectionBounds(priceBounds),
            page: 1,
        });
    };

    const handleFiltersClear = () => {
        handleFiltersApply({
            project: [],
            status: [],
            type: [],
            price: sectionBounds(priceBounds),
        });
    };

    const goToPage = (page) => {
        if (page < 1 || page > lastPage || page === currentPage) {
            return;
        }

        visitInventory({ page });
    };

    const rangeLabel =
        pagination.total > 0
            ? `Showing ${pagination.from}–${pagination.to} of ${pagination.total}`
            : "No units";

    const openCreate = () => {
        setEditingUnit(null);
        setUnitFormOpen(true);
    };

    const openEdit = (unit) => {
        setEditingUnit(unit);
        setUnitFormOpen(true);
    };

    const toggleUnitCheck = (unitId, nextChecked) => {
        setCheckedIds((prev) => {
            if (nextChecked) {
                return prev.includes(unitId) ? prev : [...prev, unitId];
            }

            return prev.filter((id) => id !== unitId);
        });
    };

    const toggleCheckAllOnPage = (nextChecked) => {
        setCheckedIds((prev) => {
            if (nextChecked) {
                const merged = new Set([...prev, ...pageUnitIds]);

                return Array.from(merged);
            }

            return prev.filter((id) => !pageUnitIds.includes(id));
        });
    };

    const runBulkAction = async ({
        action,
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
            bulkUnits.url(),
            {
                ids: checkedIds,
                action,
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
                            errors.status ||
                            errors.message ||
                            errorMessage
                    ),
                onFinish: () => setBulkBusy(false),
            }
        );
    };

    const handleBulkStatus = (status) =>
        runBulkAction({
            action: "status",
            status,
            successMessage: "Status updated",
            errorMessage: "Could not update status",
        });

    const handleBulkDelete = () =>
        runBulkAction({
            action: "destroy",
            confirmMessage: `Delete ${checkedIds.length} unit${checkedIds.length === 1 ? "" : "s"} from inventory? This cannot be undone.`,
            confirmTitle: "Delete units",
            successMessage: "Units deleted",
            errorMessage: "Could not delete units",
        });

    const confirmDelete = async (unit) => {
        const label = unit.name || "this unit";
        const confirmed = await confirm(
            `Delete "${label}" from inventory? This cannot be undone.`,
            "Delete unit"
        );

        if (!confirmed) {
            return;
        }

        toast.promise(
            new Promise((resolve, reject) => {
                router.delete(destroy.url(unit.code), {
                    preserveScroll: true,
                    onSuccess: () => resolve(),
                    onError: () => reject(new Error("Unable to delete unit")),
                });
            }),
            {
                loading: "Deleting unit...",
                success: "Unit deleted",
                error: "Unable to delete unit",
            }
        );
    };

    if (pending) {
        return <PageSkeleton title="Inventory" variant="table" />;
    }

    return (
        <Layout>
            <Layout.Header
                metaTitle="Inventory"
                breadcrumbs={[{ label: "Inventory" }]}
            />

            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar className="flex-wrap">
                    <h1 className="shrink-0 text-2xl font-bold tracking-tight text-foreground">
                        Inventory
                    </h1>

                    <FilterInput
                        value={search}
                        onChange={handleSearchChange}
                        placeholder="Search code, name, place..."
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
                                {(formOptions.statuses || []).length > 0 ? (
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>
                                            Set status
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent className="min-w-44">
                                            {(formOptions.statuses || []).map((status) => (
                                                <DropdownMenuItem
                                                    key={status}
                                                    className="gap-2"
                                                    disabled={bulkBusy}
                                                    onClick={() => handleBulkStatus(status)}
                                                >
                                                    <span
                                                        className="size-2 shrink-0 rounded-sm"
                                                        style={{
                                                            backgroundColor:
                                                                STATUS_COLORS[status] ||
                                                                "var(--muted-foreground)",
                                                        }}
                                                        aria-hidden
                                                    />
                                                    {STATUS_LABELS[status] || status}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                ) : null}

                                <DropdownMenuItem
                                    variant="destructive"
                                    disabled={bulkBusy}
                                    onClick={handleBulkDelete}
                                >
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : null}

                    <Button type="button" className="ml-auto shrink-0" onClick={openCreate}>
                        <Icon name="add-line" className="text-base" />
                        Add Unit
                    </Button>
                </Layout.Toolbar>

                <ActiveFilters
                    sections={filterSections}
                    value={appliedFilters}
                    onChange={handleFiltersApply}
                    onClear={handleFiltersClear}
                />

                <ScrollArea className="flex-1">
                    <div className="px-6 py-6">
                        {units.length === 0 ? (
                            <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-6 text-center">
                                <div className="mb-4 flex size-14 items-center justify-center rounded-md bg-primary/10 text-primary">
                                    <Icon name="shape-line" className="text-2xl" />
                                </div>
                                <h2 className="text-lg font-semibold tracking-tight">
                                    {filters.q ||
                                    appliedFilters.project.length > 0 ||
                                    appliedFilters.status.length > 0 ||
                                    appliedFilters.type.length > 0 ||
                                    priceFilterActive
                                        ? "No units match your filters"
                                        : "Add your first inventory unit"}
                                </h2>
                                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                                    {filters.q ||
                                    appliedFilters.project.length > 0 ||
                                    appliedFilters.status.length > 0 ||
                                    appliedFilters.type.length > 0 ||
                                    priceFilterActive
                                        ? "Try another project, status, or search term."
                                        : "Units belong to a project. Blocks are optional for grouping towers or phases."}
                                </p>
                                {!filters.q &&
                                appliedFilters.project.length === 0 &&
                                appliedFilters.status.length === 0 &&
                                appliedFilters.type.length === 0 &&
                                !priceFilterActive ? (
                                    <Button type="button" className="mt-5" onClick={openCreate}>
                                        <Icon name="add-line" className="text-base" />
                                        Create unit
                                    </Button>
                                ) : null}
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-lg border border-border bg-card">
                                <table className="w-full table-fixed text-left text-sm">
                                    <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                                        <tr>
                                            <th className="w-10 px-3 py-3">
                                                <CheckboxControl
                                                    checked={allPageChecked}
                                                    indeterminate={somePageChecked}
                                                    onCheckedChange={(value) =>
                                                        toggleCheckAllOnPage(Boolean(value))
                                                    }
                                                    aria-label="Select all units on this page"
                                                />
                                            </th>
                                            <th className="w-28 px-4 py-3 font-medium">Unit</th>
                                            <th className="w-40 px-4 py-3 font-medium">Project</th>
                                            <th className="w-32 px-4 py-3 font-medium">Block</th>
                                            <th className="w-28 px-4 py-3 font-medium">Type</th>
                                            <th className="w-36 px-4 py-3 font-medium">Place</th>
                                            <th className="w-28 px-4 py-3 font-medium">Size</th>
                                            <th className="w-24 px-4 py-3 font-medium">Qty/Rem</th>
                                            <th className="w-32 whitespace-nowrap px-4 py-3 font-medium">
                                                Price
                                            </th>
                                            <th className="w-28 px-4 py-3 font-medium">Status</th>
                                            <th className="w-16 px-4 py-3 text-right font-medium" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {units.map((unit) => (
                                            <UnitRow
                                                key={unit.id}
                                                unit={unit}
                                                projectCard={
                                                    projectsById.get(unit.project_id) ||
                                                    unit.project
                                                }
                                                checked={checkedIds.includes(unit.id)}
                                                onToggleCheck={toggleUnitCheck}
                                                onEdit={openEdit}
                                                onDelete={confirmDelete}
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
                        <p className="text-sm text-muted-foreground">{rangeLabel}</p>
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
            </Layout.Content>

            <UnitForm
                isOpen={unitFormOpen}
                onClose={() => {
                    setUnitFormOpen(false);
                    setEditingUnit(null);
                }}
                data={editingUnit}
                projects={formOptions.projects || []}
                blocks={blocks}
                onBlockCreated={(block) => {
                    setBlocks((current) => {
                        if (current.some((row) => row.id === block.id)) {
                            return current;
                        }

                        return [...current, block];
                    });
                }}
            />
        </Layout>
    );
}

Inventory.layout = (page) => <PortalLayout children={page} />;

export default Inventory;

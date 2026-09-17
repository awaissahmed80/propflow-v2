import { useEffect, useMemo, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { destroy } from "@/actions/App/Http/Controllers/Portal/UnitController";
import { index } from "@/routes/portal/inventory";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
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

function UnitRow({ unit, onEdit, onDelete }) {
    return (
        <tr className="border-b border-border last:border-0 hover:bg-muted/40">
            <td className="px-4 py-3 align-middle">
                <div className="font-medium text-foreground">
                    {unit.name || unit.code}
                </div>
                <div className="text-xs text-muted-foreground">{unit.code}</div>
            </td>
            <td className="px-4 py-3 align-middle text-sm text-foreground">
                {unit.project?.title || "—"}
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
            <td className="px-4 py-3 align-middle text-sm text-foreground">
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
                    <DropdownMenuTrigger
                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={`Actions for ${unit.code}`}
                    >
                        <Icon name="more-2-fill" className="text-lg" />
                    </DropdownMenuTrigger>
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
    units = [],
    pagination = emptyPagination,
    filters = {},
    formOptions = {},
}) {
    const [search, setSearch] = useState(filters.q || "");
    const [unitFormOpen, setUnitFormOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState(null);
    const [blocks, setBlocks] = useState(formOptions.blocks || []);
    const searchTimeout = useRef(null);

    const priceBounds = useMemo(
        () => formOptions.price || { min: 0, max: 10000000, step: 100000 },
        [formOptions.price]
    );

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
        return () => {
            if (searchTimeout.current) {
                clearTimeout(searchTimeout.current);
            }
        };
    }, []);

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

    const confirmDelete = async (unit) => {
        const label = unit.name || unit.code;
        const confirmed = await confirm(
            `Delete "${label}" from inventory? This cannot be undone.`,
            "Delete unit"
        );

        if (!confirmed) {
            return;
        }

        toast.promise(
            new Promise((resolve, reject) => {
                router.delete(destroy.url(unit.id), {
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

    return (
        <Layout>
            <Layout.Header
                metaTitle="Inventory"
                breadcrumbs={[{ label: "Inventory" }]}
            />

            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar className="flex-wrap">
                    <h1 className="shrink-0 text-xl font-bold tracking-tight text-foreground">
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
                                            <th className="w-44 px-4 py-3 font-medium">Unit</th>
                                            <th className="w-40 px-4 py-3 font-medium">Project</th>
                                            <th className="w-32 px-4 py-3 font-medium">Block</th>
                                            <th className="w-28 px-4 py-3 font-medium">Type</th>
                                            <th className="w-36 px-4 py-3 font-medium">Place</th>
                                            <th className="w-28 px-4 py-3 font-medium">Size</th>
                                            <th className="w-28 px-4 py-3 font-medium">Price</th>
                                            <th className="w-28 px-4 py-3 font-medium">Status</th>
                                            <th className="w-16 px-4 py-3 text-right font-medium" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {units.map((unit) => (
                                            <UnitRow
                                                key={unit.id}
                                                unit={unit}
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

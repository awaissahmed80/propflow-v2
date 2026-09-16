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
import { FilterMenu } from "@/components/ui/filter-menu";
import { Icon } from "@/components/ui/icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import UnitForm from "./unit-form";

const STATUS_LABELS = {
    AVAILABLE: "Available",
    RESERVED: "Reserved",
    TOKEN: "Token",
    HOLD: "On Hold",
    SOLD: "Sold",
    INACTIVE: "Inactive",
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

function formatMoney(value) {
    if (value == null || value === "") {
        return "—";
    }

    return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 0,
    }).format(Number(value));
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
                <Badge className={cn("font-normal", statusTone(unit.status))}>
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

function Inventory({ units = [], filters = {}, formOptions = {} }) {
    const [search, setSearch] = useState(filters.q || "");
    const [unitFormOpen, setUnitFormOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState(null);
    const [blocks, setBlocks] = useState(formOptions.blocks || []);
    const searchTimeout = useRef(null);

    const appliedFilters = useMemo(
        () => ({
            project: filters.project || "",
            status: filters.status || "",
            type: filters.type || "",
        }),
        [filters.project, filters.status, filters.type]
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
        }));

        const projectOptions = (formOptions.projects || []).map((project) => ({
            value: project.code,
            label: project.title,
        }));

        const typeOptions = (formOptions.types?.length
            ? formOptions.types
            : Array.from(new Set(units.map((unit) => unit.type).filter(Boolean)))
        )
            .map((value) => ({ value, label: value }));

        return [
            { key: "status", label: "Status", options: statusOptions },
            { key: "project", label: "Project", options: projectOptions },
            ...(typeOptions.length > 0
                ? [{ key: "type", label: "Type", options: typeOptions }]
                : []),
        ];
    }, [formOptions.statuses, formOptions.projects, formOptions.types, units]);

    const visitInventory = (next = {}) => {
        const params = {
            q: Object.prototype.hasOwnProperty.call(next, "q")
                ? next.q
                : search,
            project: Object.prototype.hasOwnProperty.call(next, "project")
                ? next.project
                : appliedFilters.project,
            status: Object.prototype.hasOwnProperty.call(next, "status")
                ? next.status
                : appliedFilters.status,
            type: Object.prototype.hasOwnProperty.call(next, "type")
                ? next.type
                : appliedFilters.type,
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
            only: ["units", "filters", "formOptions"],
        });
    };

    const handleSearchChange = (event) => {
        const value = event.target.value;
        setSearch(value);

        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }

        searchTimeout.current = setTimeout(() => {
            visitInventory({ q: value.trim() });
        }, 300);
    };

    const handleFiltersApply = (next) => {
        visitInventory({
            project: next.project || "",
            status: next.status || "",
            type: next.type || "",
        });
    };

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

                <ScrollArea className="flex-1">
                    <div className="px-6 py-6">
                        {units.length === 0 ? (
                            <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-6 text-center">
                                <div className="mb-4 flex size-14 items-center justify-center rounded-md bg-primary/10 text-primary">
                                    <Icon name="shape-line" className="text-2xl" />
                                </div>
                                <h2 className="text-lg font-semibold tracking-tight">
                                    {filters.q || filters.project || filters.status || filters.type
                                        ? "No units match your filters"
                                        : "Add your first inventory unit"}
                                </h2>
                                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                                    {filters.q || filters.project || filters.status || filters.type
                                        ? "Try another project, status, or search term."
                                        : "Units belong to a project. Blocks are optional for grouping towers or phases."}
                                </p>
                                {!filters.q && !filters.project && !filters.status && !filters.type ? (
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

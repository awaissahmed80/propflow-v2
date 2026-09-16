import { useEffect, useMemo, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { destroy } from "@/actions/App/Http/Controllers/Portal/LeadController";
import { index } from "@/routes/portal/leads";
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
import LeadForm from "./lead-form";

const TAG_LABELS = {
    "VERY HOT": "Very Hot",
    HOT: "Hot",
    MODERATE: "Moderate",
    COLD: "Cold",
    "VERY COLD": "Very Cold",
};

function tagTone(tag) {
    switch (tag) {
        case "VERY HOT":
            return "bg-red-500/15 text-red-700 dark:text-red-400";
        case "HOT":
            return "bg-orange-500/15 text-orange-700 dark:text-orange-400";
        case "MODERATE":
            return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
        case "COLD":
            return "bg-sky-500/15 text-sky-700 dark:text-sky-400";
        case "VERY COLD":
            return "bg-slate-500/15 text-slate-700 dark:text-slate-300";
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

function LeadRow({ lead, onEdit, onDelete }) {
    return (
        <tr className="border-b border-border last:border-0 hover:bg-muted/40">
            <td className="px-4 py-3 align-middle">
                <div className="font-medium text-foreground">
                    {lead.contact?.display_name || "—"}
                </div>
                <div className="text-xs text-muted-foreground">{lead.code}</div>
            </td>
            <td className="px-4 py-3 align-middle text-sm text-muted-foreground">
                <div>{lead.contact?.phone_number || "—"}</div>
                {lead.contact?.email_address ? (
                    <div className="truncate text-xs">{lead.contact.email_address}</div>
                ) : null}
            </td>
            <td className="px-4 py-3 align-middle text-sm text-foreground">
                {lead.project?.title || "—"}
            </td>
            <td className="px-4 py-3 align-middle">
                {lead.stage ? (
                    <Badge
                        className="font-normal"
                        style={
                            lead.stage.color
                                ? {
                                      backgroundColor: `${lead.stage.color}22`,
                                      color: lead.stage.color,
                                  }
                                : undefined
                        }
                    >
                        {lead.stage.title}
                    </Badge>
                ) : (
                    "—"
                )}
            </td>
            <td className="px-4 py-3 align-middle">
                <Badge className={cn("font-normal", tagTone(lead.tag))}>
                    {TAG_LABELS[lead.tag] || lead.tag || "—"}
                </Badge>
            </td>
            <td className="px-4 py-3 align-middle text-sm text-foreground">
                {lead.assignee?.display_name || "—"}
            </td>
            <td className="px-4 py-3 align-middle text-sm text-foreground">
                {formatMoney(lead.budget)}
            </td>
            <td className="px-4 py-3 align-middle text-right">
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <Button type="button" variant="ghost" size="icon-sm">
                                <Icon name="more-2-fill" className="text-base" />
                            </Button>
                        }
                    />
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(lead)}>
                            <Icon name="pencil-line" className="text-base" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            variant="destructive"
                            onClick={() => onDelete(lead)}
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

function Leads({ leads = [], filters = {}, formOptions = {} }) {
    const [search, setSearch] = useState(filters.q || "");
    const [leadFormOpen, setLeadFormOpen] = useState(false);
    const [editingLead, setEditingLead] = useState(null);
    const searchTimeout = useRef(null);

    const appliedFilters = useMemo(
        () => ({
            project: filters.project || "",
            stage: filters.stage || "",
            tag: filters.tag || "",
            assigned_to: filters.assigned_to ? String(filters.assigned_to) : "",
        }),
        [filters.project, filters.stage, filters.tag, filters.assigned_to]
    );

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
        const projectOptions = (formOptions.projects || []).map((project) => ({
            value: project.code,
            label: project.title,
        }));

        const stageOptions = (formOptions.stages || []).map((stage) => ({
            value: stage.label,
            label: stage.title,
        }));

        const tagOptions = (formOptions.tags || []).map((value) => ({
            value,
            label: TAG_LABELS[value] || value,
        }));

        const assigneeOptions = (formOptions.assignees || []).map((user) => ({
            value: String(user.id),
            label: user.display_name,
        }));

        return [
            { key: "stage", label: "Stage", options: stageOptions },
            { key: "project", label: "Project", options: projectOptions },
            { key: "tag", label: "Heat", options: tagOptions },
            ...(assigneeOptions.length > 0
                ? [{ key: "assigned_to", label: "Assignee", options: assigneeOptions }]
                : []),
        ];
    }, [formOptions.projects, formOptions.stages, formOptions.tags, formOptions.assignees]);

    const visitLeads = (next = {}) => {
        const params = {
            q: Object.prototype.hasOwnProperty.call(next, "q") ? next.q : search,
            project: Object.prototype.hasOwnProperty.call(next, "project")
                ? next.project
                : appliedFilters.project,
            stage: Object.prototype.hasOwnProperty.call(next, "stage")
                ? next.stage
                : appliedFilters.stage,
            tag: Object.prototype.hasOwnProperty.call(next, "tag")
                ? next.tag
                : appliedFilters.tag,
            assigned_to: Object.prototype.hasOwnProperty.call(next, "assigned_to")
                ? next.assigned_to
                : appliedFilters.assigned_to,
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
            only: ["leads", "filters", "formOptions"],
        });
    };

    const handleSearchChange = (event) => {
        const value = event.target.value;
        setSearch(value);

        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }

        searchTimeout.current = setTimeout(() => {
            visitLeads({ q: value.trim() });
        }, 300);
    };

    const handleFiltersApply = (next) => {
        visitLeads({
            project: next.project || "",
            stage: next.stage || "",
            tag: next.tag || "",
            assigned_to: next.assigned_to || "",
        });
    };

    const openCreate = () => {
        setEditingLead(null);
        setLeadFormOpen(true);
    };

    const openEdit = (lead) => {
        setEditingLead(lead);
        setLeadFormOpen(true);
    };

    const confirmDelete = async (lead) => {
        const label = lead.contact?.display_name || lead.code;
        const confirmed = await confirm(
            `Delete lead "${label}"? This cannot be undone.`,
            "Delete lead"
        );

        if (!confirmed) {
            return;
        }

        toast.promise(
            new Promise((resolve, reject) => {
                router.delete(destroy.url(lead.id), {
                    preserveScroll: true,
                    onSuccess: () => resolve(),
                    onError: () => reject(new Error("Unable to delete lead")),
                });
            }),
            {
                loading: "Deleting lead...",
                success: "Lead deleted",
                error: "Unable to delete lead",
            }
        );
    };

    const hasFilters =
        filters.q || filters.project || filters.stage || filters.tag || filters.assigned_to;

    return (
        <Layout>
            <Layout.Header metaTitle="Leads" breadcrumbs={[{ label: "Leads" }]} />

            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar className="flex-wrap">
                    <h1 className="shrink-0 text-xl font-bold tracking-tight text-foreground">
                        Leads
                    </h1>

                    <FilterInput
                        value={search}
                        onChange={handleSearchChange}
                        placeholder="Search name, phone, code..."
                        className="w-56"
                    />

                    <FilterMenu
                        sections={filterSections}
                        value={appliedFilters}
                        onApply={handleFiltersApply}
                    />

                    <Button type="button" className="ml-auto shrink-0" onClick={openCreate}>
                        <Icon name="add-line" className="text-base" />
                        Add Lead
                    </Button>
                </Layout.Toolbar>

                <ScrollArea className="flex-1">
                    <div className="px-6 py-6">
                        {leads.length === 0 ? (
                            <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-6 text-center">
                                <div className="mb-4 flex size-14 items-center justify-center rounded-md bg-primary/10 text-primary">
                                    <Icon name="customer-service-line" className="text-2xl" />
                                </div>
                                <h2 className="text-lg font-semibold tracking-tight">
                                    {hasFilters
                                        ? "No leads match your filters"
                                        : "Add your first lead"}
                                </h2>
                                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                                    {hasFilters
                                        ? "Try another project, stage, or search term."
                                        : "Track inquiries against projects and units, then move them through stages."}
                                </p>
                                {!hasFilters ? (
                                    <Button type="button" className="mt-5" onClick={openCreate}>
                                        <Icon name="add-line" className="text-base" />
                                        Create lead
                                    </Button>
                                ) : null}
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-lg border border-border bg-card">
                                <table className="w-full table-fixed text-left text-sm">
                                    <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                                        <tr>
                                            <th className="w-44 px-4 py-3 font-medium">Lead</th>
                                            <th className="w-40 px-4 py-3 font-medium">Contact</th>
                                            <th className="w-40 px-4 py-3 font-medium">Project</th>
                                            <th className="w-32 px-4 py-3 font-medium">Stage</th>
                                            <th className="w-28 px-4 py-3 font-medium">Heat</th>
                                            <th className="w-36 px-4 py-3 font-medium">Assignee</th>
                                            <th className="w-28 px-4 py-3 font-medium">Budget</th>
                                            <th className="w-16 px-4 py-3 text-right font-medium" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leads.map((lead) => (
                                            <LeadRow
                                                key={lead.id}
                                                lead={lead}
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

            <LeadForm
                isOpen={leadFormOpen}
                onClose={() => {
                    setLeadFormOpen(false);
                    setEditingLead(null);
                }}
                data={editingLead}
                projects={formOptions.projects || []}
                units={formOptions.units || []}
                stages={formOptions.stages || []}
                assignees={formOptions.assignees || []}
                sources={formOptions.sources || []}
            />
        </Layout>
    );
}

Leads.layout = (page) => <PortalLayout children={page} />;

export default Leads;

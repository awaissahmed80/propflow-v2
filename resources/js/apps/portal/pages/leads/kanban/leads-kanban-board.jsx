import { useCallback, useEffect, useMemo, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { update } from "@/actions/App/Http/Controllers/Portal/LeadController";
import { KanbanColumn } from "./kanban-column";

/**
 * @param {object[]} board
 * @param {number} leadId
 * @param {number} stageId
 * @param {object | undefined} stageMeta
 */
function moveLeadOnBoard(board, leadId, stageId, stageMeta) {
    let moving = null;

    const withoutLead = board.map((column) => {
        const nextLeads = column.leads.filter((lead) => {
            if (Number(lead.id) !== Number(leadId)) {
                return true;
            }

            moving = lead;

            return false;
        });

        if (nextLeads.length === column.leads.length) {
            return column;
        }

        const removedBudget = Number(moving?.budget || 0);
        const nextCount = Math.max(0, Number(column.count || 0) - 1);

        return {
            ...column,
            leads: nextLeads,
            count: nextCount,
            budget_sum: Math.max(0, Number(column.budget_sum || 0) - removedBudget),
            has_more: nextLeads.length < nextCount || Boolean(column.has_more),
        };
    });

    if (!moving) {
        return board;
    }

    return withoutLead.map((column) => {
        if (Number(column.stage.id) !== Number(stageId)) {
            return column;
        }

        const nextLead = {
            ...moving,
            lead_stage_id: stageId,
            stage: stageMeta || {
                ...column.stage,
                id: stageId,
            },
        };
        const nextLeads = [nextLead, ...column.leads];
        const nextCount = Number(column.count || 0) + 1;

        return {
            ...column,
            leads: nextLeads,
            count: nextCount,
            budget_sum: Number(column.budget_sum || 0) + Number(nextLead.budget || 0),
            has_more: nextLeads.length < nextCount || Boolean(column.has_more),
        };
    });
}

/**
 * @param {Record<string, unknown>} filters
 * @returns {Record<string, string>}
 */
function toBoardFilterParams(filters = {}) {
    const params = {};

    if (filters.q) {
        params.q = String(filters.q);
    }

    ["project", "tag", "assigned_to", "next_action"].forEach((key) => {
        const value = filters[key];
        if (Array.isArray(value) && value.length > 0) {
            params[key] = value.join(",");
        } else if (typeof value === "string" && value.trim() !== "") {
            params[key] = value;
        }
    });

    return params;
}

/**
 * @param {{
 *   board: object[],
 *   filters?: Record<string, unknown>,
 *   selectedLeadId?: number | null,
 *   onOpenLead: (lead: object) => void,
 * }} props
 */
export function LeadsKanbanBoard({
    board,
    filters = {},
    selectedLeadId = null,
    onOpenLead,
    doNothingTitle = "Do Nothing",
}) {
    const [columns, setColumns] = useState(board);
    const filterParams = useMemo(() => toBoardFilterParams(filters), [filters]);

    useEffect(() => {
        setColumns(board);
    }, [board]);

    const handleDropLead = useCallback(
        (leadId, stageId) => {
            const sourceColumn = columns.find((column) =>
                column.leads.some((lead) => Number(lead.id) === Number(leadId)),
            );
            const targetColumn = columns.find(
                (column) => Number(column.stage.id) === Number(stageId),
            );

            if (!sourceColumn || !targetColumn) {
                return;
            }

            if (Number(sourceColumn.stage.id) === Number(stageId)) {
                return;
            }

            const lead = sourceColumn.leads.find((item) => Number(item.id) === Number(leadId));

            if (!lead?.code || lead.deal_locked || lead.active_order) {
                return;
            }

            const previous = columns;
            const next = moveLeadOnBoard(columns, leadId, stageId, targetColumn.stage);

            setColumns(next);

            router.patch(
                update.url(lead.code),
                { lead_stage_id: stageId },
                {
                    preserveScroll: true,
                    onError: () => {
                        setColumns(previous);
                        toast.error("Could not move lead");
                    },
                },
            );
        },
        [columns],
    );

    const handleColumnPage = useCallback((stageId, page) => {
        setColumns((current) =>
            current.map((column) => {
                if (Number(column.stage.id) !== Number(stageId)) {
                    return column;
                }

                const existingIds = new Set(column.leads.map((lead) => Number(lead.id)));
                const incoming = (page.leads || []).filter(
                    (lead) => !existingIds.has(Number(lead.id)),
                );
                const nextLeads = [...column.leads, ...incoming];

                return {
                    ...column,
                    leads: nextLeads,
                    next_cursor: page.next_cursor ?? null,
                    has_more: Boolean(page.has_more),
                };
            }),
        );
    }, []);

    if (!columns.length) {
        return (
            <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-6 text-center">
                <p className="text-sm text-muted-foreground">
                    No pipeline stages yet. Add stages to start using the board.
                </p>
            </div>
        );
    }

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="scrollbar-kanban flex h-full min-h-0 gap-5 overflow-x-scroll overflow-y-hidden px-6 py-6">
                {columns.map((column) => (
                    <KanbanColumn
                        key={column.stage.id}
                        column={column}
                        selectedLeadId={selectedLeadId}
                        filterParams={filterParams}
                        doNothingTitle={doNothingTitle}
                        onOpenLead={onOpenLead}
                        onDropLead={handleDropLead}
                        onColumnPage={handleColumnPage}
                    />
                ))}
            </div>
        </DndProvider>
    );
}

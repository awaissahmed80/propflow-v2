import { useCallback, useEffect, useRef, useState } from "react";
import { useDrop } from "react-dnd";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCurrency } from "@/hooks/use-currency";
import { leadApi } from "@/portal/store/api";
import { cn } from "@/lib/utils";
import { KanbanLeadCard } from "./kanban-lead-card";
import { LEAD_DND_TYPE } from "./utils";

const CARD_ESTIMATE = 208;
const CARD_GAP = 10;

/**
 * @param {{
 *   column: {
 *     stage: { id: number, label?: string, title: string, color?: string | null },
 *     count: number,
 *     budget_sum: number,
 *     leads: object[],
 *     next_cursor?: number | null,
 *     has_more?: boolean,
 *   },
 *   selectedLeadId?: number | null,
 *   filterParams?: Record<string, string>,
 *   onOpenLead: (lead: object) => void,
 *   onDropLead: (leadId: number, stageId: number) => void,
 *   onColumnPage: (stageId: number, page: { leads: object[], next_cursor: number | null, has_more: boolean }) => void,
 * }} props
 */
export function KanbanColumn({
    column,
    selectedLeadId = null,
    filterParams = {},
    doNothingTitle = "Do Nothing",
    onOpenLead,
    onDropLead,
    onColumnPage,
}) {
    const { formatMoney } = useCurrency();
    const stageId = Number(column.stage.id);
    const color = column.stage.color || "var(--muted-foreground)";
    const scrollRef = useRef(null);
    const loadingRef = useRef(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [fetchBoardColumn] = leadApi.useLazyBoardColumnQuery();

    const leads = column.leads || [];
    const hasMore = Boolean(column.has_more);
    const nextCursor = column.next_cursor ?? null;

    const [{ isOver, canDrop }, drop] = useDrop(
        () => ({
            accept: LEAD_DND_TYPE,
            canDrop: (item) => Number(item.lead_stage_id) !== stageId,
            drop: (item) => {
                onDropLead(Number(item.id), stageId);
            },
            collect: (monitor) => ({
                isOver: monitor.isOver({ shallow: true }),
                canDrop: monitor.canDrop(),
            }),
        }),
        [stageId, onDropLead],
    );

    const setColumnRef = useCallback(
        (node) => {
            drop(node);
        },
        [drop],
    );

    const rowVirtualizer = useVirtualizer({
        count: hasMore ? leads.length + 1 : leads.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => CARD_ESTIMATE + CARD_GAP,
        overscan: 6,
        getItemKey: (index) =>
            index < leads.length ? `lead-${leads[index].id}` : `loader-${stageId}`,
    });

    const virtualItems = rowVirtualizer.getVirtualItems();

    const loadMore = useCallback(async () => {
        if (!hasMore || nextCursor == null || loadingRef.current) {
            return;
        }

        loadingRef.current = true;
        setLoadingMore(true);

        try {
            const page = await fetchBoardColumn({
                stageId: column.stage.label,
                cursor: nextCursor == null ? undefined : String(nextCursor),
                ...filterParams,
            }).unwrap();

            onColumnPage(stageId, page);
        } catch {
            // Keep has_more so the user can retry by scrolling again.
        } finally {
            loadingRef.current = false;
            setLoadingMore(false);
        }
    }, [fetchBoardColumn, filterParams, hasMore, nextCursor, onColumnPage, stageId]);

    useEffect(() => {
        const lastItem = virtualItems[virtualItems.length - 1];

        if (!lastItem) {
            return;
        }

        if (lastItem.index >= leads.length - 1 && hasMore && !loadingRef.current) {
            loadMore();
        }
    }, [hasMore, leads.length, loadMore, virtualItems]);

    return (
        <section
            ref={setColumnRef}
            className={cn(
                "flex h-full w-[20rem] shrink-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-muted/30",
                isOver && canDrop && "border-primary/40 bg-primary/5",
                isOver && !canDrop && "opacity-80",
            )}
        >
            <header className="shrink-0 space-y-1 border-b border-border/60 px-3 py-3">
                <div className="flex items-center gap-2">
                    <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                        aria-hidden
                    />
                    <h2 className="min-w-0 flex-1 truncate text-base font-bold tracking-tight text-foreground">
                        {column.stage.title}
                    </h2>
                    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-background px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border">
                        {column.count}
                    </span>
                </div>
                <p className="pl-[1.125rem] text-xs text-muted-foreground">
                    {formatMoney(column.budget_sum)} total
                </p>
            </header>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 py-2.5">
                {leads.length === 0 && !hasMore ? (
                    <div
                        className={cn(
                            "rounded-lg border border-dashed border-border/80 px-3 py-8 text-center text-xs text-muted-foreground",
                            isOver && canDrop && "border-primary/50 text-primary",
                        )}
                    >
                        Drop leads here
                    </div>
                ) : (
                    <div
                        className="relative w-full"
                        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
                    >
                        {virtualItems.map((virtualRow) => {
                            const isLoader = virtualRow.index >= leads.length;
                            const lead = isLoader ? null : leads[virtualRow.index];

                            return (
                                <div
                                    key={virtualRow.key}
                                    data-index={virtualRow.index}
                                    ref={rowVirtualizer.measureElement}
                                    className="absolute top-0 left-0 w-full"
                                    style={{
                                        transform: `translateY(${virtualRow.start}px)`,
                                        paddingBottom: `${CARD_GAP}px`,
                                    }}
                                >
                                    {isLoader ? (
                                        <div className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
                                            {loadingMore ? "Loading…" : "Scroll for more"}
                                        </div>
                                    ) : (
                                        <KanbanLeadCard
                                            lead={lead}
                                            selected={selectedLeadId === lead.id}
                                            doNothingTitle={doNothingTitle}
                                            onOpen={onOpenLead}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}

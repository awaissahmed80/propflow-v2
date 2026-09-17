import { useDrag } from "react-dnd";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { useCurrency } from "@/hooks/use-currency";
import { formatRelativeTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { LEAD_DND_TYPE, sourceBadge } from "./utils";

/**
 * @param {{
 *   lead: object,
 *   selected?: boolean,
 *   onOpen: (lead: object) => void,
 * }} props
 */
export function KanbanLeadCard({ lead, selected = false, onOpen }) {
    const { formatMoney } = useCurrency();
    const [{ isDragging }, drag] = useDrag(
        () => ({
            type: LEAD_DND_TYPE,
            item: {
                id: lead.id,
                lead_stage_id: lead.lead_stage_id,
            },
            collect: (monitor) => ({
                isDragging: monitor.isDragging(),
            }),
        }),
        [lead.id, lead.lead_stage_id],
    );

    const name = lead.contact?.display_name || "Untitled lead";
    const source = sourceBadge(lead.source);
    const dueSoon = Boolean(lead.due_date) && lead.next_action && lead.next_action !== "Do Nothing";
    const relative = formatRelativeTime(lead.last_activity_at || lead.updated_at || lead.created_at);

    return (
        <article
            ref={drag}
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
                "group cursor-grab rounded-lg border border-border bg-card p-3 shadow-xs transition-[opacity,box-shadow,border-color] active:cursor-grabbing",
                selected && "border-primary/40 ring-2 ring-primary/15",
                isDragging && "opacity-40",
                !isDragging && "hover:border-border/80 hover:shadow-sm",
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                    {name}
                </h3>
                {source ? (
                    <span
                        className={cn(
                            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            source.className,
                        )}
                    >
                        {source.label}
                    </span>
                ) : null}
            </div>

            <div className="mt-2.5 flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground">
                    {formatMoney(lead.budget)}
                </span>
                {dueSoon ? (
                    <span className="size-1.5 rounded-full bg-destructive" aria-hidden />
                ) : null}
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0 text-xs text-muted-foreground">
                    {dueSoon ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                            <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
                            Task due
                        </span>
                    ) : (
                        <span className="truncate">{relative || "—"}</span>
                    )}
                </div>
                {lead.assignee ? (
                    <Avatar
                        name={lead.assignee.display_name}
                        src={lead.assignee.avatar || undefined}
                        size="sm"
                        className="size-6 shrink-0"
                        textClass="text-[8px]"
                    />
                ) : (
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Icon name="user-line" className="text-xs" />
                    </span>
                )}
            </div>
        </article>
    );
}

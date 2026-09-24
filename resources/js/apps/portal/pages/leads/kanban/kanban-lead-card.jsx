import { useDrag } from "react-dnd";
import { LeadCard } from "../../../components/lead-card";
import { cn } from "@/lib/utils";
import { LEAD_DND_TYPE } from "./utils";

/**
 * @param {{
 *   lead: object,
 *   selected?: boolean,
 *   onOpen: (lead: object) => void,
 *   doNothingTitle?: string,
 * }} props
 */
export function KanbanLeadCard({ lead, selected = false, onOpen, doNothingTitle = "Do Nothing" }) {
    const locked = Boolean(lead?.deal_locked || lead?.active_order);
    const [{ isDragging }, drag] = useDrag(
        () => ({
            type: LEAD_DND_TYPE,
            item: {
                id: lead.id,
                lead_stage_id: lead.lead_stage_id,
            },
            canDrag: !locked,
            collect: (monitor) => ({
                isDragging: monitor.isDragging(),
            }),
        }),
        [lead.id, lead.lead_stage_id, locked],
    );

    return (
        <div
            ref={drag}
            className={cn(
                "cursor-grab active:cursor-grabbing",
                isDragging && "opacity-40",
            )}
        >
            <LeadCard
                lead={lead}
                selected={selected}
                doNothingTitle={doNothingTitle}
                onClick={onOpen}
                className={cn(!isDragging && "hover:border-border/80")}
            />
        </div>
    );
}

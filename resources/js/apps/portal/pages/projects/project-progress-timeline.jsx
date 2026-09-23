import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { phaseDateRange, phaseStatusTone } from "./project-details-helpers";

const PHASE_STATUS_LABELS = {
    planned: "Planned",
    in_progress: "In progress",
    completed: "Completed",
    delayed: "Delayed",
};

export function ProgressTimeline({ phases, onEdit }) {
    if (phases.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                No milestones yet. Add the first update to build the timeline.
            </p>
        );
    }

    return (
        <ol className="relative space-y-0 border-l border-border ml-2">
            {phases.map((phase, index) => {
                const dateRange = phaseDateRange(phase);
                const isLast = index === phases.length - 1;
                const statusLabel =
                    PHASE_STATUS_LABELS[phase.status] || phase.status || "Planned";

                return (
                    <li
                        key={phase.id}
                        className={cn("relative pl-5", !isLast && "pb-5")}
                    >
                        <span
                            className={cn(
                                "absolute top-1.5 -left-[5px] size-2.5 rounded-full ring-2 ring-background",
                                phase.status === "completed"
                                    ? "bg-emerald-500"
                                    : phase.status === "in_progress"
                                      ? "bg-sky-500"
                                      : phase.status === "delayed"
                                        ? "bg-amber-500"
                                        : "bg-muted-foreground/50"
                            )}
                        />
                        <button
                            type="button"
                            className="group w-full rounded-md text-left transition-colors hover:bg-muted/40 -mx-1 px-1 py-0.5"
                            onClick={() => onEdit(phase)}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-foreground">
                                        {phase.title}
                                    </div>
                                    {dateRange ? (
                                        <div className="mt-0.5 text-xs text-muted-foreground">
                                            {dateRange}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                    <Badge
                                        variant="secondary"
                                        className={cn(
                                            "rounded-md px-1.5 py-0 text-[11px] font-medium",
                                            phaseStatusTone(phase.status)
                                        )}
                                    >
                                        {statusLabel}
                                    </Badge>
                                    <span className="text-xs tabular-nums text-muted-foreground">
                                        {phase.progress ?? 0}%
                                    </span>
                                </div>
                            </div>
                            {phase.description ? (
                                <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                                    {phase.description}
                                </p>
                            ) : null}
                        </button>
                    </li>
                );
            })}
        </ol>
    );
}

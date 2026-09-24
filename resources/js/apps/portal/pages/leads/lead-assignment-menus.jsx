import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { update } from "@/actions/App/Http/Controllers/Portal/LeadController";
import { Avatar } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { HEAT_OPTIONS, heatMeta } from "@/lib/heat";
import { cn } from "@/lib/utils";
import { closeOutcomeFromStageLabel } from "./lead-close-helpers";

export function patchLead(lead, payload, successMessage = "Lead updated") {
    if (lead?.deal_locked) {
        toast.error("This lead is locked while its booking is active");
        return;
    }

    router.patch(update.url(lead.code), payload, {
        preserveScroll: true,
        onSuccess: () => toast.success(successMessage),
        onError: () => toast.error("Could not update lead"),
    });
}

/**
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.displayValue
 * @param {boolean} [props.disabled]
 * @param {import("react").ReactNode} [props.leading]
 * @param {string} [props.className]
 */
function HeaderValueTrigger({
    label,
    displayValue,
    disabled = false,
    leading = null,
    className,
    ...rest
}) {
    const empty = !displayValue || displayValue === "—";

    return (
        <button
            type="button"
            disabled={disabled}
            aria-label={`Edit ${label}`}
            title={`Click to edit ${label}`}
            className={cn(
                "-mx-1 inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-sm transition-colors",
                "hover:bg-muted/60",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                "disabled:cursor-default disabled:hover:bg-transparent",
                "data-popup-open:bg-muted/60",
                empty ? "text-muted-foreground" : "text-foreground",
                className
            )}
            {...rest}
        >
            {leading}
            <span className="whitespace-nowrap">{displayValue || "—"}</span>
        </button>
    );
}

/**
 * @param {object} props
 * @param {string} props.label
 * @param {import("react").ReactNode} props.children
 */
function HeaderField({ label, children }) {
    return (
        <div className="w-auto shrink-0 space-y-0.5">
            <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                {label}
            </div>
            {children}
        </div>
    );
}

/**
 * @param {object} props
 * @param {object} props.lead
 * @param {Array} props.stages
 * @param {boolean} [props.locked]
 * @param {(outcome: "won" | "lost") => void} [props.onCloseDealRequest]
 */
export function StageMenu({ lead, stages, locked = false, onCloseDealRequest }) {
    const color = lead.stage?.color || "var(--muted-foreground)";

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <button
                        type="button"
                        disabled={locked}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                        style={{
                            backgroundColor: `${color}22`,
                            borderColor: `${color}55`,
                            color,
                        }}
                    >
                        {lead.stage?.title || "Stage"}
                        <Icon name="arrow-down-s-line" className="text-sm" />
                    </button>
                }
            />
            <DropdownMenuContent align="end" className="min-w-40">
                {stages.map((stage) => {
                    const selected =
                        Number(lead.lead_stage_id) === Number(stage.id);
                    const stageColor = stage.color || "var(--muted-foreground)";
                    const closeOutcome = closeOutcomeFromStageLabel(stage.label);

                    return (
                        <DropdownMenuItem
                            key={stage.id}
                            disabled={selected || locked}
                            onClick={() => {
                                if (closeOutcome) {
                                    onCloseDealRequest?.(closeOutcome);

                                    return;
                                }

                                patchLead(lead, {
                                    lead_stage_id: Number(stage.id),
                                });
                            }}
                        >
                            <span
                                className="size-1.5 shrink-0 rounded-sm"
                                style={{ backgroundColor: stageColor }}
                                aria-hidden
                            />
                            {stage.title}
                            {selected ? (
                                <Icon
                                    name="check-line"
                                    className="ml-auto text-sm"
                                />
                            ) : null}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function HeatMenu({ lead, locked = false }) {
    const meta = heatMeta(lead?.tag);
    const current = lead?.tag || null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <button
                        type="button"
                        disabled={locked}
                        aria-label={meta ? `Heat: ${meta.label}` : "Set heat"}
                        title={meta ? meta.label : "Set heat"}
                        className={cn(
                            "inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-transparent transition-colors",
                            "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                            "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent",
                            meta ? meta.className : "text-muted-foreground"
                        )}
                    >
                        <Icon
                            name={meta?.icon || "temp-hot-line"}
                            className="text-base leading-none"
                        />
                    </button>
                }
            />
            <DropdownMenuContent align="start" className="min-w-40">
                {HEAT_OPTIONS.map((option) => {
                    const optionMeta = heatMeta(option.value);
                    const selected = current === option.value;

                    return (
                        <DropdownMenuItem
                            key={option.value}
                            disabled={selected || locked}
                            onClick={() =>
                                patchLead(
                                    lead,
                                    { tag: option.value },
                                    "Heat updated"
                                )
                            }
                        >
                            <span
                                className={cn(
                                    "inline-flex shrink-0 items-center justify-center",
                                    optionMeta?.className
                                )}
                            >
                                <Icon
                                    name={optionMeta?.icon || "temp-hot-line"}
                                    className="text-base leading-none"
                                />
                            </span>
                            {option.label}
                            {selected ? (
                                <Icon name="check-line" className="ml-auto text-sm" />
                            ) : null}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function AssigneeMenu({ lead, assignees, locked = false }) {
    const hasAssignees = assignees.length > 0;
    const selected =
        assignees.find((user) => Number(user.id) === Number(lead?.assigned_to)) ||
        lead?.assignee ||
        null;
    const displayValue = selected?.display_name || "—";
    const currentId = lead?.assigned_to ?? null;

    if (!hasAssignees) {
        return (
            <HeaderField label="Assigned to">
                <span className="text-sm text-muted-foreground">No assignees added</span>
            </HeaderField>
        );
    }

    return (
        <HeaderField label="Assigned to">
            <DropdownMenu>
                <DropdownMenuTrigger
                    disabled={locked}
                    render={
                        <HeaderValueTrigger
                            label="assignee"
                            displayValue={displayValue}
                            disabled={locked}
                            leading={
                                selected ? (
                                    <Avatar
                                        name={selected.display_name}
                                        src={selected.avatar || undefined}
                                        size="sm"
                                        className="size-5 shrink-0"
                                        textClass="text-[8px]"
                                    />
                                ) : (
                                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                        <Icon name="user-line" className="text-xs" />
                                    </span>
                                )
                            }
                        />
                    }
                />
                <DropdownMenuContent align="start" className="min-w-48">
                    {assignees.map((user) => {
                        const selectedItem =
                            Number(user.id) === Number(currentId);

                        return (
                            <DropdownMenuItem
                                key={user.id}
                                disabled={selectedItem || locked}
                                onClick={() => {
                                    if (selectedItem) {
                                        return;
                                    }

                                    patchLead(
                                        lead,
                                        { assigned_to: Number(user.id) },
                                        "Assignee updated"
                                    );
                                }}
                            >
                                <Avatar
                                    name={user.display_name}
                                    src={user.avatar || undefined}
                                    size="sm"
                                    className="size-5 shrink-0"
                                    textClass="text-[8px]"
                                />
                                {user.display_name}
                                {selectedItem ? (
                                    <Icon
                                        name="check-line"
                                        className="ml-auto text-sm"
                                    />
                                ) : null}
                            </DropdownMenuItem>
                        );
                    })}
                    {currentId != null ? (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                disabled={locked}
                                onClick={() =>
                                    patchLead(
                                        lead,
                                        { assigned_to: null },
                                        "Assignee cleared"
                                    )
                                }
                            >
                                <Icon
                                    name="user-unfollow-line"
                                    className="text-base text-muted-foreground"
                                />
                                Unassigned
                            </DropdownMenuItem>
                        </>
                    ) : null}
                </DropdownMenuContent>
            </DropdownMenu>
        </HeaderField>
    );
}

export function ProjectMenu({ lead, projects, locked = false }) {
    const hasProjects = projects.length > 0;
    const selected =
        projects.find((project) => Number(project.id) === Number(lead?.project_id)) ||
        lead?.project ||
        null;
    const displayValue = selected?.title || "—";
    const currentId = lead?.project_id ?? null;

    if (!hasProjects) {
        return (
            <HeaderField label="Project">
                <span className="text-sm text-muted-foreground">No projects added</span>
            </HeaderField>
        );
    }

    return (
        <HeaderField label="Project">
            <DropdownMenu>
                <DropdownMenuTrigger
                    disabled={locked}
                    render={
                        <HeaderValueTrigger
                            label="project"
                            displayValue={displayValue}
                            disabled={locked}
                            leading={
                                selected?.thumbnail ? (
                                    <img
                                        src={selected.thumbnail}
                                        alt=""
                                        className="size-5 shrink-0 rounded object-cover"
                                    />
                                ) : (
                                    <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                                        <Icon
                                            name="community-line"
                                            className="text-xs"
                                        />
                                    </span>
                                )
                            }
                        />
                    }
                />
                <DropdownMenuContent align="start" className="min-w-48">
                    {projects.map((project) => {
                        const selectedItem =
                            Number(project.id) === Number(currentId);

                        return (
                            <DropdownMenuItem
                                key={project.id}
                                disabled={selectedItem || locked}
                                onClick={() => {
                                    if (selectedItem) {
                                        return;
                                    }

                                    patchLead(
                                        lead,
                                        { project_id: Number(project.id) },
                                        "Project updated"
                                    );
                                }}
                            >
                                {project.thumbnail ? (
                                    <img
                                        src={project.thumbnail}
                                        alt=""
                                        className="size-5 shrink-0 rounded object-cover"
                                    />
                                ) : (
                                    <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                                        <Icon
                                            name="community-line"
                                            className="text-xs"
                                        />
                                    </span>
                                )}
                                {project.title}
                                {selectedItem ? (
                                    <Icon
                                        name="check-line"
                                        className="ml-auto text-sm"
                                    />
                                ) : null}
                            </DropdownMenuItem>
                        );
                    })}
                    {currentId != null ? (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                disabled={locked}
                                onClick={() =>
                                    patchLead(
                                        lead,
                                        { project_id: null },
                                        "Project cleared"
                                    )
                                }
                            >
                                <Icon
                                    name="close-circle-line"
                                    className="text-base text-muted-foreground"
                                />
                                No project
                            </DropdownMenuItem>
                        </>
                    ) : null}
                </DropdownMenuContent>
            </DropdownMenu>
        </HeaderField>
    );
}

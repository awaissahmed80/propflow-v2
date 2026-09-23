import { useEffect, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { update } from "@/actions/App/Http/Controllers/Portal/LeadController";
import { Avatar } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { SelectBox } from "@/components/ui/select";
import { HEAT_OPTIONS, heatMeta } from "@/lib/heat";
import { cn } from "@/lib/utils";

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
 * @param {() => void} props.onEdit
 * @param {import("react").ReactNode} [props.leading]
 * @param {string} [props.className]
 */
function EditableValueButton({
    label,
    displayValue,
    disabled = false,
    onEdit,
    leading = null,
    className,
}) {
    const empty = !displayValue || displayValue === "—";

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onEdit}
            aria-label={`Edit ${label}`}
            title={`Click to edit ${label}`}
            className={cn(
                "-mx-1.5 inline-flex min-w-0 max-w-full items-center gap-2 rounded-md px-1.5 py-0.5 text-left text-sm transition-colors",
                "border border-transparent border-b-border/70 border-b-dashed",
                "hover:bg-muted/60 hover:border-b-primary/40",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                "disabled:cursor-default disabled:border-transparent disabled:hover:bg-transparent disabled:hover:border-transparent",
                empty ? "text-muted-foreground" : "text-foreground",
                className
            )}
        >
            {leading}
            <span className="truncate">{displayValue || "—"}</span>
        </button>
    );
}

export function StageMenu({ lead, stages, locked = false }) {
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
                    const selected = Number(lead.lead_stage_id) === Number(stage.id);
                    const stageColor = stage.color || "var(--muted-foreground)";

                    return (
                        <DropdownMenuItem
                            key={stage.id}
                            disabled={selected || locked}
                            onClick={() =>
                                patchLead(lead, { lead_stage_id: Number(stage.id) })
                            }
                        >
                            <span
                                className="size-1.5 shrink-0 rounded-sm"
                                style={{ backgroundColor: stageColor }}
                                aria-hidden
                            />
                            {stage.title}
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

/**
 * @param {object} props
 * @param {string} props.label
 * @param {import("react").ReactNode} props.children
 */
function HeaderField({ label, children }) {
    return (
        <div className="min-w-0 flex-1 space-y-1">
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
            </div>
            {children}
        </div>
    );
}

export function AssigneeMenu({ lead, assignees, locked = false }) {
    const [editing, setEditing] = useState(false);
    const wrapRef = useRef(null);
    const hasAssignees = assignees.length > 0;

    const options = assignees.map((user) => ({
        value: String(user.id),
        label: user.display_name,
        avatar: {
            name: user.display_name,
            src: user.avatar || undefined,
        },
    }));

    const selected =
        assignees.find((user) => Number(user.id) === Number(lead?.assigned_to)) ||
        lead?.assignee ||
        null;
    const displayValue = selected?.display_name || "—";

    useEffect(() => {
        if (!editing || !hasAssignees) {
            return undefined;
        }

        const frame = requestAnimationFrame(() => {
            const trigger = wrapRef.current?.querySelector(
                '[data-slot="select-trigger"]'
            );

            if (trigger instanceof HTMLElement) {
                trigger.click();
            }
        });

        const onPointerDown = (event) => {
            const target = event.target;

            if (
                wrapRef.current?.contains(target) ||
                (target instanceof Element &&
                    target.closest('[data-slot="select-content"]'))
            ) {
                return;
            }

            setEditing(false);
        };

        document.addEventListener("pointerdown", onPointerDown);

        return () => {
            cancelAnimationFrame(frame);
            document.removeEventListener("pointerdown", onPointerDown);
        };
    }, [editing, hasAssignees]);

    if (!hasAssignees) {
        return (
            <HeaderField label="Assigned to">
                <span className="text-sm text-muted-foreground">No assignees added</span>
            </HeaderField>
        );
    }

    return (
        <HeaderField label="Assigned to">
            {editing && !locked ? (
                <div ref={wrapRef}>
                    <SelectBox
                        className="min-w-0 w-full"
                        value={lead?.assigned_to ? String(lead.assigned_to) : ""}
                        options={options}
                        placeholder="Assign to…"
                        clearable
                        onValueChange={(value) => {
                            const next = value ? Number(value) : null;

                            if ((lead?.assigned_to ?? null) !== next) {
                                patchLead(
                                    lead,
                                    { assigned_to: next },
                                    next ? "Assignee updated" : "Assignee cleared"
                                );
                            }

                            setEditing(false);
                        }}
                    />
                </div>
            ) : (
                <EditableValueButton
                    label="assignee"
                    displayValue={displayValue}
                    disabled={locked}
                    onEdit={() => setEditing(true)}
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
            )}
        </HeaderField>
    );
}

export function ProjectMenu({ lead, projects, locked = false }) {
    const [editing, setEditing] = useState(false);
    const wrapRef = useRef(null);
    const hasProjects = projects.length > 0;

    const options = projects.map((project) => ({
        value: String(project.id),
        label: project.title,
        image: project.thumbnail || undefined,
        icon: project.thumbnail ? undefined : "community-line",
    }));

    const selected =
        projects.find((project) => Number(project.id) === Number(lead?.project_id)) ||
        lead?.project ||
        null;
    const displayValue = selected?.title || "—";

    useEffect(() => {
        if (!editing || !hasProjects) {
            return undefined;
        }

        const frame = requestAnimationFrame(() => {
            const trigger = wrapRef.current?.querySelector(
                '[data-slot="select-trigger"]'
            );

            if (trigger instanceof HTMLElement) {
                trigger.click();
            }
        });

        const onPointerDown = (event) => {
            const target = event.target;

            if (
                wrapRef.current?.contains(target) ||
                (target instanceof Element &&
                    target.closest('[data-slot="select-content"]'))
            ) {
                return;
            }

            setEditing(false);
        };

        document.addEventListener("pointerdown", onPointerDown);

        return () => {
            cancelAnimationFrame(frame);
            document.removeEventListener("pointerdown", onPointerDown);
        };
    }, [editing, hasProjects]);

    if (!hasProjects) {
        return (
            <HeaderField label="Project">
                <span className="text-sm text-muted-foreground">No projects added</span>
            </HeaderField>
        );
    }

    return (
        <HeaderField label="Project">
            {editing && !locked ? (
                <div ref={wrapRef}>
                    <SelectBox
                        className="min-w-0 w-full"
                        value={lead?.project_id ? String(lead.project_id) : ""}
                        options={options}
                        placeholder="Select project…"
                        clearable
                        onValueChange={(value) => {
                            const next = value ? Number(value) : null;

                            if ((lead?.project_id ?? null) !== next) {
                                patchLead(
                                    lead,
                                    { project_id: next },
                                    next ? "Project updated" : "Project cleared"
                                );
                            }

                            setEditing(false);
                        }}
                    />
                </div>
            ) : (
                <EditableValueButton
                    label="project"
                    displayValue={displayValue}
                    disabled={locked}
                    onEdit={() => setEditing(true)}
                    leading={
                        selected?.thumbnail ? (
                            <img
                                src={selected.thumbnail}
                                alt=""
                                className="size-5 shrink-0 rounded object-cover"
                            />
                        ) : (
                            <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                                <Icon name="community-line" className="text-xs" />
                            </span>
                        )
                    }
                />
            )}
        </HeaderField>
    );
}

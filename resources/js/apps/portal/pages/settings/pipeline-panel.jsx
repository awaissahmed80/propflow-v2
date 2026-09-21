import { useCallback, useEffect, useRef, useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { BlockPicker } from "react-color";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import {
    destroy as destroyStage,
    reorder as reorderStages,
    store as storeStage,
    update as updateStage,
} from "@/actions/App/Http/Controllers/Portal/LeadStageController";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import PipelineRulesPanel from "./pipeline-rules-panel";
import { LeadActionTypesSection } from "./lead-action-types-section";

function pathFrom(url) {
    const raw = String(url || "/");

    if (raw.startsWith("//") || raw.startsWith("http://") || raw.startsWith("https://")) {
        try {
            const pathname = new URL(raw.startsWith("//") ? `https:${raw}` : raw).pathname;

            return pathname === "" ? "/" : pathname;
        } catch {
            return "/";
        }
    }

    return raw.startsWith("/") ? raw : `/${raw}`;
}

const DEFAULT_COLOR = "#64B5F6";
const STAGE_DND_TYPE = "SETTINGS_PIPELINE_STAGE";

const STAGE_COLORS = [
    "#64B5F6",
    "#81C784",
    "#FFB74D",
    "#9575CD",
    "#E57373",
    "#4DB6AC",
    "#FF8A65",
    "#7986CB",
    "#F06292",
    "#90A4AE",
];

function formatLeadCount(count) {
    const n = Number(count) || 0;

    return `${n} ${n === 1 ? "lead" : "leads"}`;
}

function StageColorSwatch({ value, onChange, disabled = false }) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                disabled={disabled}
                aria-label="Change stage color"
                className={cn(
                    "size-3 shrink-0 rounded-full ring-2 ring-background transition-transform hover:scale-110",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    disabled && "pointer-events-none opacity-50"
                )}
                style={{ backgroundColor: value || DEFAULT_COLOR }}
            />
            <PopoverContent align="start" className="w-auto gap-0 overflow-hidden p-0">
                <BlockPicker
                    color={value || DEFAULT_COLOR}
                    colors={STAGE_COLORS}
                    triangle="hide"
                    width="220px"
                    onChange={(color) => {
                        onChange?.(color.hex);
                        setOpen(false);
                    }}
                />
            </PopoverContent>
        </Popover>
    );
}

function SortableStageCard({
    stage,
    index,
    moveStage,
    processing,
    onUpdate,
    onDuplicate,
    onRemove,
    onToggleEnabled,
    onDragEnd,
}) {
    const ref = useRef(null);
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(stage.title);
    const enabled = stage.is_enabled !== false;

    useEffect(() => {
        if (!editing) {
            setTitle(stage.title);
        }
    }, [stage.title, editing]);

    const [{ isDragging }, drag, preview] = useDrag(
        () => ({
            type: STAGE_DND_TYPE,
            item: () => ({ id: stage.id, index }),
            canDrag: !editing && !processing,
            end: () => onDragEnd?.(),
            collect: (monitor) => ({
                isDragging: monitor.isDragging(),
            }),
        }),
        [stage.id, index, editing, processing, onDragEnd]
    );

    const [, drop] = useDrop(
        () => ({
            accept: STAGE_DND_TYPE,
            hover(item, monitor) {
                if (!ref.current) {
                    return;
                }

                const dragIndex = item.index;
                const hoverIndex = index;

                if (dragIndex === hoverIndex) {
                    return;
                }

                const hoverBoundingRect = ref.current.getBoundingClientRect();
                const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
                const clientOffset = monitor.getClientOffset();

                if (!clientOffset) {
                    return;
                }

                const hoverClientY = clientOffset.y - hoverBoundingRect.top;

                if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
                    return;
                }

                if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
                    return;
                }

                moveStage(dragIndex, hoverIndex);
                item.index = hoverIndex;
            },
        }),
        [index, moveStage]
    );

    preview(drop(ref));

    const commitTitle = () => {
        const next = title.trim();

        setEditing(false);

        if (!next || next === stage.title) {
            setTitle(stage.title);
            return;
        }

        onUpdate(stage.id, { title: next, color: stage.color });
    };

    return (
        <div
            ref={ref}
            className={cn(
                "flex items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-3 shadow-xs transition-shadow",
                isDragging && "opacity-40 shadow-none",
                !isDragging && "hover:border-border hover:shadow-sm",
                !enabled && "opacity-60"
            )}
        >
            <button
                ref={drag}
                type="button"
                aria-label="Drag to reorder"
                disabled={editing || processing}
                className={cn(
                    "inline-flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing",
                    (editing || processing) && "pointer-events-none opacity-40"
                )}
            >
                <Icon name="draggable" className="text-base" />
            </button>

            <StageColorSwatch
                value={stage.color}
                disabled={processing}
                onChange={(color) => onUpdate(stage.id, { title: stage.title, color })}
            />

            <div className="flex min-w-0 flex-1 items-center gap-2.5">
                {editing ? (
                    <input
                        value={title}
                        autoFocus
                        disabled={processing}
                        onChange={(event) => setTitle(event.target.value)}
                        onBlur={commitTitle}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                commitTitle();
                            }
                            if (event.key === "Escape") {
                                setTitle(stage.title);
                                setEditing(false);
                            }
                        }}
                        className="min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 py-1 text-base font-bold tracking-tight text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                    />
                ) : (
                    <button
                        type="button"
                        className="min-w-0 truncate text-left text-base font-bold tracking-tight text-foreground"
                        onClick={() => setEditing(true)}
                    >
                        {stage.title}
                    </button>
                )}

                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatLeadCount(stage.leads_count)}
                </span>
            </div>

            <div className="flex shrink-0 items-center gap-1">
                <IconButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon="file-copy-line"
                    aria-label="Duplicate stage"
                    disabled={processing}
                    onClick={() => onDuplicate(stage)}
                />
                {stage.is_system ? (
                    <Switch
                        checked={enabled}
                        disabled={processing}
                        aria-label={`${enabled ? "Disable" : "Enable"} ${stage.title}`}
                        onCheckedChange={(next) => onToggleEnabled(stage, Boolean(next))}
                    />
                ) : (
                    <IconButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        icon="delete-bin-line"
                        aria-label="Delete stage"
                        disabled={processing}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => onRemove(stage)}
                    />
                )}
            </div>
        </div>
    );
}

export default function PipelinePanel({
    stages = [],
    pipelineRules = {},
    activityActionTypes = [],
    nextActionTypes = [],
}) {
    const [items, setItems] = useState(stages);
    const itemsRef = useRef(stages);
    const [adding, setAdding] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newColor, setNewColor] = useState(DEFAULT_COLOR);
    const [processing, setProcessing] = useState(false);
    const dragOrderDirty = useRef(false);
    const addInputRef = useRef(null);

    useEffect(() => {
        setItems(stages);
        itemsRef.current = stages;
        dragOrderDirty.current = false;
    }, [stages]);

    useEffect(() => {
        if (adding) {
            requestAnimationFrame(() => addInputRef.current?.focus());
        }
    }, [adding]);

    const persistOrder = useCallback((nextItems) => {
        setProcessing(true);
        router.put(
            pathFrom(reorderStages.url()),
            { order: nextItems.map((stage) => stage.id) },
            {
                preserveScroll: true,
                optimistic: (props) => ({
                    stages: nextItems.map((stage, index) => ({
                        ...(props.stages?.find((item) => item.id === stage.id) ?? stage),
                        priority: index + 1,
                    })),
                }),
                onSuccess: () => {
                    dragOrderDirty.current = false;
                },
                onError: (errors) => toast.error(errors.order || errors.message || "Unable to reorder"),
                onFinish: () => setProcessing(false),
            }
        );
    }, []);

    const moveStage = useCallback((fromIndex, toIndex) => {
        setItems((prev) => {
            const next = [...prev];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            itemsRef.current = next;
            dragOrderDirty.current = true;

            return next;
        });
    }, []);

    const handleDragEnd = useCallback(() => {
        if (!dragOrderDirty.current) {
            return;
        }

        persistOrder(itemsRef.current);
    }, [persistOrder]);

    const updateStageInline = (id, payload) => {
        if (processing) {
            return;
        }

        setProcessing(true);
        setItems((prev) =>
            prev.map((stage) => (stage.id === id ? { ...stage, ...payload } : stage))
        );

        const stage = items.find((item) => item.id === id);

        router.put(pathFrom(updateStage.url(stage?.label ?? id)), payload, {
            preserveScroll: true,
            optimistic: (props) => ({
                stages: (props.stages ?? []).map((stage) =>
                    stage.id === id ? { ...stage, ...payload } : stage
                ),
            }),
            onError: (errors) =>
                toast.error(errors.title || errors.stage || errors.message || "Unable to update"),
            onFinish: () => setProcessing(false),
        });
    };

    const createStage = (title, color = DEFAULT_COLOR) => {
        const value = title.trim();

        if (!value || processing) {
            return;
        }

        setProcessing(true);
        router.post(
            pathFrom(storeStage.url()),
            { title: value, color },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setNewTitle("");
                    setNewColor(DEFAULT_COLOR);
                    setAdding(false);
                },
                onError: (errors) => toast.error(errors.title || errors.message || "Unable to create"),
                onFinish: () => setProcessing(false),
            }
        );
    };

    const duplicateStage = (stage) => {
        if (processing) {
            return;
        }

        createStage(`${stage.title} copy`, stage.color || DEFAULT_COLOR);
    };

    const removeStage = async (stage) => {
        if (processing || stage.is_system) {
            return;
        }

        const enabledRemaining = items.filter(
            (item) => item.id !== stage.id && item.is_enabled !== false
        ).length;

        if (enabledRemaining < 1) {
            await alert(
                "At least one enabled pipeline stage is required.",
                "Cannot delete stage"
            );
            return;
        }

        const leadCount = Number(stage.leads_count) || 0;
        const leadNote =
            leadCount > 0
                ? ` ${formatLeadCount(leadCount)} in this stage will be moved to the archive.`
                : "";

        const confirmed = await confirm(
            `Delete "${stage.title}"?${leadNote}`,
            "Delete stage"
        );

        if (!confirmed) {
            return;
        }

        setProcessing(true);
        router.delete(pathFrom(destroyStage.url(stage.label)), {
            preserveScroll: true,
            onSuccess: () =>
                toast.success(
                    leadCount > 0
                        ? "Stage deleted — leads moved to archive"
                        : "Stage deleted"
                ),
            onError: (errors) =>
                toast.error(errors.stage || errors.message || "Unable to delete"),
            onFinish: () => setProcessing(false),
        });
    };

    const toggleStageEnabled = (stage, nextEnabled) => {
        if (processing || !stage.is_system) {
            return;
        }

        if (!nextEnabled) {
            const enabledCount = items.filter((item) => item.is_enabled !== false).length;

            if (enabledCount <= 1) {
                toast.error("At least one enabled pipeline stage is required.");
                return;
            }
        }

        setItems((prev) =>
            prev.map((item) =>
                item.id === stage.id ? { ...item, is_enabled: nextEnabled } : item
            )
        );

        updateStageInline(stage.id, {
            title: stage.title,
            color: stage.color,
            is_enabled: nextEnabled,
        });
    };

    return (
        <div className="space-y-8">
                <section className="space-y-4">
                    <div>
                        <h3 className="text-base font-bold tracking-tight text-foreground">
                            Pipe Stages
                        </h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            Lead pipeline — drag to reorder. Default stages can be turned off, not deleted.
                        </p>
                    </div>

                    <DndProvider backend={HTML5Backend}>
                        <div className="space-y-2">
                            {items.length === 0 && !adding ? (
                                <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">
                                    No stages yet. Add your first stage below.
                                </div>
                            ) : (
                                items.map((stage, index) => (
                                    <SortableStageCard
                                        key={stage.id}
                                        stage={stage}
                                        index={index}
                                        moveStage={moveStage}
                                        processing={processing}
                                        onUpdate={updateStageInline}
                                        onDuplicate={duplicateStage}
                                        onRemove={removeStage}
                                        onToggleEnabled={toggleStageEnabled}
                                        onDragEnd={handleDragEnd}
                                    />
                                ))
                            )}

                            {adding ? (
                                <form
                                    className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 px-3 py-3"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        createStage(newTitle, newColor);
                                    }}
                                >
                                    <span className="inline-flex size-7 shrink-0 items-center justify-center text-muted-foreground">
                                        <Icon name="add-line" className="text-base" />
                                    </span>
                                    <StageColorSwatch
                                        value={newColor}
                                        onChange={setNewColor}
                                        disabled={processing}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <Input
                                            ref={addInputRef}
                                            value={newTitle}
                                            onChange={(event) => setNewTitle(event.target.value)}
                                            placeholder="Stage name"
                                            disabled={processing}
                                            onKeyDown={(event) => {
                                                if (event.key === "Escape") {
                                                    setAdding(false);
                                                    setNewTitle("");
                                                    setNewColor(DEFAULT_COLOR);
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                        <IconButton
                                            type="submit"
                                            size="sm"
                                            variant="ghost"
                                            icon="check-line"
                                            aria-label="Create stage"
                                            disabled={processing || !newTitle.trim()}
                                        />
                                        <IconButton
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            icon="close-line"
                                            aria-label="Cancel"
                                            disabled={processing}
                                            onClick={() => {
                                                setAdding(false);
                                                setNewTitle("");
                                                setNewColor(DEFAULT_COLOR);
                                            }}
                                        />
                                    </div>
                                </form>
                            ) : (
                                <button
                                    type="button"
                                    disabled={processing}
                                    onClick={() => setAdding(true)}
                                    className={cn(
                                        "flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-transparent px-3 py-3 text-sm font-medium text-muted-foreground transition-colors",
                                        "hover:border-primary/40 hover:bg-primary/5 hover:text-foreground",
                                        "disabled:pointer-events-none disabled:opacity-50"
                                    )}
                                >
                                    <Icon name="add-line" className="text-base" />
                                    Add Stage
                                </button>
                            )}
                        </div>
                    </DndProvider>
                </section>

                <LeadActionTypesSection
                    kind="activity"
                    propKey="activityActionTypes"
                    title="Lead Actions"
                    description="Activity types used when logging an update on a lead — drag to reorder."
                    items={activityActionTypes}
                />

                <LeadActionTypesSection
                    kind="next_action"
                    propKey="nextActionTypes"
                    title="What's Next Actions"
                    description="Next-action options for follow-ups — drag to reorder. The system “Do Nothing” item cannot be deleted."
                    items={nextActionTypes}
                />

                <section className="space-y-4">
                    <div>
                        <h3 className="text-base font-semibold tracking-tight text-foreground">
                            Pipe Rules
                        </h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            Automation and defaults for this pipeline
                        </p>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-xs">
                        <PipelineRulesPanel pipelineRules={pipelineRules} />
                    </div>
                </section>
        </div>
    );
}

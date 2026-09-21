import { useCallback, useEffect, useRef, useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { BlockPicker } from "react-color";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import {
    destroy as destroyGoalType,
    reorder as reorderGoalTypes,
    store as storeGoalType,
    update as updateGoalType,
} from "@/actions/App/Http/Controllers/Portal/CampaignGoalTypeController";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CampaignFormFieldsPanel from "./campaign-form-fields-panel";
import { cn } from "@/lib/utils";

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

const DEFAULT_COLOR = "#3B82F6";
const GOAL_DND_TYPE = "SETTINGS_CAMPAIGN_GOAL";

const GOAL_COLORS = [
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

function GoalColorSwatch({ value, onChange, disabled = false }) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                disabled={disabled}
                aria-label="Change goal color"
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
                    colors={GOAL_COLORS}
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

function SortableGoalCard({
    goal,
    index,
    moveGoal,
    processing,
    onUpdate,
    onDuplicate,
    onRemove,
    onDragEnd,
}) {
    const ref = useRef(null);
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(goal.title);

    useEffect(() => {
        if (!editing) {
            setTitle(goal.title);
        }
    }, [goal.title, editing]);

    const [{ isDragging }, drag, preview] = useDrag(
        () => ({
            type: GOAL_DND_TYPE,
            item: () => ({ id: goal.id, index }),
            canDrag: !editing && !processing,
            end: () => onDragEnd?.(),
            collect: (monitor) => ({
                isDragging: monitor.isDragging(),
            }),
        }),
        [goal.id, index, editing, processing, onDragEnd]
    );

    const [, drop] = useDrop(
        () => ({
            accept: GOAL_DND_TYPE,
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

                moveGoal(dragIndex, hoverIndex);
                item.index = hoverIndex;
            },
        }),
        [index, moveGoal]
    );

    preview(drop(ref));

    const commitTitle = () => {
        const next = title.trim();

        setEditing(false);

        if (!next || next === goal.title) {
            setTitle(goal.title);
            return;
        }

        onUpdate(goal.id, { title: next, color: goal.color });
    };

    return (
        <div
            ref={ref}
            className={cn(
                "flex items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-3 shadow-xs transition-shadow",
                isDragging && "opacity-40 shadow-none",
                !isDragging && "hover:border-border hover:shadow-sm"
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

            <GoalColorSwatch
                value={goal.color}
                disabled={processing}
                onChange={(color) => onUpdate(goal.id, { title: goal.title, color })}
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
                                setTitle(goal.title);
                                setEditing(false);
                            }
                        }}
                        className="min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 py-1 text-sm font-semibold text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                    />
                ) : (
                    <button
                        type="button"
                        className="min-w-0 truncate text-left text-sm font-semibold text-foreground"
                        onClick={() => setEditing(true)}
                    >
                        {goal.title}
                    </button>
                )}
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
                <IconButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon="file-copy-line"
                    aria-label="Duplicate goal"
                    disabled={processing}
                    onClick={() => onDuplicate(goal)}
                />
                <IconButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon="delete-bin-line"
                    aria-label="Delete goal"
                    disabled={processing}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => onRemove(goal)}
                />
            </div>
        </div>
    );
}

export default function CampaignsPanel({
    campaignGoalTypes = [],
    campaignFormFields = [],
}) {
    const [items, setItems] = useState(campaignGoalTypes);
    const itemsRef = useRef(campaignGoalTypes);
    const [adding, setAdding] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newColor, setNewColor] = useState(DEFAULT_COLOR);
    const [processing, setProcessing] = useState(false);
    const dragOrderDirty = useRef(false);
    const addInputRef = useRef(null);

    useEffect(() => {
        setItems(campaignGoalTypes);
        itemsRef.current = campaignGoalTypes;
        dragOrderDirty.current = false;
    }, [campaignGoalTypes]);

    useEffect(() => {
        if (adding) {
            requestAnimationFrame(() => addInputRef.current?.focus());
        }
    }, [adding]);

    const persistOrder = useCallback((nextItems) => {
        setProcessing(true);
        router.put(
            pathFrom(reorderGoalTypes.url()),
            { order: nextItems.map((goal) => goal.id) },
            {
                preserveScroll: true,
                optimistic: (props) => ({
                    campaignGoalTypes: nextItems.map((goal, index) => ({
                        ...(props.campaignGoalTypes?.find((item) => item.id === goal.id) ?? goal),
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

    const moveGoal = useCallback((fromIndex, toIndex) => {
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

    const updateGoalInline = (id, payload) => {
        if (processing) {
            return;
        }

        setProcessing(true);
        setItems((prev) =>
            prev.map((goal) => (goal.id === id ? { ...goal, ...payload } : goal))
        );

        const goal = items.find((item) => item.id === id);

        router.put(pathFrom(updateGoalType.url(goal?.label ?? id)), payload, {
            preserveScroll: true,
            optimistic: (props) => ({
                campaignGoalTypes: (props.campaignGoalTypes ?? []).map((goal) =>
                    goal.id === id ? { ...goal, ...payload } : goal
                ),
            }),
            onError: (errors) => toast.error(errors.title || errors.message || "Unable to update"),
            onFinish: () => setProcessing(false),
        });
    };

    const createGoal = (title, color = DEFAULT_COLOR) => {
        const value = title.trim();

        if (!value || processing) {
            return;
        }

        setProcessing(true);
        router.post(
            pathFrom(storeGoalType.url()),
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

    const duplicateGoal = (goal) => {
        if (processing) {
            return;
        }

        createGoal(`${goal.title} copy`, goal.color || DEFAULT_COLOR);
    };

    const removeGoal = async (goal) => {
        if (processing) {
            return;
        }

        if (items.length <= 1) {
            await alert(
                "At least one campaign goal is required.",
                "Cannot delete goal"
            );
            return;
        }

        const confirmed = await confirm(
            `Delete "${goal.title}"? Existing campaign targets for this goal will be removed.`,
            "Delete campaign goal"
        );

        if (!confirmed) {
            return;
        }

        setProcessing(true);
        router.delete(pathFrom(destroyGoalType.url(goal.label)), {
            preserveScroll: true,
            onSuccess: () => toast.success("Campaign goal deleted"),
            onError: (errors) =>
                toast.error(errors.goal_type || errors.message || "Unable to delete"),
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="space-y-8">
                <section className="space-y-4">
                    <div>
                        <h3 className="text-base font-semibold tracking-tight text-foreground">
                            Campaign goals
                        </h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            Metrics available when creating campaigns — drag to reorder.
                        </p>
                    </div>

                    <div className="space-y-2">
                        {items.length === 0 && !adding ? (
                            <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">
                                No goals yet. Add your first goal below.
                            </div>
                        ) : (
                            items.map((goal, index) => (
                                <SortableGoalCard
                                    key={goal.id}
                                    goal={goal}
                                    index={index}
                                    moveGoal={moveGoal}
                                    processing={processing}
                                    onUpdate={updateGoalInline}
                                    onDuplicate={duplicateGoal}
                                    onRemove={removeGoal}
                                    onDragEnd={handleDragEnd}
                                />
                            ))
                        )}

                        {adding ? (
                            <form
                                className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 px-3 py-3"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    createGoal(newTitle, newColor);
                                }}
                            >
                                <span className="inline-flex size-7 shrink-0 items-center justify-center text-muted-foreground">
                                    <Icon name="add-line" className="text-base" />
                                </span>
                                <GoalColorSwatch
                                    value={newColor}
                                    onChange={setNewColor}
                                    disabled={processing}
                                />
                                <div className="min-w-0 flex-1">
                                    <Input
                                        ref={addInputRef}
                                        value={newTitle}
                                        onChange={(event) => setNewTitle(event.target.value)}
                                        placeholder="Goal name"
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
                                        aria-label="Create goal"
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
                                Add Goal
                            </button>
                        )}
                    </div>
                </section>

                <CampaignFormFieldsPanel campaignFormFields={campaignFormFields} />
            </div>
        </DndProvider>
    );
}

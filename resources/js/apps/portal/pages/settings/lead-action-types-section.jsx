import { useCallback, useEffect, useRef, useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import {
    destroy as destroyActionType,
    reorder as reorderActionTypes,
    store as storeActionType,
    update as updateActionType,
} from "@/actions/App/Http/Controllers/Portal/LeadActionTypeController";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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

const ACTION_DND_TYPE = "SETTINGS_LEAD_ACTION_TYPE";

function SortableActionCard({
    item,
    index,
    moveItem,
    processing,
    onUpdate,
    onRemove,
    onToggleEnabled,
    onDragEnd,
}) {
    const ref = useRef(null);
    const [title, setTitle] = useState(item.title);
    const [editing, setEditing] = useState(false);
    const enabled = item.is_enabled !== false;

    useEffect(() => {
        setTitle(item.title);
    }, [item.title]);

    const [{ isDragging }, drag] = useDrag({
        type: ACTION_DND_TYPE,
        item: { index, id: item.id },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
        end: () => onDragEnd?.(),
    });

    const [, drop] = useDrop({
        accept: ACTION_DND_TYPE,
        hover: (dragged) => {
            if (dragged.index === index) {
                return;
            }

            moveItem(dragged.index, index);
            dragged.index = index;
        },
    });

    drag(drop(ref));

    const commitTitle = () => {
        const next = title.trim();

        if (!next || next === item.title) {
            setTitle(item.title);
            setEditing(false);
            return;
        }

        setEditing(false);
        onUpdate(item, { title: next });
    };

    return (
        <div
            ref={ref}
            className={cn(
                "flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-3 shadow-xs",
                isDragging && "opacity-40",
                !enabled && "opacity-60"
            )}
        >
            <button
                type="button"
                aria-label="Drag to reorder"
                className="inline-flex size-7 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
            >
                <Icon name="draggable" className="text-base" />
            </button>

            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon name={item.icon || "flag-line"} className="text-base" />
            </span>

            <div className="min-w-0 flex-1">
                {editing ? (
                    <Input
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
                                setTitle(item.title);
                                setEditing(false);
                            }
                        }}
                        className="h-8"
                    />
                ) : (
                    <button
                        type="button"
                        className="block w-full truncate text-left text-sm font-semibold text-foreground"
                        onClick={() => setEditing(true)}
                    >
                        {item.title}
                    </button>
                )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
                {item.is_system ? (
                    <Switch
                        checked={enabled}
                        disabled={processing}
                        aria-label={`${enabled ? "Disable" : "Enable"} ${item.title}`}
                        onCheckedChange={(next) => onToggleEnabled(item, Boolean(next))}
                    />
                ) : (
                    <IconButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        icon="delete-bin-line"
                        aria-label={`Delete ${item.title}`}
                        disabled={processing}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => onRemove(item)}
                    />
                )}
            </div>
        </div>
    );
}

/**
 * Sortable admin list for lead activity actions or next actions.
 */
export function LeadActionTypesSection({
    kind,
    title,
    description,
    items: itemsProp = [],
    propKey,
}) {
    const [items, setItems] = useState(itemsProp);
    const itemsRef = useRef(itemsProp);
    const [adding, setAdding] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [processing, setProcessing] = useState(false);
    const dragOrderDirty = useRef(false);
    const addInputRef = useRef(null);

    useEffect(() => {
        setItems(itemsProp);
        itemsRef.current = itemsProp;
        dragOrderDirty.current = false;
    }, [itemsProp]);

    useEffect(() => {
        if (adding) {
            requestAnimationFrame(() => addInputRef.current?.focus());
        }
    }, [adding]);

    const persistOrder = useCallback(
        (nextItems) => {
            setProcessing(true);
            router.put(
                pathFrom(reorderActionTypes.url()),
                {
                    kind,
                    order: nextItems.map((item) => item.id),
                },
                {
                    preserveScroll: true,
                    optimistic: (props) => ({
                        [propKey]: nextItems.map((item, index) => ({
                            ...(props[propKey]?.find((row) => row.id === item.id) ?? item),
                            priority: index + 1,
                        })),
                    }),
                    onSuccess: () => {
                        dragOrderDirty.current = false;
                    },
                    onError: (errors) =>
                        toast.error(errors.order || errors.message || "Unable to reorder"),
                    onFinish: () => setProcessing(false),
                }
            );
        },
        [kind, propKey]
    );

    const moveItem = useCallback((fromIndex, toIndex) => {
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

    const createItem = (rawTitle) => {
        const nextTitle = String(rawTitle || "").trim();

        if (!nextTitle || processing) {
            return;
        }

        setProcessing(true);
        router.post(
            pathFrom(storeActionType.url()),
            { kind, title: nextTitle },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setAdding(false);
                    setNewTitle("");
                    toast.success("Added");
                },
                onError: (errors) =>
                    toast.error(errors.title || errors.message || "Unable to add"),
                onFinish: () => setProcessing(false),
            }
        );
    };

    const updateItem = (item, payload) => {
        if (processing) {
            return;
        }

        setProcessing(true);
        router.put(pathFrom(updateActionType.url(item.id)), payload, {
            preserveScroll: true,
            onSuccess: () => toast.success("Updated"),
            onError: (errors) =>
                toast.error(
                    errors.title || errors.action_type || errors.message || "Unable to update"
                ),
            onFinish: () => setProcessing(false),
        });
    };

    const toggleEnabled = (item, nextEnabled) => {
        if (processing || !item.is_system) {
            return;
        }

        if (!nextEnabled) {
            const enabledCount = items.filter((row) => row.is_enabled !== false).length;

            if (enabledCount <= 1) {
                toast.error("At least one enabled item is required.");
                return;
            }
        }

        setItems((prev) => {
            const next = prev.map((row) =>
                row.id === item.id ? { ...row, is_enabled: nextEnabled } : row
            );
            itemsRef.current = next;

            return next;
        });

        updateItem(item, { title: item.title, is_enabled: nextEnabled });
    };

    const removeItem = async (item) => {
        if (processing || item.is_system) {
            return;
        }

        const enabledRemaining = items.filter(
            (row) => row.id !== item.id && row.is_enabled !== false
        ).length;

        if (enabledRemaining < 1) {
            toast.error("At least one enabled item is required.");
            return;
        }

        setProcessing(true);
        router.delete(pathFrom(destroyActionType.url(item.id)), {
            preserveScroll: true,
            onSuccess: () => toast.success("Deleted"),
            onError: (errors) =>
                toast.error(errors.action_type || errors.message || "Unable to delete"),
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <section className="space-y-4">
            <div>
                <h3 className="text-base font-bold tracking-tight text-foreground">{title}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            </div>

            <DndProvider backend={HTML5Backend}>
                <div className="space-y-2">
                    {items.length === 0 && !adding ? (
                        <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">
                            No items yet. Add the first one below.
                        </div>
                    ) : (
                        items.map((item, index) => (
                            <SortableActionCard
                                key={item.id}
                                item={item}
                                index={index}
                                moveItem={moveItem}
                                processing={processing}
                                onUpdate={updateItem}
                                onRemove={removeItem}
                                onToggleEnabled={toggleEnabled}
                                onDragEnd={handleDragEnd}
                            />
                        ))
                    )}

                    {adding ? (
                        <form
                            className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 px-3 py-3"
                            onSubmit={(event) => {
                                event.preventDefault();
                                createItem(newTitle);
                            }}
                        >
                            <span className="inline-flex size-7 shrink-0 items-center justify-center text-muted-foreground">
                                <Icon name="add-line" className="text-base" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <Input
                                    ref={addInputRef}
                                    value={newTitle}
                                    onChange={(event) => setNewTitle(event.target.value)}
                                    placeholder="Name"
                                    disabled={processing}
                                    onKeyDown={(event) => {
                                        if (event.key === "Escape") {
                                            setAdding(false);
                                            setNewTitle("");
                                        }
                                    }}
                                />
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                                <IconButton
                                    type="submit"
                                    size="sm"
                                    icon="check-line"
                                    aria-label="Save"
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
                                    }}
                                />
                            </div>
                        </form>
                    ) : (
                        <button
                            type="button"
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-transparent px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/30 hover:text-foreground"
                            onClick={() => setAdding(true)}
                        >
                            <Icon name="add-line" className="text-base" />
                            Add item
                        </button>
                    )}
                </div>
            </DndProvider>
        </section>
    );
}

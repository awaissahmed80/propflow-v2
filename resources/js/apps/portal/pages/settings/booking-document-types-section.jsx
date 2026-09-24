import { useCallback, useEffect, useRef, useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import {
    destroy as destroyDocumentType,
    reorder as reorderDocumentTypes,
    store as storeDocumentType,
    update as updateDocumentType,
} from "@/actions/App/Http/Controllers/Portal/BookingDocumentTypeController";
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

const DOC_DND_TYPE = "SETTINGS_BOOKING_DOCUMENT_TYPE";

function SortableDocumentCard({
    item,
    index,
    moveItem,
    processing,
    onUpdate,
    onRemove,
    onDragEnd,
}) {
    const ref = useRef(null);
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(item.title || "");
    const [description, setDescription] = useState(item.description || "");
    const isRequired = item.is_required !== false;

    useEffect(() => {
        if (!editing) {
            setTitle(item.title || "");
            setDescription(item.description || "");
        }
    }, [item.title, item.description, editing]);

    const [{ isDragging }, drag, preview] = useDrag(
        () => ({
            type: DOC_DND_TYPE,
            item: () => ({ id: item.id, index }),
            canDrag: !editing && !processing,
            end: () => onDragEnd?.(),
            collect: (monitor) => ({
                isDragging: monitor.isDragging(),
            }),
        }),
        [item.id, index, editing, processing, onDragEnd],
    );

    const [, drop] = useDrop(
        () => ({
            accept: DOC_DND_TYPE,
            hover(dragItem) {
                if (!ref.current) {
                    return;
                }

                const dragIndex = dragItem.index;
                const hoverIndex = index;

                if (dragIndex === hoverIndex) {
                    return;
                }

                moveItem(dragIndex, hoverIndex);
                dragItem.index = hoverIndex;
            },
        }),
        [index, moveItem],
    );

    preview(drop(ref));

    const commit = () => {
        const nextTitle = title.trim();
        const nextDescription = description.trim() || null;

        setEditing(false);

        if (!nextTitle) {
            setTitle(item.title || "");
            setDescription(item.description || "");
            return;
        }

        if (
            nextTitle === (item.title || "") &&
            nextDescription === (item.description || null)
        ) {
            return;
        }

        onUpdate(item.id, {
            title: nextTitle,
            description: nextDescription,
            is_required: isRequired,
        });
    };

    return (
        <div
            ref={ref}
            className={cn(
                "flex items-start gap-2 rounded-xl border border-border/60 bg-background px-3 py-3 shadow-xs transition-shadow",
                "hover:border-border hover:shadow-sm",
                isDragging && "opacity-40",
            )}
        >
            <button
                type="button"
                ref={drag}
                aria-label="Drag to reorder"
                disabled={editing || processing}
                className={cn(
                    "mt-0.5 inline-flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground",
                    "hover:bg-muted active:cursor-grabbing",
                    "disabled:pointer-events-none disabled:opacity-40",
                )}
            >
                <Icon name="draggable" className="text-base" />
            </button>

            <div className="min-w-0 flex-1 space-y-1.5">
                {editing ? (
                    <>
                        <Input
                            value={title}
                            autoFocus
                            disabled={processing}
                            onChange={(event) => setTitle(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    commit();
                                }
                                if (event.key === "Escape") {
                                    setTitle(item.title || "");
                                    setDescription(item.description || "");
                                    setEditing(false);
                                }
                            }}
                            placeholder="Document name"
                        />
                        <Input
                            value={description}
                            disabled={processing}
                            onChange={(event) => setDescription(event.target.value)}
                            onBlur={commit}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    commit();
                                }
                                if (event.key === "Escape") {
                                    setTitle(item.title || "");
                                    setDescription(item.description || "");
                                    setEditing(false);
                                }
                            }}
                            placeholder="Short hint (optional)"
                        />
                    </>
                ) : (
                    <button
                        type="button"
                        className="block w-full min-w-0 text-left"
                        onClick={() => setEditing(true)}
                    >
                        <span className="block truncate text-sm font-semibold text-foreground">
                            {item.title}
                        </span>
                        {item.description ? (
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                {item.description}
                            </span>
                        ) : (
                            <span className="mt-0.5 block text-xs text-muted-foreground/70">
                                Click to add a hint
                            </span>
                        )}
                    </button>
                )}

                <div className="flex items-center gap-2 pt-0.5">
                    <Switch
                        size="sm"
                        checked={isRequired}
                        disabled={processing}
                        aria-label={`${isRequired ? "Mark optional" : "Mark mandatory"}: ${item.title}`}
                        onCheckedChange={(checked) =>
                            onUpdate(item.id, {
                                title: item.title,
                                description: item.description || null,
                                is_required: Boolean(checked),
                            })
                        }
                    />
                    <span className="text-xs text-muted-foreground">
                        {isRequired ? "Mandatory" : "Optional"}
                    </span>
                </div>
            </div>

            <IconButton
                type="button"
                size="sm"
                variant="ghost"
                icon="delete-bin-line"
                aria-label={`Delete ${item.title}`}
                disabled={processing}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onRemove(item)}
            />
        </div>
    );
}

export default function BookingDocumentTypesSection({
    bookingDocumentTypes = [],
}) {
    const [items, setItems] = useState(bookingDocumentTypes);
    const itemsRef = useRef(bookingDocumentTypes);
    const [adding, setAdding] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [newIsRequired, setNewIsRequired] = useState(true);
    const [processing, setProcessing] = useState(false);
    const dragOrderDirty = useRef(false);
    const addInputRef = useRef(null);

    useEffect(() => {
        setItems(bookingDocumentTypes);
        itemsRef.current = bookingDocumentTypes;
        dragOrderDirty.current = false;
    }, [bookingDocumentTypes]);

    useEffect(() => {
        if (adding) {
            requestAnimationFrame(() => addInputRef.current?.focus());
        }
    }, [adding]);

    const persistOrder = useCallback((nextItems) => {
        setProcessing(true);
        router.put(
            pathFrom(reorderDocumentTypes.url()),
            { order: nextItems.map((row) => row.id) },
            {
                preserveScroll: true,
                optimistic: (props) => ({
                    bookingDocumentTypes: nextItems.map((row, index) => ({
                        ...(props.bookingDocumentTypes?.find((item) => item.id === row.id) ??
                            row),
                        priority: index + 1,
                    })),
                }),
                onSuccess: () => {
                    dragOrderDirty.current = false;
                },
                onError: (errors) =>
                    toast.error(errors.order || errors.message || "Unable to reorder"),
                onFinish: () => setProcessing(false),
            },
        );
    }, []);

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

    const updateInline = (id, payload) => {
        if (processing) {
            return;
        }

        setProcessing(true);
        setItems((prev) =>
            prev.map((row) => (row.id === id ? { ...row, ...payload } : row)),
        );

        const row = items.find((item) => item.id === id);

        router.put(pathFrom(updateDocumentType.url(row?.label ?? id)), payload, {
            preserveScroll: true,
            optimistic: (props) => ({
                bookingDocumentTypes: (props.bookingDocumentTypes ?? []).map((doc) =>
                    doc.id === id ? { ...doc, ...payload } : doc,
                ),
            }),
            onError: (errors) =>
                toast.error(errors.title || errors.message || "Unable to update"),
            onFinish: () => setProcessing(false),
        });
    };

    const createItem = (title, description = "", isRequired = true) => {
        const value = title.trim();

        if (!value || processing) {
            return;
        }

        setProcessing(true);
        router.post(
            pathFrom(storeDocumentType.url()),
            {
                title: value,
                description: description.trim() || null,
                is_required: isRequired,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setNewTitle("");
                    setNewDescription("");
                    setNewIsRequired(true);
                    setAdding(false);
                    toast.success("Document type added");
                },
                onError: (errors) =>
                    toast.error(errors.title || errors.message || "Unable to create"),
                onFinish: () => setProcessing(false),
            },
        );
    };

    const removeItem = async (row) => {
        if (processing) {
            return;
        }

        if (items.length <= 1) {
            await alert(
                "At least one booking document type is needed.",
                "Cannot delete",
            );
            return;
        }

        const confirmed = await confirm(
            `Remove "${row.title}" from the documents list?`,
            "Remove document type",
        );

        if (!confirmed) {
            return;
        }

        setProcessing(true);
        router.delete(pathFrom(destroyDocumentType.url(row.label)), {
            preserveScroll: true,
            onSuccess: () => toast.success("Document type removed"),
            onError: (errors) =>
                toast.error(
                    errors.document_type || errors.message || "Unable to delete",
                ),
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <DndProvider backend={HTML5Backend}>
            <section className="space-y-4">
                <div>
                    <h3 className="text-base font-bold tracking-tight text-foreground">
                        Required documents
                    </h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        Checklist shown on each booking’s Documents tab. Mark each type as
                        mandatory or optional. Drag to reorder.
                    </p>
                </div>

                <div className="space-y-2">
                    {items.length === 0 && !adding ? (
                        <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">
                            No document types yet. Add the first one below.
                        </div>
                    ) : (
                        items.map((item, index) => (
                            <SortableDocumentCard
                                key={item.id}
                                item={item}
                                index={index}
                                moveItem={moveItem}
                                processing={processing}
                                onUpdate={updateInline}
                                onRemove={removeItem}
                                onDragEnd={handleDragEnd}
                            />
                        ))
                    )}

                    {adding ? (
                        <form
                            className="space-y-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-3"
                            onSubmit={(event) => {
                                event.preventDefault();
                                createItem(newTitle, newDescription, newIsRequired);
                            }}
                        >
                            <Input
                                ref={addInputRef}
                                value={newTitle}
                                onChange={(event) => setNewTitle(event.target.value)}
                                placeholder="Document name"
                                disabled={processing}
                                onKeyDown={(event) => {
                                    if (event.key === "Escape") {
                                        setAdding(false);
                                        setNewTitle("");
                                        setNewDescription("");
                                        setNewIsRequired(true);
                                    }
                                }}
                            />
                            <Input
                                value={newDescription}
                                onChange={(event) => setNewDescription(event.target.value)}
                                placeholder="Short hint (optional)"
                                disabled={processing}
                            />
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Switch
                                        size="sm"
                                        checked={newIsRequired}
                                        disabled={processing}
                                        aria-label={
                                            newIsRequired
                                                ? "Mark new document optional"
                                                : "Mark new document mandatory"
                                        }
                                        onCheckedChange={(checked) =>
                                            setNewIsRequired(Boolean(checked))
                                        }
                                    />
                                    <span className="text-xs text-muted-foreground">
                                        {newIsRequired ? "Mandatory" : "Optional"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
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
                                            setNewDescription("");
                                            setNewIsRequired(true);
                                        }}
                                    />
                                    <IconButton
                                        type="submit"
                                        size="sm"
                                        icon="check-line"
                                        aria-label="Save"
                                        disabled={processing || !newTitle.trim()}
                                    />
                                </div>
                            </div>
                        </form>
                    ) : (
                        <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border/70 px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/30 hover:text-foreground"
                            onClick={() => setAdding(true)}
                        >
                            <Icon name="add-line" className="text-base" />
                            Add document type
                        </button>
                    )}
                </div>
            </section>
        </DndProvider>
    );
}

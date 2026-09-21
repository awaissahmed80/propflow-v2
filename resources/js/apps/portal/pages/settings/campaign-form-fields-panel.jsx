import { useCallback, useEffect, useRef, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import {
    destroy as destroyFormField,
    reorder as reorderFormFields,
    store as storeFormField,
    update as updateFormField,
} from "@/actions/App/Http/Controllers/Portal/CampaignFormFieldController";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { SelectBox } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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

const FIELD_DND_TYPE = "SETTINGS_CAMPAIGN_FORM_FIELD";

const FIELD_TYPE_OPTIONS = [
    { value: "text", label: "Text" },
    { value: "email", label: "Email" },
    { value: "tel", label: "Phone" },
    { value: "number", label: "Number" },
    { value: "textarea", label: "Textarea" },
];

function SortableFieldCard({
    field,
    index,
    moveField,
    processing,
    onUpdate,
    onRemove,
    onDragEnd,
}) {
    const ref = useRef(null);
    const [editing, setEditing] = useState(false);
    const [label, setLabel] = useState(field.label);

    useEffect(() => {
        if (!editing) {
            setLabel(field.label);
        }
    }, [field.label, editing]);

    const [{ isDragging }, drag, preview] = useDrag(
        () => ({
            type: FIELD_DND_TYPE,
            item: () => ({ id: field.id, index }),
            canDrag: !editing && !processing,
            end: () => onDragEnd?.(),
            collect: (monitor) => ({
                isDragging: monitor.isDragging(),
            }),
        }),
        [field.id, index, editing, processing, onDragEnd]
    );

    const [, drop] = useDrop(
        () => ({
            accept: FIELD_DND_TYPE,
            hover(item) {
                if (!ref.current || item.index === index) {
                    return;
                }

                moveField(item.index, index);
                item.index = index;
            },
        }),
        [index, moveField]
    );

    preview(drop(ref));

    const commitLabel = () => {
        const next = label.trim();

        setEditing(false);

        if (!next || next === field.label) {
            setLabel(field.label);
            return;
        }

        onUpdate(field.id, {
            label: next,
            type: field.type,
            required: field.required,
            enabled: field.enabled,
            placeholder: field.placeholder,
        });
    };

    return (
        <div
            ref={ref}
            className={cn(
                "flex flex-col gap-2 rounded-xl border border-border/60 bg-background px-3 py-3 shadow-xs transition-shadow sm:flex-row sm:items-center",
                isDragging && "opacity-40 shadow-none",
                !isDragging && "hover:border-border hover:shadow-sm"
            )}
        >
            <div className="flex min-w-0 flex-1 items-center gap-3">
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

                <div className="min-w-0 flex-1 space-y-1">
                    {editing ? (
                        <Input
                            value={label}
                            autoFocus
                            disabled={processing}
                            onChange={(event) => setLabel(event.target.value)}
                            onBlur={commitLabel}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    commitLabel();
                                }
                                if (event.key === "Escape") {
                                    setLabel(field.label);
                                    setEditing(false);
                                }
                            }}
                        />
                    ) : (
                        <button
                            type="button"
                            className="block truncate text-left text-sm font-medium text-foreground hover:underline"
                            onClick={() => setEditing(true)}
                        >
                            {field.label}
                        </button>
                    )}
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {field.key}
                        {field.is_system ? " · system" : ""}
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <SelectBox
                    value={field.type}
                    onValueChange={(value) =>
                        onUpdate(field.id, {
                            label: field.label,
                            type: value,
                            required: field.required,
                            enabled: field.enabled,
                            placeholder: field.placeholder,
                        })
                    }
                    options={FIELD_TYPE_OPTIONS}
                    disabled={processing}
                    triggerClassName="h-8 w-[7.5rem]"
                />
                <Checkbox
                    checked={Boolean(field.required)}
                    disabled={processing}
                    onCheckedChange={(checked) =>
                        onUpdate(field.id, {
                            label: field.label,
                            type: field.type,
                            required: Boolean(checked),
                            enabled: field.enabled,
                            placeholder: field.placeholder,
                        })
                    }
                >
                    Required
                </Checkbox>
                <Checkbox
                    checked={Boolean(field.enabled)}
                    disabled={processing}
                    onCheckedChange={(checked) =>
                        onUpdate(field.id, {
                            label: field.label,
                            type: field.type,
                            required: field.required,
                            enabled: Boolean(checked),
                            placeholder: field.placeholder,
                        })
                    }
                >
                    Default on
                </Checkbox>
                <IconButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon="delete-bin-line"
                    aria-label="Delete field"
                    disabled={processing || field.is_system}
                    onClick={() => onRemove(field)}
                />
            </div>
        </div>
    );
}

export default function CampaignFormFieldsPanel({ campaignFormFields = [] }) {
    const [items, setItems] = useState(campaignFormFields);
    const itemsRef = useRef(campaignFormFields);
    const [adding, setAdding] = useState(false);
    const [newLabel, setNewLabel] = useState("");
    const [newType, setNewType] = useState("text");
    const [processing, setProcessing] = useState(false);
    const dragOrderDirty = useRef(false);
    const addInputRef = useRef(null);

    useEffect(() => {
        setItems(campaignFormFields);
        itemsRef.current = campaignFormFields;
        dragOrderDirty.current = false;
    }, [campaignFormFields]);

    useEffect(() => {
        if (adding) {
            requestAnimationFrame(() => addInputRef.current?.focus());
        }
    }, [adding]);

    const persistOrder = useCallback((nextItems) => {
        setProcessing(true);
        router.put(
            pathFrom(reorderFormFields.url()),
            { order: nextItems.map((field) => field.id) },
            {
                preserveScroll: true,
                optimistic: (props) => ({
                    campaignFormFields: nextItems.map((field, index) => ({
                        ...(props.campaignFormFields?.find((item) => item.id === field.id) ??
                            field),
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
    }, []);

    const moveField = useCallback((fromIndex, toIndex) => {
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

    const updateField = (id, payload) => {
        if (processing) {
            return;
        }

        setProcessing(true);
        setItems((prev) =>
            prev.map((field) => (field.id === id ? { ...field, ...payload } : field))
        );

        const field = items.find((item) => item.id === id);

        router.put(pathFrom(updateFormField.url(field?.key ?? id)), payload, {
            preserveScroll: true,
            optimistic: (props) => ({
                campaignFormFields: (props.campaignFormFields ?? []).map((field) =>
                    field.id === id ? { ...field, ...payload } : field
                ),
            }),
            onError: (errors) =>
                toast.error(errors.label || errors.key || errors.message || "Unable to update"),
            onFinish: () => setProcessing(false),
        });
    };

    const createField = () => {
        const value = newLabel.trim();

        if (!value || processing) {
            return;
        }

        setProcessing(true);
        router.post(
            pathFrom(storeFormField.url()),
            {
                label: value,
                type: newType,
                enabled: true,
                required: false,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setNewLabel("");
                    setNewType("text");
                    setAdding(false);
                    toast.success("Form field added");
                },
                onError: (errors) =>
                    toast.error(errors.label || errors.key || errors.message || "Unable to create"),
                onFinish: () => setProcessing(false),
            }
        );
    };

    const removeField = async (field) => {
        if (processing || field.is_system) {
            return;
        }

        const confirmed = await confirm(
            `Delete "${field.label}"? It will be removed from existing campaign forms.`,
            "Delete form field"
        );

        if (!confirmed) {
            return;
        }

        setProcessing(true);
        router.delete(pathFrom(destroyFormField.url(field.key)), {
            preserveScroll: true,
            onSuccess: () => toast.success("Form field deleted"),
            onError: (errors) =>
                toast.error(errors.field || errors.message || "Unable to delete"),
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <section className="space-y-4">
            <div>
                <h3 className="text-base font-semibold tracking-tight text-foreground">
                    Form fields
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                    Fields available on campaign lead forms — drag to reorder. New fields are
                    added to existing forms.
                </p>
            </div>

            <div className="space-y-2">
                    {items.length === 0 && !adding ? (
                        <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">
                            No form fields yet. Add your first field below.
                        </div>
                    ) : (
                        items.map((field, index) => (
                            <SortableFieldCard
                                key={field.id}
                                field={field}
                                index={index}
                                moveField={moveField}
                                processing={processing}
                                onUpdate={updateField}
                                onRemove={removeField}
                                onDragEnd={handleDragEnd}
                            />
                        ))
                    )}

                    {adding ? (
                        <form
                            className="flex flex-col gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-3 sm:flex-row sm:items-center"
                            onSubmit={(event) => {
                                event.preventDefault();
                                createField();
                            }}
                        >
                            <span className="inline-flex size-7 shrink-0 items-center justify-center text-muted-foreground">
                                <Icon name="add-line" className="text-base" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <Input
                                    ref={addInputRef}
                                    value={newLabel}
                                    onChange={(event) => setNewLabel(event.target.value)}
                                    placeholder="Field label"
                                    disabled={processing}
                                    onKeyDown={(event) => {
                                        if (event.key === "Escape") {
                                            setAdding(false);
                                            setNewLabel("");
                                            setNewType("text");
                                        }
                                    }}
                                />
                            </div>
                            <SelectBox
                                value={newType}
                                onValueChange={setNewType}
                                options={FIELD_TYPE_OPTIONS}
                                disabled={processing}
                                triggerClassName="h-9 w-full sm:w-[8rem]"
                            />
                            <div className="flex shrink-0 items-center gap-1">
                                <IconButton
                                    type="submit"
                                    size="sm"
                                    variant="ghost"
                                    icon="check-line"
                                    aria-label="Create field"
                                    disabled={processing || !newLabel.trim()}
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
                                        setNewLabel("");
                                        setNewType("text");
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
                            Add field
                        </button>
                    )}
                </div>
        </section>
    );
}

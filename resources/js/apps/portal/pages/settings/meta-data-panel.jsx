import { useEffect, useMemo, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import {
    destroy as destroyMeta,
    store as storeMeta,
    update as updateMeta,
} from "@/actions/App/Http/Controllers/Portal/MetaDataController";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
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

const TYPE_META = {
    CITY: {
        icon: "map-pin-line",
        hint: "Cities for projects and lead locations",
        placeholder: "e.g. Karachi",
    },
    COUNTRY: {
        icon: "earth-line",
        hint: "Countries used across the portal",
        placeholder: "e.g. Pakistan",
    },
    PROJECT: {
        icon: "building-2-line",
        hint: "Project types for categorization",
        placeholder: "e.g. Residential",
    },
    UNIT: {
        icon: "home-4-line",
        hint: "Unit types for inventory listings",
        placeholder: "e.g. Apartment",
    },
    AREA: {
        icon: "ruler-line",
        hint: "Area units for size measurements",
        placeholder: "e.g. Sq. Feet",
    },
    LINK: {
        icon: "links-line",
        hint: "Labels for contact and social links",
        placeholder: "e.g. LinkedIn",
    },
    DEPARTMENT: {
        icon: "organization-chart",
        hint: "Departments for teams and roles",
        placeholder: "e.g. Sales",
    },
};

function typeMeta(type) {
    return (
        TYPE_META[type] ?? {
            icon: "list-check-3",
            hint: "Shared values used in forms and filters",
            placeholder: "Add a value",
        }
    );
}

function MetaValueRow({
    item,
    isEditing,
    editingValue,
    processing,
    onEdit,
    onChange,
    onSave,
    onCancel,
    onRemove,
}) {
    return (
        <div
            className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                isEditing
                    ? "bg-primary/5 ring-1 ring-primary/20"
                    : "hover:bg-muted/60"
            )}
        >
            <span
                className={cn(
                    "mt-0.5 size-1.5 shrink-0 rounded-full",
                    isEditing ? "bg-primary" : "bg-muted-foreground/35 group-hover:bg-primary/70"
                )}
            />

            {isEditing ? (
                <Input
                    value={editingValue}
                    onChange={(event) => onChange(event.target.value)}
                    className="flex-1"
                    autoFocus
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            onSave();
                        }
                        if (event.key === "Escape") {
                            onCancel();
                        }
                    }}
                />
            ) : (
                <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground"
                    onClick={onEdit}
                >
                    {item.value}
                </button>
            )}

            <div
                className={cn(
                    "flex shrink-0 items-center gap-0.5",
                    !isEditing && "text-muted-foreground"
                )}
            >
                {isEditing ? (
                    <>
                        <IconButton
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label="Save"
                            disabled={processing || !editingValue.trim()}
                            onClick={onSave}
                        >
                            <Icon name="check-line" />
                        </IconButton>
                        <IconButton
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label="Cancel"
                            disabled={processing}
                            onClick={onCancel}
                        >
                            <Icon name="close-line" />
                        </IconButton>
                    </>
                ) : (
                    <>
                        <IconButton
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label="Edit"
                            disabled={processing}
                            onClick={onEdit}
                        >
                            <Icon name="pencil-line" />
                        </IconButton>
                        <IconButton
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label="Delete"
                            disabled={processing}
                            className="text-muted-foreground hover:text-destructive"
                            onClick={onRemove}
                        >
                            <Icon name="delete-bin-line" />
                        </IconButton>
                    </>
                )}
            </div>
        </div>
    );
}

export default function MetaDataPanel({
    section,
    metaTypes = [],
}) {
    const [activeType, setActiveType] = useState(metaTypes[0]?.type ?? "CITY");
    const [newValue, setNewValue] = useState("");
    const [query, setQuery] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editingValue, setEditingValue] = useState("");
    const [processing, setProcessing] = useState(false);
    const addInputRef = useRef(null);

    const activeGroup = useMemo(
        () => metaTypes.find((group) => group.type === activeType) ?? metaTypes[0],
        [metaTypes, activeType]
    );

    const items = activeGroup?.items ?? [];
    const meta = typeMeta(activeGroup?.type);
    const totalValues = useMemo(
        () => metaTypes.reduce((sum, group) => sum + (group.items?.length ?? 0), 0),
        [metaTypes]
    );

    const filteredItems = useMemo(() => {
        const needle = query.trim().toLowerCase();

        if (!needle) {
            return items;
        }

        return items.filter((item) => item.value?.toLowerCase().includes(needle));
    }, [items, query]);

    useEffect(() => {
        setQuery("");
        setEditingId(null);
        setEditingValue("");
        setNewValue("");
    }, [activeType]);

    const selectType = (type) => {
        setActiveType(type);
        requestAnimationFrame(() => addInputRef.current?.focus());
    };

    const addItem = (event) => {
        event.preventDefault();
        const value = newValue.trim();

        if (!value || processing) {
            return;
        }

        setProcessing(true);
        router.post(
            pathFrom(storeMeta.url()),
            { type: activeType, value },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setNewValue("");
                    toast.success("Value added");
                    requestAnimationFrame(() => addInputRef.current?.focus());
                },
                onError: (errors) => {
                    toast.error(errors.value || errors.message || "Unable to add value");
                },
                onFinish: () => setProcessing(false),
            }
        );
    };

    const saveEdit = (id) => {
        const value = editingValue.trim();

        if (!value || processing) {
            return;
        }

        setProcessing(true);
        router.put(
            pathFrom(updateMeta.url(id)),
            { value },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setEditingId(null);
                    setEditingValue("");
                    toast.success("Value updated");
                },
                onError: (errors) => {
                    toast.error(errors.value || errors.message || "Unable to update");
                },
                onFinish: () => setProcessing(false),
            }
        );
    };

    const removeItem = (id) => {
        if (processing) {
            return;
        }

        setProcessing(true);
        router.delete(pathFrom(destroyMeta.url(id)), {
            preserveScroll: true,
            onSuccess: () => toast.success("Value removed"),
            onError: (errors) => toast.error(errors.message || "Unable to remove"),
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <div className="space-y-2">
            <div className="sticky top-0 z-10 -mx-6 border-b border-border/60 bg-background/95 px-6 py-3 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-foreground shadow-xs ring-1 ring-border/70">
                            <Icon
                                name={section?.icon || "list-check-3"}
                                className="text-base"
                            />
                        </span>
                        <div className="min-w-0">
                            <h2 className="text-base font-semibold tracking-tight text-foreground">
                                {section?.label ?? "Meta data"}
                            </h2>
                            <p className="truncate text-xs text-muted-foreground">
                                Shared lists powering forms, filters, and dropdowns
                                {totalValues > 0 ? ` · ${totalValues} values` : ""}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border/70 bg-card/30 shadow-xs">
                <div className="grid min-h-[28rem] lg:grid-cols-[15.5rem_minmax(0,1fr)]">
                    <aside className="border-b border-border/60 bg-muted/20 lg:border-r lg:border-b-0">
                        <div className="px-3 py-3">
                            <p className="px-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                                Lists
                            </p>
                            <nav className="mt-1.5 space-y-0.5">
                                {metaTypes.map((group) => {
                                    const isActive = group.type === activeType;
                                    const info = typeMeta(group.type);
                                    const count = group.items?.length ?? 0;

                                    return (
                                        <button
                                            key={group.type}
                                            type="button"
                                            onClick={() => selectType(group.type)}
                                            className={cn(
                                                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                                                isActive
                                                    ? "bg-primary/10 text-primary"
                                                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
                                                    isActive
                                                        ? "bg-primary/15 text-primary"
                                                        : "bg-background text-muted-foreground ring-1 ring-border/60"
                                                )}
                                            >
                                                <Icon name={info.icon} className="text-sm" />
                                            </span>
                                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                                {group.label}
                                            </span>
                                            <span
                                                className={cn(
                                                    "rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                                                    isActive
                                                        ? "bg-primary/15 text-primary"
                                                        : "bg-muted text-muted-foreground"
                                                )}
                                            >
                                                {count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>
                    </aside>

                    <div className="flex min-w-0 flex-col bg-background/60">
                        <div className="border-b border-border/60 px-5 py-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-semibold tracking-tight text-foreground">
                                            {activeGroup?.label ?? "Values"}
                                        </h3>
                                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                                            {items.length}
                                        </span>
                                    </div>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        {meta.hint}
                                    </p>
                                </div>

                                {items.length > 5 ? (
                                    <div className="relative w-full max-w-[14rem]">
                                        <Icon
                                            name="search-line"
                                            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground"
                                        />
                                        <Input
                                            value={query}
                                            onChange={(event) => setQuery(event.target.value)}
                                            placeholder="Filter values…"
                                            className="pl-8"
                                        />
                                    </div>
                                ) : null}
                            </div>

                            <form className="mt-4 flex gap-2" onSubmit={addItem}>
                                <div className="min-w-0 flex-1">
                                    <Input
                                        ref={addInputRef}
                                        value={newValue}
                                        onChange={(event) => setNewValue(event.target.value)}
                                        placeholder={meta.placeholder}
                                        disabled={processing}
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    disabled={processing || !newValue.trim()}
                                    className="shrink-0 gap-1.5"
                                >
                                    <Icon name="add-line" className="text-sm" />
                                    Add
                                </Button>
                            </form>
                        </div>

                        <div className="flex-1 px-3 py-3">
                            {items.length === 0 ? (
                                <div className="flex h-full min-h-[14rem] flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/15 px-6 py-10 text-center">
                                    <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                                        <Icon name={meta.icon} className="text-xl" />
                                    </span>
                                    <p className="mt-3 text-sm font-medium text-foreground">
                                        No {activeGroup?.label?.toLowerCase() ?? "values"} yet
                                    </p>
                                    <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                                        Add the first value above. New entries also appear automatically
                                        when used in forms.
                                    </p>
                                </div>
                            ) : filteredItems.length === 0 ? (
                                <div className="flex min-h-[10rem] flex-col items-center justify-center px-4 py-8 text-center">
                                    <p className="text-sm font-medium text-foreground">No matches</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Nothing matches “{query.trim()}”.
                                    </p>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="mt-3"
                                        onClick={() => setQuery("")}
                                    >
                                        Clear filter
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-0.5">
                                    {filteredItems.map((item) => {
                                        const isEditing = editingId === item.id;

                                        return (
                                            <MetaValueRow
                                                key={item.id}
                                                item={item}
                                                isEditing={isEditing}
                                                editingValue={editingValue}
                                                processing={processing}
                                                onEdit={() => {
                                                    setEditingId(item.id);
                                                    setEditingValue(item.value);
                                                }}
                                                onChange={setEditingValue}
                                                onSave={() => saveEdit(item.id)}
                                                onCancel={() => {
                                                    setEditingId(null);
                                                    setEditingValue("");
                                                }}
                                                onRemove={() => removeItem(item.id)}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

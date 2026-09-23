import { useEffect, useRef, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import { BlockPicker } from "react-color";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function pathFrom(url) {
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

export const DEFAULT_COLOR = "#64B5F6";
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

export function formatLeadCount(count) {
    const n = Number(count) || 0;

    return `${n} ${n === 1 ? "lead" : "leads"}`;
}

export function StageColorSwatch({ value, onChange, disabled = false }) {
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

export function SortableStageCard({
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

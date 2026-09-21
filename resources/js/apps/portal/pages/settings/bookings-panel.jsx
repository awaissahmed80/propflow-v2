import { useEffect, useState } from "react";
import { router } from "@inertiajs/react";
import { BlockPicker } from "react-color";
import { toast } from "sonner";
import { update as updateStage } from "@/actions/App/Http/Controllers/Portal/OrderStageController";
import { update as updateStatus } from "@/actions/App/Http/Controllers/Portal/OrderStatusController";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

const DEFAULT_COLOR = "#64B5F6";

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

function formatOrderCount(count) {
    const n = Number(count) || 0;

    return `${n} ${n === 1 ? "booking" : "bookings"}`;
}

function ColorSwatch({ value, onChange, label = "Change color" }) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                aria-label={label}
                className={cn(
                    "size-3 shrink-0 rounded-full ring-2 ring-background transition-transform hover:scale-110",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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

function EditableTitle({ value, onSave }) {
    const [draft, setDraft] = useState(value || "");

    useEffect(() => {
        setDraft(value || "");
    }, [value]);

    return (
        <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
                const next = draft.trim();

                if (!next || next === (value || "")) {
                    setDraft(value || "");

                    return;
                }

                onSave(next);
            }}
            onKeyDown={(event) => {
                if (event.key === "Enter") {
                    event.currentTarget.blur();
                }
            }}
            className="h-control max-w-xs"
        />
    );
}

export default function BookingsPanel({ orderStages = [] }) {
    const [processing, setProcessing] = useState(false);

    const saveStage = (stage, payload) => {
        setProcessing(true);
        router.put(pathFrom(updateStage.url(stage.label)), payload, {
            preserveScroll: true,
            onSuccess: () => toast.success("Stage updated"),
            onError: () => toast.error("Could not update stage"),
            onFinish: () => setProcessing(false),
        });
    };

    const saveStatus = (status, payload) => {
        setProcessing(true);
        router.put(pathFrom(updateStatus.url(status.id)), payload, {
            preserveScroll: true,
            onSuccess: () => toast.success("Status updated"),
            onError: () => toast.error("Could not update status"),
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-base font-semibold text-foreground">Booking lifecycle</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Stages and statuses are fixed. You can rename titles and change colors only.
                    Optional balloting is configured per project.
                </p>
            </div>

            <div className="space-y-4">
                {(orderStages || []).map((stage) => (
                    <div
                        key={stage.id}
                        className="rounded-md border border-border bg-card p-4"
                    >
                        <div className="flex flex-wrap items-center gap-3">
                            <ColorSwatch
                                value={stage.color}
                                onChange={(color) =>
                                    !processing && saveStage(stage, { title: stage.title, color })
                                }
                            />
                            <EditableTitle
                                value={stage.title}
                                onSave={(title) =>
                                    !processing && saveStage(stage, { title, color: stage.color })
                                }
                            />
                            <span className="text-xs text-muted-foreground">
                                {stage.label} · {formatOrderCount(stage.orders_count)}
                            </span>
                        </div>

                        <div className="mt-4 space-y-2 border-t border-border pt-3">
                            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                <Icon name="price-tag-3-line" className="size-3.5" />
                                Statuses
                            </div>
                            {(stage.statuses || []).map((status) => (
                                <div
                                    key={status.id}
                                    className="flex flex-wrap items-center gap-3 rounded-md bg-muted/40 px-3 py-2"
                                >
                                    <ColorSwatch
                                        value={status.color}
                                        label="Change status color"
                                        onChange={(color) =>
                                            !processing &&
                                            saveStatus(status, {
                                                title: status.title,
                                                color,
                                            })
                                        }
                                    />
                                    <EditableTitle
                                        value={status.title}
                                        onSave={(title) =>
                                            !processing &&
                                            saveStatus(status, {
                                                title,
                                                color: status.color,
                                            })
                                        }
                                    />
                                    <span className="text-xs text-muted-foreground">{status.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

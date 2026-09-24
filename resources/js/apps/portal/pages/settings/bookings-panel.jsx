import { useEffect, useState } from "react";
import { router } from "@inertiajs/react";
import { BlockPicker } from "react-color";
import { toast } from "sonner";
import { update as updateStage } from "@/actions/App/Http/Controllers/Portal/OrderStageController";
import { update as updateStatus } from "@/actions/App/Http/Controllers/Portal/OrderStatusController";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import BookingDocumentTypesSection from "./booking-document-types-section";
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

function ColorSwatch({ value, onChange, disabled = false, label = "Change color" }) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                disabled={disabled}
                aria-label={label}
                className={cn(
                    "size-3 shrink-0 rounded-full ring-2 ring-background transition-transform hover:scale-110",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    disabled && "pointer-events-none opacity-50",
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

function CatalogCard({ row, countLabel, processing, onSave }) {
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(row.title);

    useEffect(() => {
        if (!editing) {
            setTitle(row.title);
        }
    }, [row.title, editing]);

    const commitTitle = () => {
        const next = title.trim();

        setEditing(false);

        if (!next || next === row.title) {
            setTitle(row.title);
            return;
        }

        onSave(row, { title: next, color: row.color });
    };

    return (
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-3 shadow-xs transition-shadow hover:border-border hover:shadow-sm">
            <ColorSwatch
                value={row.color}
                disabled={processing}
                onChange={(color) => onSave(row, { title: row.title, color })}
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
                                setTitle(row.title);
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
                        {row.title}
                    </button>
                )}

                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {countLabel}
                </span>
            </div>
        </div>
    );
}

function CatalogSection({ title, hint, rows, countLabel, processing, onSave }) {
    return (
        <section className="space-y-4">
            <div>
                <h3 className="text-base font-bold tracking-tight text-foreground">{title}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
            </div>

            <div className="space-y-2">
                {(rows || []).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">
                        No items yet.
                    </div>
                ) : (
                    (rows || []).map((row) => (
                        <CatalogCard
                            key={row.id}
                            row={row}
                            countLabel={countLabel(row)}
                            processing={processing}
                            onSave={onSave}
                        />
                    ))
                )}
            </div>
        </section>
    );
}

export default function BookingsPanel({
    orderStages = [],
    orderStatuses = [],
    bookingDocumentTypes = [],
}) {
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
        <div className="space-y-8">
            <CatalogSection
                title="Booking stages"
                hint="Lifecycle steps for every booking file. Titles and colors can be renamed; stages are fixed."
                rows={orderStages}
                countLabel={(row) => formatOrderCount(row.orders_count)}
                onSave={saveStage}
                processing={processing}
            />

            <CatalogSection
                title="Booking statuses"
                hint="Status labels apply independently of stage. Titles and colors can be renamed."
                rows={orderStatuses}
                countLabel={(row) => formatOrderCount(row.orders_count)}
                onSave={saveStatus}
                processing={processing}
            />

            <BookingDocumentTypesSection bookingDocumentTypes={bookingDocumentTypes} />
        </div>
    );
}

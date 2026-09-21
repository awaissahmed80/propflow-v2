import { useEffect, useMemo, useState } from "react";
import { Link, router, usePage } from "@inertiajs/react";
import { toast } from "sonner";
import { cancel } from "@/actions/App/Http/Controllers/Portal/OrderController";
import { store as storeOrderActivity } from "@/actions/App/Http/Controllers/Portal/OrderActivityController";
import {
    payment,
    paymentVoucher,
    ledgerPdf,
    ledgerPreview,
    showBookingForm as bookingForm,
} from "@/actions/App/Http/Controllers/Portal/DealController";
import { FileManagerPicker } from "@/components/file-manager-picker";
import { FilePreview, FilePreviewTile } from "@/components/file-preview";
import { ComboBox } from "@/components/ui/combo-box";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { ContactCard, LeadCard, UserCard } from "@/components/ui/entity-card";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/currency";
import { formatDateTime, formatRelativeTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import {
    resolveBookingStages,
    stageTitle,
    statusTitle,
    statusColor,
    BookingStageDialog,
} from "./booking-stage-dialogs";
import { BookingAssigneeMenu, BookingProjectMenu } from "./booking-assignment-menus";

function pathFrom(url) {
    const raw = String(url || "/");

    if (raw.startsWith("//") || raw.startsWith("http://") || raw.startsWith("https://")) {
        try {
            return new URL(raw.startsWith("//") ? `https:${raw}` : raw).pathname || "/";
        } catch {
            return "/";
        }
    }

    return raw.startsWith("/") ? raw : `/${raw}`;
}

const FALLBACK_PAYMENT_METHODS = ["Cash", "Pay order", "Cheque", "Bank transfer"];

const ACTIVITY_ICONS = {
    Call: "phone-line",
    Meeting: "team-line",
    "Site Visit": "map-pin-line",
    Email: "mail-line",
    Message: "chat-1-line",
    "WhatsApp Call": "whatsapp-line",
    "WhatsApp Message": "whatsapp-line",
    Note: "sticky-note-line",
    "Booking created": "file-add-line",
    "Booking verified": "checkbox-circle-line",
    "Payment recorded": "money-dollar-circle-line",
};

const PANEL_TABS = [
    ["overview", "Overview"],
    ["activity", "Activity"],
    ["installments", "Installments"],
    ["payments", "Payments"],
];

const UPDATE_PLACEHOLDER = "Record a note or update on this booking...";

function actionTitles(items = []) {
    return items
        .map((item) => (typeof item === "string" ? item : item?.title))
        .filter(Boolean);
}

function actionIcon(title, items = []) {
    const match = items.find((item) => item?.title === title);

    return match?.icon || ACTIVITY_ICONS[title] || null;
}

function paymentMethodOptions(deal) {
    const fromDeal = Array.isArray(deal?.payment_methods) ? deal.payment_methods : [];

    return Array.from(new Set([...fromDeal, ...FALLBACK_PAYMENT_METHODS].filter(Boolean)));
}

function emptyPaymentForm(deal) {
    const methods = paymentMethodOptions(deal);

    return {
        amount: null,
        method: methods[0] || "Cash",
        reference: "",
        paid_on: new Date().toISOString().slice(0, 10),
        receipt: null,
    };
}

function stageIndex(stageId, stages) {
    if (stageId === "closed" || stageId === "completed" || stageId === "cancelled") {
        const closed = stages.findIndex((item) => item.id === "closed");

        return closed < 0 ? stages.length : closed;
    }

    const index = stages.findIndex((item) => item.id === stageId);

    return index < 0 ? 0 : index;
}

function StageProgress({ stages, currentStage, color }) {
    const current = stageIndex(currentStage, stages);
    const label = stages[Math.min(current, stages.length - 1)]?.label || "Token";

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-medium text-foreground">{label}</p>
                <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {Math.min(current + 1, stages.length)}/{stages.length}
                </p>
            </div>
            <div className="flex items-center gap-1">
                {stages.map((item, index) => {
                    const done = index < current;
                    const active = index === current;

                    return (
                        <span
                            key={item.id}
                            title={item.label}
                            className={cn(
                                "h-1.5 min-w-0 flex-1 rounded-full",
                                !done && !active && "bg-border",
                            )}
                            style={
                                done || active
                                    ? { backgroundColor: color || "var(--primary)" }
                                    : undefined
                            }
                        />
                    );
                })}
            </div>
        </div>
    );
}

function primaryActionsFor({ stage, status, deal, cancelled, closed }) {
    if (cancelled || closed) {
        return [];
    }

    const actions = [];

    if (stage === "token" && status !== "verified") {
        actions.push({ id: "verify", label: "Verify token" });
    }

    if (stage === "token" && (status === "verified" || deal?.booking?.verified_at)) {
        actions.push({ id: "enter_kyc", label: "Enter Booking & KYC" });
    }

    if (stage === "booking_kyc") {
        actions.push({ id: "plan", label: "Set payment plan" });
    }

    if (stage === "active") {
        actions.push({ id: "payment", label: "Record payment" });

        if (deal?.balloting_enabled && !deal?.booking?.balloted_at) {
            actions.push({ id: "ballot", label: "Record balloting", variant: "outline" });
        }

        actions.push({ id: "transfer", label: "Transfer", variant: "outline" });
        actions.push({
            id: "litigation",
            label: status === "litigation" ? "Clear litigation" : "Set litigation",
            variant: "outline",
        });

        if (Number(deal?.ledger?.total_outstanding) <= 0) {
            if (deal?.handover_ready_at) {
                actions.push({ id: "deliver", label: "Complete / handover" });
            } else {
                actions.push({ id: "handover", label: "Ready for handover", variant: "outline" });
            }
        }
    }

    return actions;
}

function ActivityAttachments({ files }) {
    const [open, setOpen] = useState(false);
    const [index, setIndex] = useState(0);

    return (
        <>
            <div className="mt-2 flex flex-wrap gap-2">
                {files.map((file, fileIndex) => (
                    <FilePreviewTile
                        key={`${file.kind}-${file.id}`}
                        file={file}
                        onPreview={() => {
                            setIndex(fileIndex);
                            setOpen(true);
                        }}
                    />
                ))}
            </div>
            <FilePreview
                open={open}
                onOpenChange={setOpen}
                files={files}
                index={index}
                onIndexChange={setIndex}
            />
        </>
    );
}

function ActivityRow({ entry, activityTypes = [] }) {
    const system = entry.type === "LOG";
    const icon =
        actionIcon(entry.action, activityTypes) ||
        ACTIVITY_ICONS[entry.action] ||
        (system ? "history-line" : "checkbox-circle-line");
    const actor = entry.user?.display_name;
    const files = [
        ...(entry.media || []).map((file) => ({ ...file, kind: "media" })),
        ...(entry.documents || []).map((file) => ({ ...file, kind: "document" })),
    ];

    return (
        <div className="flex gap-3 rounded-xl border border-border/80 bg-background px-3 py-3">
            <span
                className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    system ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
                )}
            >
                <Icon name={icon} className="text-base" />
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <p className="text-sm font-semibold text-foreground">{entry.action}</p>
                    {entry.stage_label ? (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {entry.stage_label}
                        </span>
                    ) : null}
                </div>
                {entry.comments ? (
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {entry.comments}
                    </p>
                ) : null}
                {files.length > 0 ? <ActivityAttachments files={files} /> : null}
                <p className="mt-1.5 text-xs text-muted-foreground">
                    {[actor, formatRelativeTime(entry.created_at)].filter(Boolean).join(" · ")}
                </p>
            </div>
        </div>
    );
}

function ActivityComposer({ orderCode, activityTypes = [], locked = false }) {
    const titles = useMemo(() => actionTitles(activityTypes), [activityTypes]);
    const defaultActivity = titles[0] || "Note";
    const [expanded, setExpanded] = useState(false);
    const [activityType, setActivityType] = useState(defaultActivity);
    const [notes, setNotes] = useState("");
    const [attachments, setAttachments] = useState([]);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    const reset = () => {
        setExpanded(false);
        setActivityType(defaultActivity);
        setNotes("");
        setAttachments([]);
        setPickerOpen(false);
        setPreviewOpen(false);
        setSubmitting(false);
    };

    useEffect(() => {
        reset();
    }, [orderCode, defaultActivity]);

    const submitUpdate = () => {
        if (locked || !notes.trim() || submitting) {
            return;
        }

        setSubmitting(true);

        router.post(
            pathFrom(storeOrderActivity.url(orderCode)),
            {
                action: activityType,
                comments: notes.trim(),
                media_ids: attachments
                    .filter((file) => file.kind === "media")
                    .map((file) => file.id),
                document_ids: attachments
                    .filter((file) => file.kind === "document")
                    .map((file) => file.id),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success("Update recorded");
                    reset();
                },
                onError: (errors) => {
                    toast.error(
                        errors.comments || errors.action || "Could not save update",
                    );
                    setSubmitting(false);
                },
                onFinish: () => setSubmitting(false),
            },
        );
    };

    if (locked) {
        return (
            <div className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                Updates are paused on closed bookings.
            </div>
        );
    }

    if (!expanded) {
        return (
            <button
                type="button"
                onClick={() => setExpanded(true)}
                className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left transition-colors hover:bg-muted/40"
            >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Icon name="add-line" className="text-lg" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">Log an update</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {UPDATE_PLACEHOLDER}
                    </span>
                </span>
            </button>
        );
    }

    return (
        <div className="space-y-3 rounded-xl border border-border px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">What&apos;s Done</span>
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2.5 py-1 font-medium transition-colors hover:bg-muted/70"
                                >
                                    {activityType}
                                    <Icon name="arrow-down-s-line" className="text-sm text-muted-foreground" />
                                </button>
                            }
                        />
                        <DropdownMenuContent align="start" className="w-auto min-w-40">
                            {titles.map((type) => (
                                <DropdownMenuItem
                                    key={type}
                                    disabled={activityType === type}
                                    className="whitespace-nowrap"
                                    onClick={() => setActivityType(type)}
                                >
                                    {type}
                                    {activityType === type ? (
                                        <Icon name="check-line" className="ml-auto text-sm" />
                                    ) : null}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div className="flex items-center gap-1.5">
                    <IconButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        icon="attachment-2"
                        aria-label="Attach file"
                        onClick={() => setPickerOpen(true)}
                    />
                    <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={reset}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        loading={submitting}
                        disabled={!notes.trim()}
                        onClick={submitUpdate}
                    >
                        Submit
                    </Button>
                </div>
            </div>

            <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={UPDATE_PLACEHOLDER}
                rows={3}
                autoFocus
                className="min-h-20 resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
            />

            {attachments.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {attachments.map((file, fileIndex) => {
                        const image =
                            file.kind === "media" ||
                            String(file.type || "").startsWith("image/");

                        return (
                            <span
                                key={`${file.kind}-${file.id}`}
                                className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-background py-1 pr-1 pl-1.5 text-xs text-foreground"
                            >
                                <button
                                    type="button"
                                    className="inline-flex min-w-0 items-center gap-1.5"
                                    aria-label={`Preview ${file.name || "file"}`}
                                    onClick={() => {
                                        setPreviewIndex(fileIndex);
                                        setPreviewOpen(true);
                                    }}
                                >
                                    {image && (file.thumbnail_url || file.url) ? (
                                        <img
                                            src={file.thumbnail_url || file.url}
                                            alt=""
                                            className="size-8 rounded-sm object-cover"
                                        />
                                    ) : (
                                        <Icon
                                            name="file-text-line"
                                            className="shrink-0 text-sm text-muted-foreground"
                                        />
                                    )}
                                    <span className="max-w-40 truncate">{file.name}</span>
                                </button>
                                <IconButton
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    icon="close-line"
                                    aria-label="Remove attachment"
                                    onClick={() =>
                                        setAttachments((current) =>
                                            current.filter(
                                                (item) =>
                                                    !(item.id === file.id && item.kind === file.kind),
                                            ),
                                        )
                                    }
                                />
                            </span>
                        );
                    })}
                </div>
            ) : null}

            <FilePreview
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                files={attachments}
                index={previewIndex}
                onIndexChange={setPreviewIndex}
            />
            <FileManagerPicker
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                value={attachments}
                onApply={setAttachments}
            />
        </div>
    );
}

function ActivityTab({ order, deal, stages, activityTypes = [], locked = false }) {
    const [stageFilter, setStageFilter] = useState("all");
    const entries = deal?.activities || [];
    const filtered = useMemo(() => {
        if (stageFilter === "all") {
            return entries;
        }

        return entries.filter((entry) => entry.stage === stageFilter);
    }, [entries, stageFilter]);

    return (
        <section className="space-y-4">
            <ActivityComposer
                orderCode={order.code}
                activityTypes={activityTypes}
                locked={locked}
            />

            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                <button
                    type="button"
                    onClick={() => setStageFilter("all")}
                    className={cn(
                        "inline-flex shrink-0 items-center rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                        stageFilter === "all"
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground",
                    )}
                >
                    All
                </button>
                {stages.map((stage) => (
                    <button
                        key={stage.id}
                        type="button"
                        onClick={() => setStageFilter(stage.id)}
                        className={cn(
                            "inline-flex shrink-0 items-center rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                            stageFilter === stage.id
                                ? "border-primary/40 bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {stage.label}
                    </button>
                ))}
            </div>

            {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
                    No activity yet.
                </div>
            ) : (
                <ol className="space-y-3">
                    {filtered.map((entry) => (
                        <li key={entry.id}>
                            <ActivityRow entry={entry} activityTypes={activityTypes} />
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}

function InstallmentsTab({ order, deal }) {
    const installments = deal?.installments || [];
    const totals = deal?.installment_totals || {};
    const ledgerHref = pathFrom(ledgerPreview.url(order.code));
    const ledgerPdfHref = pathFrom(ledgerPdf.url(order.code));

    return (
        <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                        {deal?.plan?.title || "Payment plan"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {deal?.plan?.summary ||
                            (deal?.plan
                                ? `${deal.plan.frequency || "Monthly"} · ${deal.plan.installment_count || 0} installments`
                                : "No payment plan set yet.")}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <a
                        href={ledgerHref}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-medium text-primary hover:underline"
                    >
                        Preview
                    </a>
                    <a
                        href={ledgerPdfHref}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-medium text-primary hover:underline"
                    >
                        Print / Download PDF
                    </a>
                </div>
            </div>

            {installments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
                    No installment schedule yet. Set the payment plan to generate rows.
                </div>
            ) : (
                <ul className="overflow-hidden rounded-xl border border-border/80">
                    {installments.map((row, index) => {
                        const isPaid = String(row.status || "").toLowerCase() === "paid";

                        return (
                            <li
                                key={row.id || row.sequence}
                                className={cn(
                                    "flex min-w-0 items-center gap-2.5 px-3 py-2.5",
                                    index > 0 && "border-t border-border/60",
                                )}
                            >
                                <span
                                    className={cn(
                                        "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                                        isPaid
                                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                            : row.overdue
                                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                              : "bg-muted text-muted-foreground",
                                    )}
                                >
                                    {isPaid ? (
                                        <Icon name="check-line" className="text-xs" />
                                    ) : (
                                        row.sequence || index + 1
                                    )}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-foreground">
                                        {row.label}
                                    </p>
                                    <p className="truncate text-[11px] text-muted-foreground">
                                        {row.due_on || "No due date"} · {row.status}
                                        {row.overdue ? " · overdue" : ""}
                                    </p>
                                </div>
                                <div className="shrink-0 text-right">
                                    <p className="text-sm font-semibold tabular-nums">
                                        {formatMoney(row.amount)}
                                    </p>
                                    {isPaid && (row.receipt_url || row.voucher_url) ? (
                                        <a
                                            href={row.receipt_url || row.voucher_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[11px] font-medium text-primary hover:underline"
                                        >
                                            Receipt
                                        </a>
                                    ) : null}
                                    {!isPaid && row.pay_voucher_url ? (
                                        <a
                                            href={row.pay_voucher_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[11px] font-medium text-primary hover:underline"
                                        >
                                            Pay voucher
                                        </a>
                                    ) : null}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/80 p-3 text-xs sm:grid-cols-3">
                <div>
                    <p className="text-muted-foreground">Scheduled</p>
                    <p className="font-semibold tabular-nums text-foreground">
                        {formatMoney(totals.scheduled)}
                    </p>
                </div>
                <div>
                    <p className="text-muted-foreground">Paid</p>
                    <p className="font-semibold tabular-nums text-foreground">
                        {formatMoney(totals.paid)}
                    </p>
                </div>
                <div>
                    <p className="text-muted-foreground">Outstanding</p>
                    <p className="font-semibold tabular-nums text-foreground">
                        {formatMoney(totals.outstanding)}
                    </p>
                </div>
            </div>
        </section>
    );
}

function PaymentsTab({ order, deal, canRecord, onOpenPlan }) {
    const { errors } = usePage().props;
    const methods = paymentMethodOptions(deal);
    const [form, setForm] = useState(() => emptyPaymentForm(deal));
    const payments = [...(deal?.payments || [])].sort((left, right) => right.id - left.id);

    const submit = (event) => {
        event.preventDefault();
        router.post(pathFrom(payment.url(order.code)), form, {
            preserveScroll: true,
            preserveState: true,
            forceFormData: form.receipt instanceof File,
            onSuccess: () => {
                toast.success("Payment recorded");
                setForm(emptyPaymentForm(deal));
            },
            onError: (formErrors) => {
                toast.error(Object.values(formErrors)[0] || "Unable to record payment");
            },
        });
    };

    return (
        <section className="space-y-3">
            {canRecord && deal?.plan ? (
                <form className="space-y-3 rounded-xl border border-border/80 p-3" onSubmit={submit}>
                    <p className="text-sm text-muted-foreground">
                        Outstanding {formatMoney(deal?.ledger?.total_outstanding)} · Paid{" "}
                        {formatMoney(deal?.ledger?.total_paid)}
                    </p>
                    <NumberInput
                        label="Amount"
                        required
                        min={0.01}
                        step={0.01}
                        allowDecimal
                        value={form.amount}
                        error={errors.amount}
                        onChange={(value) => setForm((current) => ({ ...current, amount: value }))}
                    />
                    <ComboBox
                        label="Method"
                        required
                        value={form.method}
                        options={methods}
                        placeholder="Cash, Pay order..."
                        error={errors.method}
                        onValueChange={(value) =>
                            setForm((current) => ({
                                ...current,
                                method: value || methods[0] || "Cash",
                            }))
                        }
                    />
                    <DatePicker
                        label="Paid on"
                        required
                        value={form.paid_on}
                        error={errors.paid_on}
                        onChange={(value) => setForm((current) => ({ ...current, paid_on: value }))}
                    />
                    <Input
                        label="Reference"
                        value={form.reference}
                        error={errors.reference}
                        onChange={(event) =>
                            setForm((current) => ({ ...current, reference: event.target.value }))
                        }
                    />
                    <div className="space-y-1.5">
                        <p className="text-label font-medium text-muted-foreground">Proof of payment</p>
                        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors hover:bg-muted/40">
                            <Icon name="upload-2-line" className="shrink-0 text-base text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate text-foreground">
                                {form.receipt?.name || "Upload an image or PDF"}
                            </span>
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,application/pdf"
                                className="sr-only"
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        receipt: event.target.files?.[0] || null,
                                    }))
                                }
                            />
                        </label>
                        {errors.receipt ? (
                            <p className="text-[13px] text-destructive">{errors.receipt}</p>
                        ) : null}
                    </div>
                    {errors.order ? <p className="text-sm text-destructive">{errors.order}</p> : null}
                    <Button type="submit" className="w-full">
                        Record payment
                    </Button>
                </form>
            ) : null}

            {canRecord && !deal?.plan ? (
                <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center">
                    <p className="text-sm text-muted-foreground">
                        Set a payment plan before recording a payment.
                    </p>
                    <Button type="button" size="sm" className="mt-3" onClick={onOpenPlan}>
                        Set payment plan
                    </Button>
                </div>
            ) : null}

            {payments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
                    No payments recorded yet.
                </div>
            ) : (
                <ul className="overflow-hidden rounded-xl border border-border/80">
                    {payments.map((row, index) => (
                        <li
                            key={row.id}
                            className={cn(
                                "flex min-w-0 items-center gap-3 px-3 py-2.5",
                                index > 0 && "border-t border-border/60",
                            )}
                        >
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-foreground">
                                    {row.method || "Payment"}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                    {row.paid_on || "No date"}
                                    {row.reference ? ` · ${row.reference}` : ""}
                                </p>
                            </div>
                            <div className="shrink-0 text-right">
                                <p className="text-sm font-semibold tabular-nums">
                                    {formatMoney(row.amount)}
                                </p>
                                <div className="mt-0.5 flex items-center justify-end gap-2">
                                    <a
                                        href={
                                            row.voucher_url ||
                                            paymentVoucher.url({
                                                order: order.code,
                                                payment: row.id,
                                            })
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[11px] font-medium text-primary hover:underline"
                                    >
                                        Receipt
                                    </a>
                                    {row.receipt_url ? (
                                        <a
                                            href={row.receipt_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[11px] font-medium text-muted-foreground hover:underline"
                                        >
                                            Proof
                                        </a>
                                    ) : null}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

export default function BookingDetailPanel({
    payload,
    orderStages = [],
    projects = [],
    assignees = [],
    activityTypes = [],
    onClose,
}) {
    const order = payload?.order;
    const deal = payload?.deal;
    const stages = resolveBookingStages(orderStages);
    const [tab, setTab] = useState("overview");
    const [dialogAction, setDialogAction] = useState(null);

    const stage = deal?.stage || order?.stage || "token";
    const status = deal?.status || order?.status || "hold";
    const cancelled = status === "cancelled";
    const closed = stage === "closed" || status === "completed" || status === "cancelled";
    const completed = status === "completed";
    const stageColor =
        statusColor(status, stage, orderStages) ||
        (orderStages || []).find((item) => item.label === stage)?.color ||
        stages.find((item) => item.id === stage)?.color ||
        "var(--primary)";
    const statusLabel = statusTitle(status, stage, orderStages);

    const leadHref = order?.lead?.code ? `/leads?lead=${order.lead.code}` : null;
    const actions = useMemo(
        () => primaryActionsFor({ stage, status, deal, cancelled, closed }),
        [stage, status, deal, cancelled, closed],
    );

    if (!order) {
        return null;
    }

    const handleCancel = () => {
        if (
            !window.confirm(
                `Cancel the booking for ${order.contact?.display_name || "this buyer"}? The unit will be released.`,
            )
        ) {
            return;
        }

        router.post(
            pathFrom(cancel.url(order.code)),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success("Booking cancelled");
                    onClose?.();
                },
                onError: () => toast.error("Unable to cancel booking"),
            },
        );
    };

    const paid = Number(deal?.ledger?.total_paid) || 0;
    const outstanding = Number(deal?.ledger?.total_outstanding) || 0;
    const collectionTotal = paid + outstanding;
    const collectionPct =
        collectionTotal > 0 ? Math.min(100, Math.round((paid / collectionTotal) * 100)) : 0;

    return (
        <div className="flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden bg-card">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                    <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: stageColor }}
                        aria-hidden
                    />
                    {statusLabel ? (
                        <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
                            style={{
                                backgroundColor: `${stageColor}22`,
                                color: stageColor,
                            }}
                        >
                            {statusLabel}
                        </span>
                    ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <Button type="button" size="sm" variant="outline" className="max-w-36 gap-1">
                                    <span className="truncate">{stageTitle(stage, orderStages)}</span>
                                    <Icon name="arrow-down-s-line" className="shrink-0 opacity-60" />
                                </Button>
                            }
                        />
                        <DropdownMenuContent align="end" className="min-w-44">
                            {stages.map((item) => (
                                <DropdownMenuItem
                                    key={item.id}
                                    disabled={cancelled || closed || item.id === stage}
                                    className={cn(item.id === stage && "bg-accent")}
                                >
                                    {item.label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <IconButton
                        type="button"
                        size="sm"
                        className="rounded-full"
                        icon="close-line"
                        aria-label="Close"
                        variant="ghost"
                        onClick={onClose}
                    />
                </div>
            </div>

            <div className="shrink-0 space-y-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold tracking-tight text-foreground">
                        {order.contact?.display_name || "Booking"}
                    </h2>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {order.unit?.name || "No unit linked"}
                    </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <BookingProjectMenu order={order} projects={projects} />
                    <BookingAssigneeMenu order={order} assignees={assignees} />
                </div>
                <StageProgress stages={stages} currentStage={stage} color={stageColor} />
            </div>

            <div className="flex shrink-0 flex-wrap gap-1 border-b border-border px-4 py-2">
                {PANEL_TABS.map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setTab(id)}
                        className={cn(
                            "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                            tab === id
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-4 px-4 py-4">
                    {tab === "overview" ? (
                        <>
                            {actions.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                    {actions.map((action, index) => (
                                        <Button
                                            key={action.id}
                                            type="button"
                                            variant={action.variant || (index === 0 ? "default" : "outline")}
                                            className="w-full"
                                            onClick={() => setDialogAction(action.id)}
                                        >
                                            {action.label}
                                        </Button>
                                    ))}
                                </div>
                            ) : null}

                            <section className="rounded-xl border border-border/80 p-3">
                                <div className="mb-3 flex items-center justify-between gap-2">
                                    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                        Deal
                                    </h3>
                                    <span className="truncate text-[11px] font-medium capitalize text-muted-foreground">
                                        {order.booking_kind || "—"}
                                    </span>
                                </div>
                                <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
                                    <div className="min-w-0">
                                        <dt className="text-[11px] text-muted-foreground">Sale amount</dt>
                                        <dd className="truncate text-sm font-semibold tabular-nums">
                                            {formatMoney(order.agreed_price)}
                                        </dd>
                                    </div>
                                    <div className="min-w-0">
                                        <dt className="text-[11px] text-muted-foreground">Booked</dt>
                                        <dd className="truncate text-sm font-medium">
                                            {formatDateTime(order.booked_at) || "—"}
                                        </dd>
                                    </div>
                                </dl>
                                {deal?.ledger ? (
                                    <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
                                        <div className="flex items-center justify-between gap-2 text-xs">
                                            <span className="text-muted-foreground">
                                                Paid{" "}
                                                <span className="font-semibold tabular-nums text-foreground">
                                                    {formatMoney(paid)}
                                                </span>
                                            </span>
                                            <span className="text-muted-foreground">
                                                Due{" "}
                                                <span className="font-semibold tabular-nums text-foreground">
                                                    {formatMoney(outstanding)}
                                                </span>
                                            </span>
                                        </div>
                                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                            <div
                                                className="h-full rounded-full bg-emerald-500"
                                                style={{ width: `${collectionPct}%` }}
                                            />
                                        </div>
                                    </div>
                                ) : null}
                            </section>

                            <section className="rounded-xl border border-border/80 p-3">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                        Payment plan
                                    </h3>
                                    {deal?.plan ? (
                                        <button
                                            type="button"
                                            className="text-[11px] font-medium text-primary hover:underline"
                                            onClick={() => setTab("installments")}
                                        >
                                            View schedule
                                        </button>
                                    ) : null}
                                </div>
                                {deal?.plan ? (
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-foreground">
                                            {deal.plan.title || "Payment plan"}
                                        </p>
                                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                                            {deal.plan.summary ||
                                                `${deal.plan.frequency || "Monthly"} · ${deal.plan.installment_count || 0} installments`}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No payment plan set yet.
                                    </p>
                                )}
                            </section>

                            {deal?.balloting_enabled ? (
                                <section className="rounded-xl border border-border/80 p-3">
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                            Balloting
                                        </h3>
                                        {deal?.booking?.balloted_at ? (
                                            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                                                Confirmed
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                className="text-[11px] font-medium text-primary hover:underline"
                                                onClick={() => setDialogAction("ballot")}
                                            >
                                                Record plot
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {deal?.booking?.balloted_at
                                            ? `Plot ${deal.booking.plot_or_file || "—"} · ${deal.booking.dimensions || "—"}`
                                            : "Balloting is enabled for this project. Record the plot once allotted."}
                                    </p>
                                </section>
                            ) : null}

                            {(deal?.transfers || []).length > 0 ? (
                                <section className="rounded-xl border border-border/80 p-3">
                                    <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                        Transfer history
                                    </h3>
                                    <ul className="space-y-2 text-sm">
                                        {deal.transfers.map((row) => (
                                            <li
                                                key={row.id}
                                                className="rounded-lg border border-border/70 px-3 py-2"
                                            >
                                                {row.from || "Previous buyer"} → {row.to || "New buyer"}
                                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                                    Outstanding {formatMoney(row.outstanding)} ·{" "}
                                                    {row.ndc_cleared ? "NDC cleared" : "NDC outstanding"}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            ) : null}

                            <section className="space-y-2">
                                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                    People
                                </h3>
                                <div className="grid grid-cols-1 gap-2">
                                    <LeadCard lead={order.lead} href={leadHref} size="sm" />
                                    <ContactCard contact={order.contact} size="sm" />
                                    <UserCard user={order.assignee} label="Operations" size="sm" />
                                    <UserCard user={order.sold_by} label="Sales" size="sm" />
                                </div>
                            </section>

                            {leadHref ? (
                                <Link
                                    href={leadHref}
                                    className="flex items-center justify-between gap-2 rounded-xl border border-border/80 px-3 py-2.5 text-sm transition-colors hover:bg-muted/40"
                                >
                                    <span className="min-w-0 truncate text-muted-foreground">
                                        Open linked lead
                                    </span>
                                    <Icon
                                        name="arrow-right-s-line"
                                        className="shrink-0 text-muted-foreground"
                                    />
                                </Link>
                            ) : null}
                        </>
                    ) : null}

                    {tab === "activity" ? (
                        <ActivityTab
                            order={order}
                            deal={deal}
                            stages={stages}
                            activityTypes={activityTypes}
                            locked={cancelled || completed}
                        />
                    ) : null}

                    {tab === "installments" ? (
                        <InstallmentsTab order={order} deal={deal} />
                    ) : null}

                    {tab === "payments" ? (
                        <PaymentsTab
                            order={order}
                            deal={deal}
                            canRecord={!cancelled && !closed}
                            onOpenPlan={() => setDialogAction("plan")}
                        />
                    ) : null}
                </div>
            </ScrollArea>

            <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-4 py-3">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(pathFrom(bookingForm.url(order.code)), "_blank")}
                >
                    Print form
                </Button>
                {!cancelled && !closed ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={handleCancel}
                    >
                        Cancel booking
                    </Button>
                ) : null}
            </div>

            <BookingStageDialog
                open={Boolean(dialogAction)}
                onOpenChange={(next) => {
                    if (!next) {
                        setDialogAction(null);
                    }
                }}
                action={dialogAction}
                order={order}
                deal={deal}
            />
        </div>
    );
}

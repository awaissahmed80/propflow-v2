import { useEffect, useMemo, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import { toast } from "sonner";
import {
    ballot,
    storeBooking as booking,
    deliver,
    enterBookingKyc,
    handover,
    litigation,
    payment,
    plan,
    transfer,
} from "@/actions/App/Http/Controllers/Portal/DealController";
import { Button } from "@/components/ui/button";
import { ComboBox } from "@/components/ui/combo-box";
import { DatePicker } from "@/components/ui/date-picker";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { SelectBox } from "@/components/ui/select";
import { Icon } from "@/components/ui/icon";
import { formatMoney } from "@/lib/currency";

const FALLBACK_PAYMENT_METHODS = ["Cash", "Pay order", "Cheque", "Bank transfer"];

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

function post(url, data, success, onDone) {
    router.post(pathFrom(url), data, {
        preserveScroll: true,
        forceFormData: data instanceof FormData || data?.receipt instanceof File,
        onSuccess: () => {
            toast.success(success);
            onDone?.();
        },
        onError: (errors) => toast.error(Object.values(errors)[0] || "Unable to update this booking"),
    });
}

function paymentMethodOptions(deal) {
    const fromDeal = Array.isArray(deal?.payment_methods) ? deal.payment_methods : [];

    return Array.from(new Set([...fromDeal, ...FALLBACK_PAYMENT_METHODS].filter(Boolean)));
}

export const FALLBACK_BOOKING_STAGES = [
    { id: "token", label: "Token" },
    { id: "booking_kyc", label: "Booking & KYC" },
    { id: "active", label: "Active" },
    { id: "closed", label: "Closed" },
];

/** @deprecated Prefer resolveBookingStages(orderStages) */
export const BOOKING_STAGES = FALLBACK_BOOKING_STAGES;

export function resolveBookingStages(orderStages = []) {
    const rows = (orderStages || [])
        .filter((stage) => stage && stage.label)
        .filter((stage) => stage.is_enabled !== false)
        .map((stage) => ({
            id: stage.label,
            label: stage.title || stage.label,
            color: stage.color || null,
            statuses: stage.statuses || [],
        }));

    return rows.length > 0 ? rows : FALLBACK_BOOKING_STAGES;
}

export function stageTitle(stage, orderStages = []) {
    const match = (orderStages || []).find((item) => item.label === stage || item.id === stage);

    if (match?.title || match?.label) {
        return match.title || match.label;
    }

    return FALLBACK_BOOKING_STAGES.find((item) => item.id === stage)?.label || stage || "Token";
}

export function statusTitle(status, stage, orderStages = []) {
    if (!status) {
        return null;
    }

    const stageRow = (orderStages || []).find((item) => item.label === stage || item.id === stage);
    const nested = (stageRow?.statuses || []).find((item) => item.label === status);

    if (nested?.title) {
        return nested.title;
    }

    return String(status)
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

export function statusColor(status, stage, orderStages = []) {
    const stageRow = (orderStages || []).find((item) => item.label === stage || item.id === stage);
    const nested = (stageRow?.statuses || []).find((item) => item.label === status);

    return nested?.color || stageRow?.color || null;
}

export function BookingStageDialog({ open, onOpenChange, action, order, deal }) {
    const { errors = {} } = usePage().props;

    if (!action || !order) {
        return null;
    }

    const title =
        {
            verify: "Verify token",
            booking: "Verify token",
            enter_kyc: "Enter Booking & KYC",
            plan: "Set payment plan",
            tracking: "Record payment",
            payment: "Record payment",
            ballot: "Record balloting",
            transfer: "Transfer file",
            litigation: "Litigation",
            handover: "Ready for handover",
            deliver: "Complete booking",
        }[action] || "Update booking";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        {order.contact?.display_name || "Booking"}
                        {order.unit?.name ? ` · ${order.unit.name}` : ""}
                        {deal?.net_price != null ? ` · Net ${formatMoney(deal.net_price)}` : ""}
                    </DialogDescription>
                </DialogHeader>
                {action === "verify" || action === "booking" ? (
                    <BookingKycForm
                        order={order}
                        deal={deal}
                        errors={errors}
                        onDone={() => onOpenChange(false)}
                    />
                ) : null}
                {action === "enter_kyc" ? (
                    <EnterKycForm order={order} onDone={() => onOpenChange(false)} />
                ) : null}
                {action === "plan" ? (
                    <PlanForm order={order} deal={deal} errors={errors} onDone={() => onOpenChange(false)} />
                ) : null}
                {action === "tracking" || action === "payment" ? (
                    <PaymentForm order={order} deal={deal} errors={errors} onDone={() => onOpenChange(false)} />
                ) : null}
                {action === "ballot" ? (
                    <BallotForm order={order} deal={deal} errors={errors} onDone={() => onOpenChange(false)} />
                ) : null}
                {action === "transfer" ? (
                    <TransferForm order={order} deal={deal} errors={errors} onDone={() => onOpenChange(false)} />
                ) : null}
                {action === "litigation" ? (
                    <LitigationForm order={order} deal={deal} onDone={() => onOpenChange(false)} />
                ) : null}
                {action === "handover" ? (
                    <HandoverForm order={order} deal={deal} errors={errors} onDone={() => onOpenChange(false)} />
                ) : null}
                {action === "deliver" ? (
                    <DeliverForm order={order} onDone={() => onOpenChange(false)} />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

function BookingKycForm({ order, deal, errors, onDone }) {
    const bookingData = deal?.booking || {};
    const [form, setForm] = useState({
        identity_kind: bookingData.identity_kind || "cnic",
        identity_number: bookingData.identity_number || "",
        overseas: Boolean(bookingData.overseas),
        local_phone: bookingData.local_phone || "",
        nominee_name: bookingData.nominee_name || "",
        nominee_relation: bookingData.nominee_relation || "",
        nominee_cnic: bookingData.nominee_cnic || "",
        nominee_phone: bookingData.nominee_phone || "",
        phase: bookingData.phase || "",
        sector: bookingData.sector || "",
        plot_or_file: bookingData.plot_or_file || order.unit?.name || "",
        category: bookingData.category || "standard",
        premium: bookingData.premium ? String(bookingData.premium) : "0",
        discount: bookingData.discount ? String(bookingData.discount) : "0",
    });

    return (
        <form
            className="space-y-3"
            onSubmit={(event) => {
                event.preventDefault();
                post(booking.url(order.code), form, "Token verified", onDone);
            }}
        >
            <div className="grid gap-3 sm:grid-cols-2">
                <SelectBox
                    label="Identity"
                    value={form.identity_kind}
                    options={[
                        { value: "cnic", label: "CNIC" },
                        { value: "nicop", label: "NICOP" },
                        { value: "passport", label: "Passport" },
                    ]}
                    onValueChange={(value) => setForm((current) => ({ ...current, identity_kind: value || "cnic" }))}
                />
                <Input
                    label="Identity number"
                    required
                    value={form.identity_number}
                    error={errors.identity_number}
                    onChange={(event) => setForm((current) => ({ ...current, identity_number: event.target.value }))}
                />
                <Input
                    label="Nominee"
                    required
                    value={form.nominee_name}
                    error={errors.nominee_name}
                    onChange={(event) => setForm((current) => ({ ...current, nominee_name: event.target.value }))}
                />
                <Input
                    label="Relation"
                    required
                    value={form.nominee_relation}
                    error={errors.nominee_relation}
                    onChange={(event) => setForm((current) => ({ ...current, nominee_relation: event.target.value }))}
                />
                <Input
                    label="Nominee CNIC"
                    required
                    value={form.nominee_cnic}
                    error={errors.nominee_cnic}
                    onChange={(event) => setForm((current) => ({ ...current, nominee_cnic: event.target.value }))}
                />
                <Input
                    label="Plot / file"
                    required
                    value={form.plot_or_file}
                    error={errors.plot_or_file}
                    onChange={(event) => setForm((current) => ({ ...current, plot_or_file: event.target.value }))}
                />
                <SelectBox
                    label="Category"
                    value={form.category}
                    options={(deal?.categories || []).map((item) => ({ value: item.id, label: item.label }))}
                    onValueChange={(value) => setForm((current) => ({ ...current, category: value || "standard" }))}
                />
                <Input
                    label="Premium"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.premium}
                    onChange={(event) => setForm((current) => ({ ...current, premium: event.target.value }))}
                />
                <Input
                    label="Discount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.discount}
                    onChange={(event) => setForm((current) => ({ ...current, discount: event.target.value }))}
                />
            </div>
            <DialogFooter>
                <Button type="submit">Verify token</Button>
            </DialogFooter>
        </form>
    );
}

function EnterKycForm({ order, onDone }) {
    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Move this file into Booking &amp; KYC so the payment plan can be prepared.
            </p>
            <DialogFooter>
                <Button
                    type="button"
                    onClick={() =>
                        post(enterBookingKyc.url(order.code), {}, "Entered Booking & KYC", onDone)
                    }
                >
                    Enter Booking &amp; KYC
                </Button>
            </DialogFooter>
        </div>
    );
}

function PlanForm({ order, deal, errors, onDone }) {
    const saved = deal?.plan || {};
    const templates = deal?.templates || [];
    const initialTemplate = useMemo(() => {
        if (saved.template?.startsWith?.("template:")) {
            return saved.template.replace("template:", "");
        }

        const match = templates.find((item) => String(item.id) !== "custom");

        return match ? String(match.id) : "custom";
    }, [saved.template, templates]);

    const [form, setForm] = useState({
        template_id: initialTemplate,
        down_payment: saved.down_payment ? String(saved.down_payment) : "",
        handover_percent: saved.handover_percent ? String(saved.handover_percent) : "10",
        installment_count: saved.installment_count ? String(saved.installment_count) : "12",
        frequency: saved.frequency || "monthly",
        first_due_on: "",
        late_fee_basis: saved.late_fee_basis || "monthly",
        late_fee_rate: saved.late_fee_rate ? String(saved.late_fee_rate) : "0",
    });

    useEffect(() => {
        const selected = templates.find((item) => String(item.id) === String(form.template_id));

        if (!selected || selected.id === "custom") {
            return;
        }

        setForm((current) => ({
            ...current,
            frequency: selected.frequency || current.frequency,
            installment_count: String(selected.count ?? current.installment_count),
            handover_percent:
                selected.handover_percent != null
                    ? String(selected.handover_percent)
                    : current.handover_percent,
            down_payment:
                selected.down_payment_percent != null && deal?.net_price
                    ? String(Math.round((Number(deal.net_price) * Number(selected.down_payment_percent)) / 100))
                    : current.down_payment,
        }));
    }, [form.template_id]);

    const isCustom = String(form.template_id) === "custom";

    return (
        <form
            className="space-y-3"
            onSubmit={(event) => {
                event.preventDefault();
                const payload = {
                    ...form,
                    template: isCustom ? "custom" : undefined,
                    template_id: isCustom ? "custom" : form.template_id,
                };
                post(plan.url(order.code), payload, "Payment plan generated", onDone);
            }}
        >
            <SelectBox
                label="Template"
                value={String(form.template_id)}
                options={templates.map((item) => ({ value: String(item.id), label: item.label }))}
                onValueChange={(value) => setForm((current) => ({ ...current, template_id: value || "custom" }))}
            />
            <div className="grid gap-3 sm:grid-cols-2">
                <Input
                    label="Down payment"
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.down_payment}
                    error={errors.down_payment}
                    onChange={(event) => setForm((current) => ({ ...current, down_payment: event.target.value }))}
                />
                <Input
                    label="Handover %"
                    required
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.handover_percent}
                    error={errors.handover_percent}
                    onChange={(event) => setForm((current) => ({ ...current, handover_percent: event.target.value }))}
                />
                {isCustom ? (
                    <>
                        <Input
                            label="Installments"
                            type="number"
                            min="1"
                            max="120"
                            value={form.installment_count}
                            onChange={(event) =>
                                setForm((current) => ({ ...current, installment_count: event.target.value }))
                            }
                        />
                        <SelectBox
                            label="Frequency"
                            value={form.frequency}
                            options={[
                                { value: "monthly", label: "Monthly" },
                                { value: "quarterly", label: "Quarterly" },
                            ]}
                            onValueChange={(value) =>
                                setForm((current) => ({ ...current, frequency: value || "monthly" }))
                            }
                        />
                    </>
                ) : null}
                <DatePicker
                    label="First due date"
                    required
                    value={form.first_due_on}
                    error={errors.first_due_on}
                    onChange={(value) => setForm((current) => ({ ...current, first_due_on: value }))}
                />
            </div>
            <DialogFooter>
                <Button type="submit">Generate schedule</Button>
            </DialogFooter>
        </form>
    );
}

function PaymentForm({ order, deal, errors, onDone }) {
    const methods = paymentMethodOptions(deal);
    const [form, setForm] = useState({
        amount: null,
        method: methods[0] || "Cash",
        reference: "",
        paid_on: new Date().toISOString().slice(0, 10),
        notes: "",
        receipt: null,
    });

    return (
        <form
            className="space-y-3"
            onSubmit={(event) => {
                event.preventDefault();
                post(payment.url(order.code), form, "Payment recorded", onDone);
            }}
        >
            <p className="text-sm text-muted-foreground">
                Outstanding {formatMoney(deal?.ledger?.total_outstanding)} · Paid{" "}
                {formatMoney(deal?.ledger?.total_paid)}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
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
                    onValueChange={(value) => setForm((current) => ({ ...current, method: value || methods[0] || "Cash" }))}
                />
                <DatePicker
                    label="Paid on"
                    required
                    value={form.paid_on}
                    onChange={(value) => setForm((current) => ({ ...current, paid_on: value }))}
                />
                <Input
                    label="Reference"
                    value={form.reference}
                    onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))}
                />
            </div>
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
            <DialogFooter>
                <Button type="submit">Record payment</Button>
            </DialogFooter>
        </form>
    );
}

function BallotForm({ order, deal, errors, onDone }) {
    const [form, setForm] = useState({
        plot_number: deal?.booking?.inventory_kind === "plot" ? deal.booking.plot_or_file || "" : "",
        dimensions: deal?.booking?.dimensions || "",
        phase: deal?.booking?.phase || "",
        sector: deal?.booking?.sector || "",
    });

    return (
        <form
            className="space-y-3"
            onSubmit={(event) => {
                event.preventDefault();
                post(ballot.url(order.code), form, "Plot recorded", onDone);
            }}
        >
            <div className="grid gap-3 sm:grid-cols-2">
                <Input
                    label="Plot number"
                    required
                    value={form.plot_number}
                    error={errors.plot_number}
                    onChange={(event) => setForm((current) => ({ ...current, plot_number: event.target.value }))}
                />
                <Input
                    label="Dimensions"
                    required
                    value={form.dimensions}
                    error={errors.dimensions}
                    onChange={(event) => setForm((current) => ({ ...current, dimensions: event.target.value }))}
                />
            </div>
            <DialogFooter>
                <Button type="submit">Save plot</Button>
            </DialogFooter>
        </form>
    );
}

function TransferForm({ order, deal, errors, onDone }) {
    const [buyer, setBuyer] = useState({
        first_name: "",
        last_name: "",
        phone_number: "",
        cnic: "",
        ndc_cleared: false,
        notes: "",
    });

    return (
        <form
            className="space-y-3"
            onSubmit={(event) => {
                event.preventDefault();
                post(
                    transfer.url(order.code),
                    { ...buyer, ndc_cleared: buyer.ndc_cleared ? 1 : 0 },
                    "File transferred",
                    onDone,
                );
            }}
        >
            <p className="text-sm text-muted-foreground">
                Transfer stays on Active with the new buyer. Payment history remains on this file.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
                <Input
                    label="New buyer"
                    required
                    value={buyer.first_name}
                    error={errors.first_name}
                    onChange={(event) => setBuyer((current) => ({ ...current, first_name: event.target.value }))}
                />
                <Input
                    label="Last name"
                    value={buyer.last_name}
                    onChange={(event) => setBuyer((current) => ({ ...current, last_name: event.target.value }))}
                />
                <Input
                    label="Phone"
                    required
                    value={buyer.phone_number}
                    error={errors.phone_number}
                    onChange={(event) => setBuyer((current) => ({ ...current, phone_number: event.target.value }))}
                />
                <Input
                    label="CNIC"
                    value={buyer.cnic}
                    onChange={(event) => setBuyer((current) => ({ ...current, cnic: event.target.value }))}
                />
            </div>
            <label className="flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={buyer.ndc_cleared}
                    onChange={(event) =>
                        setBuyer((current) => ({ ...current, ndc_cleared: event.target.checked }))
                    }
                />
                No Demand Certificate cleared
            </label>
            {(deal?.transfers || []).length > 0 ? (
                <ul className="space-y-1.5 rounded-md border border-border/70 px-3 py-2 text-xs text-muted-foreground">
                    {deal.transfers.map((row) => (
                        <li key={row.id}>
                            {row.from || "Previous"} → {row.to || "New"} · Outstanding{" "}
                            {formatMoney(row.outstanding)}
                        </li>
                    ))}
                </ul>
            ) : null}
            <DialogFooter>
                <Button type="submit">Transfer file</Button>
            </DialogFooter>
        </form>
    );
}

function LitigationForm({ order, deal, onDone }) {
    const inLitigation = deal?.status === "litigation" || order?.status === "litigation";

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                {inLitigation
                    ? "Clear litigation to resume the normal Active status flow."
                    : "Mark this Active booking as under litigation."}
            </p>
            <DialogFooter>
                <Button
                    type="button"
                    variant={inLitigation ? "outline" : "destructive"}
                    onClick={() =>
                        post(
                            litigation.url(order.code),
                            { litigation: !inLitigation },
                            inLitigation ? "Litigation cleared" : "Litigation set",
                            onDone,
                        )
                    }
                >
                    {inLitigation ? "Clear litigation" : "Set litigation"}
                </Button>
            </DialogFooter>
        </div>
    );
}

function HandoverForm({ order, deal, errors, onDone }) {
    const checklist = deal?.checklist || {};
    const [form, setForm] = useState({
        original_files: Boolean(checklist.original_files),
        allotment_letter: Boolean(checklist.allotment_letter),
        registry_docs: Boolean(checklist.registry_docs),
    });

    return (
        <form
            className="space-y-3"
            onSubmit={(event) => {
                event.preventDefault();
                post(handover.url(order.code), form, "Handover marked ready", onDone);
            }}
        >
            {[
                ["original_files", "Original files received"],
                ["allotment_letter", "Allotment letter issued"],
                ["registry_docs", "Registry documents ready"],
            ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={form[key]}
                        onChange={(event) =>
                            setForm((current) => ({ ...current, [key]: event.target.checked }))
                        }
                    />
                    {label}
                </label>
            ))}
            {errors.order ? <p className="text-sm text-destructive">{errors.order}</p> : null}
            <DialogFooter>
                <Button type="submit">Mark ready for handover</Button>
            </DialogFooter>
        </form>
    );
}

function DeliverForm({ order, onDone }) {
    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Confirm completion to close this booking and set the unit as sold.
            </p>
            <DialogFooter>
                <Button
                    type="button"
                    onClick={() => post(deliver.url(order.code), {}, "Booking completed", onDone)}
                >
                    Complete booking
                </Button>
            </DialogFooter>
        </div>
    );
}

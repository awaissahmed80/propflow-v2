import { useEffect, useMemo, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import { toast } from "sonner";
import {
    ballot,
    storeBooking as booking,
    deliver,
    handover,
    payment,
    plan,
} from "@/actions/App/Http/Controllers/Portal/DealController";
import { Button } from "@/components/ui/button";
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
import { SelectBox } from "@/components/ui/select";
import { formatMoney } from "@/lib/currency";

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

export const FALLBACK_BOOKING_STAGES = [
    { id: "booking", label: "Booking & KYC" },
    { id: "plan", label: "Payment plan" },
    { id: "tracking", label: "Installments" },
    { id: "transfer", label: "Balloting" },
    { id: "handover", label: "Handover" },
];

/** @deprecated Prefer resolveBookingStages(orderStages) */
export const BOOKING_STAGES = FALLBACK_BOOKING_STAGES;

export function resolveBookingStages(orderStages = []) {
    const rows = (orderStages || [])
        .filter((stage) => stage && stage.label && stage.label !== "delivered")
        .filter((stage) => stage.is_enabled !== false)
        .map((stage) => ({
            id: stage.label,
            label: stage.title || stage.label,
            color: stage.color || null,
        }));

    return rows.length > 0 ? rows : FALLBACK_BOOKING_STAGES;
}

export function stageTitle(stage, orderStages = []) {
    const match = (orderStages || []).find((item) => item.label === stage || item.id === stage);

    if (match?.title || match?.label) {
        return match.title || match.label;
    }

    return FALLBACK_BOOKING_STAGES.find((item) => item.id === stage)?.label || stage || "Booking & KYC";
}

export function BookingStageDialog({ open, onOpenChange, action, order, deal }) {
    const { errors = {} } = usePage().props;

    if (!action || !order) {
        return null;
    }

    const title =
        {
            booking: "Complete Booking & KYC",
            plan: "Set payment plan",
            tracking: "Record payment",
            transfer: "Balloting & transfer",
            handover: "Handover",
            deliver: "Mark delivered",
        }[action] || "Update booking";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        {order.code}
                        {deal?.net_price != null ? ` · Net ${formatMoney(deal.net_price)}` : ""}
                    </DialogDescription>
                </DialogHeader>
                {action === "booking" ? (
                    <BookingKycForm
                        order={order}
                        deal={deal}
                        errors={errors}
                        onDone={() => onOpenChange(false)}
                    />
                ) : null}
                {action === "plan" ? (
                    <PlanForm order={order} deal={deal} errors={errors} onDone={() => onOpenChange(false)} />
                ) : null}
                {action === "tracking" ? (
                    <PaymentForm order={order} deal={deal} errors={errors} onDone={() => onOpenChange(false)} />
                ) : null}
                {action === "transfer" ? (
                    <BallotForm order={order} deal={deal} errors={errors} onDone={() => onOpenChange(false)} />
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
        plot_or_file: bookingData.plot_or_file || order.unit?.code || "",
        category: bookingData.category || "standard",
        premium: bookingData.premium ? String(bookingData.premium) : "0",
        discount: bookingData.discount ? String(bookingData.discount) : "0",
    });

    return (
        <form
            className="space-y-3"
            onSubmit={(event) => {
                event.preventDefault();
                post(booking.url(order.code), form, "Booking verified", onDone);
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
                <Button type="submit">Save & continue</Button>
            </DialogFooter>
        </form>
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
    const [form, setForm] = useState({
        amount: "",
        method: "pay_order",
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
                <Input
                    label="Amount"
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    error={errors.amount}
                    onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                />
                <SelectBox
                    label="Method"
                    value={form.method}
                    options={[
                        { value: "pay_order", label: "Pay order" },
                        { value: "cheque", label: "Cheque" },
                        { value: "bank_transfer", label: "Bank transfer" },
                    ]}
                    onValueChange={(value) => setForm((current) => ({ ...current, method: value || "pay_order" }))}
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
                Confirm delivery to mark this booking complete and set the unit as sold.
            </p>
            <DialogFooter>
                <Button
                    type="button"
                    onClick={() => post(deliver.url(order.code), {}, "Booking delivered", onDone)}
                >
                    Confirm delivery
                </Button>
            </DialogFooter>
        </div>
    );
}

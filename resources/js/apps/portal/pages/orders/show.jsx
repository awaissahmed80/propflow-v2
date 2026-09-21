import { useState } from "react";
import { router, usePage } from "@inertiajs/react";
import { toast } from "sonner";
import { cancel } from "@/actions/App/Http/Controllers/Portal/OrderController";
import {
    ballot,
    storeBooking as booking,
    showBookingForm as bookingForm,
    deliver,
    handover,
    payment,
    plan,
    transfer,
} from "@/actions/App/Http/Controllers/Portal/DealController";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { isPagePending, PageSkeleton } from "../../components/page-skeleton";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { NumberInput } from "@/components/ui/number-input";
import { SelectBox } from "@/components/ui/select";
import { ComboBox } from "@/components/ui/combo-box";
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";

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

const steps = [
    { id: "token", label: "Token" },
    { id: "booking_kyc", label: "Booking & KYC" },
    { id: "active", label: "Active" },
    { id: "closed", label: "Closed" },
];

function stepIndex(stage) {
    if (stage === "closed" || stage === "completed" || stage === "cancelled") {
        return steps.length - 1;
    }

    const index = steps.findIndex((step) => step.id === stage);

    return index === -1 ? 0 : index;
}

function paymentMethodOptions(deal) {
    const fromDeal = Array.isArray(deal?.payment_methods) ? deal.payment_methods : [];

    return Array.from(new Set([...fromDeal, ...FALLBACK_PAYMENT_METHODS].filter(Boolean)));
}

function post(url, data, success) {
    router.post(pathFrom(url), data, {
        preserveScroll: true,
        forceFormData: data instanceof FormData || data?.receipt instanceof File,
        onSuccess: () => toast.success(success),
        onError: (errors) => toast.error(Object.values(errors)[0] || "Unable to update this deal"),
    });
}

export default function OrderShow({ order, deal }) {
    const pending = isPagePending(order);
    const { errors = {} } = usePage().props;
    const [step, setStep] = useState(stepIndex(deal?.stage));

    if (pending) {
        return <PageSkeleton title="Order" />;
    }

    const current = steps[step];
    const cancelled = order.status === "cancelled";
    const closed = order.status === "completed" || deal?.stage === "closed" || order.status === "cancelled";

    const title = order.contact?.display_name || "Booking";

    return (
        <Layout>
            <Layout.Header
                metaTitle={`${title} · Booking`}
                breadcrumbs={[{ label: "Bookings", href: "/bookings" }, { label: title }]}
            />
            <Layout.Content className="min-h-0 flex-1 overflow-auto">
                <div className="mx-auto w-full max-w-4xl space-y-6 py-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {[order.project?.title, order.unit?.name].filter(Boolean).join(" · ") ||
                                    "No unit linked"}
                                {deal?.ledger?.is_late ? " · Default / late" : ""}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => window.open(pathFrom(bookingForm.url(order.code)), "_blank")}
                            >
                                Booking form
                            </Button>
                            {!cancelled && !closed ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        if (window.confirm("Cancel this booking and release the unit?")) {
                                            post(cancel.url(order.code), {}, "Booking cancelled");
                                        }
                                    }}
                                >
                                    Cancel
                                </Button>
                            ) : null}
                        </div>
                    </div>

                    <ol className="grid gap-2 sm:grid-cols-4">
                        {steps.map((item, index) => (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    onClick={() => setStep(index)}
                                    className={cn(
                                        "w-full rounded-lg border px-3 py-2 text-left text-xs font-medium",
                                        index === step
                                            ? "border-primary bg-primary/10 text-foreground"
                                            : "border-border text-muted-foreground",
                                    )}
                                >
                                    <span className="block text-[10px] uppercase tracking-wide">
                                        Stage {index + 1}
                                    </span>
                                    {item.label}
                                </button>
                            </li>
                        ))}
                    </ol>

                    {current.id === "token" ? <BookingStep order={order} deal={deal} errors={errors} /> : null}
                    {current.id === "booking_kyc" ? <PlanStep order={order} deal={deal} errors={errors} /> : null}
                    {current.id === "active" ? (
                        <>
                            <LedgerStep order={order} deal={deal} errors={errors} />
                            <TransferStep order={order} deal={deal} errors={errors} />
                        </>
                    ) : null}
                    {current.id === "closed" ? (
                        <HandoverStep
                            order={order}
                            deal={deal}
                            errors={errors}
                            delivered={order.status === "completed"}
                        />
                    ) : null}
                </div>
            </Layout.Content>
        </Layout>
    );
}

function BookingStep({ order, deal, errors }) {
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
        plot_or_file: bookingData.plot_or_file || "",
        category: bookingData.category || "standard",
        premium: bookingData.premium ? String(bookingData.premium) : "0",
        discount: bookingData.discount ? String(bookingData.discount) : "0",
    });

    const set = (key) => (event) => {
        const value = event?.target ? event.target.value : event;
        setForm((current) => ({ ...current, [key]: value }));
    };

    return (
        <form
            className="space-y-4 rounded-xl border border-border/80 bg-background p-5"
            onSubmit={(event) => {
                event.preventDefault();
                post(booking.url(order.code), { ...form, overseas: form.overseas ? 1 : 0 }, "Booking verified");
            }}
        >
            <p className="text-sm text-muted-foreground">
                The unit stays frozen. Capture the applicant, nominee, and the file details, then print the provisional allotment letter.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
                <SelectBox
                    label="Identity"
                    value={form.identity_kind}
                    options={[
                        { value: "cnic", label: "CNIC" },
                        { value: "passport", label: "Passport" },
                    ]}
                    onValueChange={(value) => setForm((current) => ({ ...current, identity_kind: value || "cnic" }))}
                />
                <Input label="Number" required value={form.identity_number} error={errors.identity_number} onChange={set("identity_number")} />
                <Input label="Local phone" value={form.local_phone} error={errors.local_phone} onChange={set("local_phone")} />
                <label className="flex items-end gap-2 pb-2 text-sm">
                    <input
                        type="checkbox"
                        checked={form.overseas}
                        onChange={(event) => setForm((current) => ({ ...current, overseas: event.target.checked }))}
                    />
                    Overseas Pakistani
                </label>
                <Input label="Nominee" required value={form.nominee_name} error={errors.nominee_name} onChange={set("nominee_name")} />
                <Input label="Relation" required value={form.nominee_relation} error={errors.nominee_relation} onChange={set("nominee_relation")} />
                <Input label="Nominee CNIC" required value={form.nominee_cnic} error={errors.nominee_cnic} onChange={set("nominee_cnic")} />
                <Input label="Nominee phone" value={form.nominee_phone} onChange={set("nominee_phone")} />
                <Input label="Phase" value={form.phase} onChange={set("phase")} />
                <Input label="Sector" value={form.sector} onChange={set("sector")} />
                <Input label="Plot / file number" required value={form.plot_or_file} error={errors.plot_or_file} onChange={set("plot_or_file")} />
                <SelectBox
                    label="Category"
                    value={form.category}
                    options={(deal?.categories || []).map((item) => ({ value: item.id, label: item.label }))}
                    onValueChange={(value) => setForm((current) => ({ ...current, category: value || "standard" }))}
                />
                <Input label="Premium" type="number" min="0" step="0.01" value={form.premium} onChange={set("premium")} />
                <Input label="Discount" type="number" min="0" step="0.01" value={form.discount} onChange={set("discount")} />
            </div>
            <p className="text-sm font-medium">Net price {formatMoney(deal?.net_price)}</p>
            {bookingData.block ? <p className="text-xs text-muted-foreground">Block {bookingData.block}</p> : null}
            <Button type="submit">Save booking</Button>
        </form>
    );
}

function PlanStep({ order, deal, errors }) {
    const saved = deal?.plan || {};
    const [form, setForm] = useState({
        template: saved.template || "quarterly_3y",
        down_payment: saved.down_payment ? String(saved.down_payment) : "",
        handover_percent: saved.handover_percent ? String(saved.handover_percent) : "10",
        installment_count: saved.installment_count ? String(saved.installment_count) : "12",
        frequency: saved.frequency || "monthly",
        first_due_on: "",
        late_fee_basis: saved.late_fee_basis || "monthly",
        late_fee_rate: saved.late_fee_rate ? String(saved.late_fee_rate) : "0",
    });

    return (
        <form
            className="space-y-4 rounded-xl border border-border/80 bg-background p-5"
            onSubmit={(event) => {
                event.preventDefault();
                post(plan.url(order.code), form, "Payment plan generated");
            }}
        >
            <p className="text-sm text-muted-foreground">
                The down payment is treated as already collected. The rest of the net price is scheduled, with the handover share held until the end.
            </p>
            <SelectBox
                label="Template"
                value={form.template}
                options={(deal?.templates || []).map((item) => ({ value: item.id, label: item.label }))}
                onValueChange={(value) => setForm((current) => ({ ...current, template: value || "custom" }))}
            />
            <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Down payment" required type="number" min="0" step="0.01" value={form.down_payment} error={errors.down_payment} onChange={(event) => setForm((current) => ({ ...current, down_payment: event.target.value }))} />
                <Input label="Handover %" required type="number" min="0" max="100" step="0.01" value={form.handover_percent} error={errors.handover_percent} onChange={(event) => setForm((current) => ({ ...current, handover_percent: event.target.value }))} />
                {form.template === "custom" ? (
                    <>
                        <Input label="Installments" type="number" min="1" max="120" value={form.installment_count} error={errors.installment_count} onChange={(event) => setForm((current) => ({ ...current, installment_count: event.target.value }))} />
                        <SelectBox
                            label="Frequency"
                            value={form.frequency}
                            options={[
                                { value: "monthly", label: "Monthly" },
                                { value: "quarterly", label: "Quarterly" },
                            ]}
                            onValueChange={(value) => setForm((current) => ({ ...current, frequency: value || "monthly" }))}
                        />
                    </>
                ) : null}
                <DatePicker label="First due date" required value={form.first_due_on} error={errors.first_due_on} onChange={(value) => setForm((current) => ({ ...current, first_due_on: value }))} />
                <SelectBox
                    label="Late fee"
                    value={form.late_fee_basis}
                    options={[
                        { value: "monthly", label: "Monthly" },
                        { value: "daily", label: "Daily" },
                    ]}
                    placeholder="None"
                    clearable
                    onValueChange={(value) => setForm((current) => ({ ...current, late_fee_basis: value || "" }))}
                />
                <Input label="Late fee rate %" type="number" min="0" step="0.01" value={form.late_fee_rate} onChange={(event) => setForm((current) => ({ ...current, late_fee_rate: event.target.value }))} />
            </div>
            <Button type="submit">Generate schedule</Button>
        </form>
    );
}

function LedgerStep({ order, deal, errors }) {
    const ledger = deal?.ledger || {};
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
        <div className="space-y-4">
            <dl className="grid gap-3 rounded-xl border border-border/80 bg-background p-5 sm:grid-cols-4">
                <Stat label="Paid" value={formatMoney(ledger.total_paid)} />
                <Stat label="Outstanding" value={formatMoney(ledger.total_outstanding)} />
                <Stat label="Upcoming" value={formatMoney(ledger.upcoming)} />
                <Stat label="Overdue" value={formatMoney(ledger.overdue)} late={ledger.is_late} />
            </dl>
            {ledger.is_late ? (
                <p className="text-sm text-destructive">Default / late. Late fees {formatMoney(ledger.late_fees)}.</p>
            ) : null}
            <form
                className="grid gap-3 rounded-xl border border-border/80 bg-background p-5 sm:grid-cols-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    post(payment.url(order.code), form, "Payment recorded");
                }}
            >
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
                    value={form.method}
                    options={methods}
                    placeholder="Cash, Pay order..."
                    onValueChange={(value) =>
                        setForm((current) => ({ ...current, method: value || methods[0] || "Cash" }))
                    }
                />
                <Input label="Reference" value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} />
                <DatePicker label="Paid on" required value={form.paid_on} onChange={(value) => setForm((current) => ({ ...current, paid_on: value }))} />
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm sm:col-span-2">
                    <Icon name="upload-2-line" className="shrink-0 text-base text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                        {form.receipt?.name || "Proof of payment (image or PDF)"}
                    </span>
                    <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="sr-only"
                        onChange={(event) => setForm((current) => ({ ...current, receipt: event.target.files?.[0] || null }))}
                    />
                </label>
                <div className="sm:col-span-2">
                    <Button type="submit">Record payment</Button>
                </div>
            </form>
            <ScheduleTable rows={deal?.installments || []} />
        </div>
    );
}

function TransferStep({ order, deal, errors }) {
    const [ballotForm, setBallotForm] = useState({
        plot_number: deal?.booking?.inventory_kind === "plot" ? deal.booking.plot_or_file || "" : "",
        dimensions: deal?.booking?.dimensions || "",
        phase: deal?.booking?.phase || "",
        sector: deal?.booking?.sector || "",
    });
    const [buyer, setBuyer] = useState({
        first_name: "",
        last_name: "",
        phone_number: "",
        cnic: "",
        ndc_cleared: false,
        notes: "",
    });

    return (
        <div className="space-y-4">
            {deal?.balloting_enabled ? (
                <form
                    className="space-y-3 rounded-xl border border-border/80 bg-background p-5"
                    onSubmit={(event) => {
                        event.preventDefault();
                        post(ballot.url(order.code), ballotForm, "Plot recorded");
                    }}
                >
                    <h2 className="text-base font-bold tracking-tight">Balloting</h2>
                    <p className="text-sm text-muted-foreground">
                        Optional for this project. Record the physical plot once allotted.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Input label="Plot number" required value={ballotForm.plot_number} error={errors.plot_number} onChange={(event) => setBallotForm((current) => ({ ...current, plot_number: event.target.value }))} />
                        <Input label="Dimensions" required value={ballotForm.dimensions} error={errors.dimensions} onChange={(event) => setBallotForm((current) => ({ ...current, dimensions: event.target.value }))} />
                    </div>
                    <Button type="submit">Save plot</Button>
                </form>
            ) : null}
            <form
                className="space-y-3 rounded-xl border border-border/80 bg-background p-5"
                onSubmit={(event) => {
                    event.preventDefault();
                    post(transfer.url(order.code), { ...buyer, ndc_cleared: buyer.ndc_cleared ? 1 : 0 }, "File transferred");
                }}
            >
                <h2 className="text-base font-bold tracking-tight">Transfer</h2>
                <p className="text-sm text-muted-foreground">
                    The payment history stays on this file. Outstanding dues and the NDC are recorded against the outgoing buyer.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                    <Input label="New buyer" required value={buyer.first_name} error={errors.first_name} onChange={(event) => setBuyer((current) => ({ ...current, first_name: event.target.value }))} />
                    <Input label="Last name" value={buyer.last_name} onChange={(event) => setBuyer((current) => ({ ...current, last_name: event.target.value }))} />
                    <Input label="Phone" required value={buyer.phone_number} error={errors.phone_number} onChange={(event) => setBuyer((current) => ({ ...current, phone_number: event.target.value }))} />
                    <Input label="CNIC" value={buyer.cnic} onChange={(event) => setBuyer((current) => ({ ...current, cnic: event.target.value }))} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={buyer.ndc_cleared} onChange={(event) => setBuyer((current) => ({ ...current, ndc_cleared: event.target.checked }))} />
                    No Demand Certificate cleared
                </label>
                <Button type="submit">Transfer file</Button>
            </form>
            {(deal?.transfers || []).length > 0 ? (
                <ul className="space-y-2 text-sm">
                    {deal.transfers.map((row) => (
                        <li key={row.id} className="rounded-lg border border-border/70 px-3 py-2">
                            {row.from || "Previous buyer"} → {row.to || "New buyer"}
                            <span className="ml-2 text-muted-foreground">
                                Outstanding {formatMoney(row.outstanding)} · {row.ndc_cleared ? "NDC cleared" : "NDC outstanding"}
                            </span>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}

function HandoverStep({ order, deal, errors, delivered }) {
    const [checks, setChecks] = useState(deal?.checklist || {});
    const ledger = deal?.ledger || {};

    return (
        <div className="space-y-4 rounded-xl border border-border/80 bg-background p-5">
            <p className="text-sm text-muted-foreground">
                Handover needs a zero balance, including late fees, and the original documents in the agency file.
            </p>
            <p className="text-sm font-medium">Statement of account {formatMoney(ledger.total_outstanding)}</p>
            {["original_files", "allotment_letter", "registry_docs"].map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={Boolean(checks[key])}
                        onChange={(event) => setChecks((current) => ({ ...current, [key]: event.target.checked }))}
                    />
                    {key === "original_files" ? "Original customer file" : key === "allotment_letter" ? "Allotment letter" : "Registry documents"}
                    {errors[key] ? <span className="text-destructive">{errors[key]}</span> : null}
                </label>
            ))}
            {!delivered ? (
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => post(handover.url(order.code), {
                            original_files: checks.original_files ? 1 : 0,
                            allotment_letter: checks.allotment_letter ? 1 : 0,
                            registry_docs: checks.registry_docs ? 1 : 0,
                        }, "Marked ready for handover")}
                    >
                        Ready for handover
                    </Button>
                    <Button type="button" onClick={() => post(deliver.url(order.code), {}, "Asset delivered")}>
                        Asset delivered
                    </Button>
                </div>
            ) : (
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Asset delivered</p>
            )}
        </div>
    );
}

function ScheduleTable({ rows }) {
    if (rows.length === 0) {
        return <p className="text-sm text-muted-foreground">No schedule yet.</p>;
    }

    return (
        <div className="overflow-hidden rounded-xl border border-border/80 bg-background">
            <table className="w-full text-left text-sm">
                <thead className="border-b border-border/70 bg-muted/30 text-xs text-muted-foreground">
                    <tr>
                        <th className="px-4 py-2.5 font-medium">Item</th>
                        <th className="px-4 py-2.5 font-medium">Due</th>
                        <th className="px-4 py-2.5 font-medium">Amount</th>
                        <th className="px-4 py-2.5 font-medium">Left</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.id} className="border-b border-border/60 last:border-b-0">
                            <td className="px-4 py-3">{row.label}</td>
                            <td className="px-4 py-3 text-muted-foreground">{row.due_on}</td>
                            <td className="px-4 py-3">{formatMoney(row.amount)}</td>
                            <td className="px-4 py-3">{formatMoney(row.remaining)}</td>
                            <td className="px-4 py-3">
                                {row.status === "paid" ? "Paid" : row.overdue ? "Overdue" : "Pending"}
                                {row.late_fee ? <span className="ml-2 text-xs text-muted-foreground">fee {formatMoney(row.late_fee)}</span> : null}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Stat({ label, value, late = false }) {
    return (
        <div>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className={cn("text-sm font-medium", late && "text-destructive")}>{value}</dd>
        </div>
    );
}

OrderShow.layout = (page) => <PortalLayout children={page} />;

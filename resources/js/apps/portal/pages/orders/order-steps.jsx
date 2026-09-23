import { useState } from "react";
import {
    ballot,
    storeBooking as booking,
    deliver,
    handover,
    payment,
    plan,
    transfer,
} from "@/actions/App/Http/Controllers/Portal/DealController";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { NumberInput } from "@/components/ui/number-input";
import { SelectBox } from "@/components/ui/select";
import { ComboBox } from "@/components/ui/combo-box";
import { formatMoney } from "@/lib/currency";
import { paymentMethodOptions, post } from "./order-helpers";
import { ScheduleTable, Stat } from "./order-step-shared";

export function BookingStep({ order, deal, errors }) {
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

export function PlanStep({ order, deal, errors }) {
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

export function LedgerStep({ order, deal, errors }) {
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

export function TransferStep({ order, deal, errors }) {
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

export function HandoverStep({ order, deal, errors, delivered }) {
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

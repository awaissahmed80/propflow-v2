import { useState } from "react";
import { router, usePage } from "@inertiajs/react";
import { toast } from "sonner";
import { payment, paymentVoucher } from "@/actions/App/Http/Controllers/Portal/DealController";
import { ComboBox } from "@/components/ui/combo-box";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { formatMoney } from "@/lib/currency";
import { formatDateTime } from "@/lib/datetime";
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

function pdfPreviewFile(name, url) {
    return {
        name: name || "Document.pdf",
        url,
        type: "application/pdf",
    };
}

function previewFileFromUrl(name, url) {
    const lower = String(url || "").toLowerCase();
    const isImage = /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(lower);

    if (isImage) {
        return {
            name: name || "Receipt",
            url,
            type: "image/jpeg",
            kind: "media",
        };
    }

    return pdfPreviewFile(name, url);
}

export function PaymentsTab({ order, deal, canRecord, onPreview }) {
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
            {canRecord ? (
                <form className="space-y-3 border-b border-border pb-4" onSubmit={submit}>
                    <p className="text-sm text-muted-foreground">
                        Outstanding {formatMoney(deal?.ledger?.total_outstanding)} · Paid{" "}
                        {formatMoney(deal?.ledger?.total_paid)}
                        {!deal?.plan?.template ? " · Direct sale" : ""}
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

            {payments.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                    No payments recorded yet.
                </div>
            ) : (
                <ul className="divide-y divide-border">
                    {payments.map((row) => {
                        const voucherUrl =
                            row.voucher_url ||
                            pathFrom(
                                paymentVoucher.url({
                                    order: order.code,
                                    payment: row.id,
                                }),
                            );

                        return (
                            <li
                                key={row.id}
                                className="flex min-w-0 items-center gap-3 py-2.5"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-foreground">
                                        {row.method || "Payment"}
                                    </p>
                                    <p className="truncate text-sm text-muted-foreground">
                                        {row.paid_on || "No date"}
                                        {row.reference ? ` · ${row.reference}` : ""}
                                    </p>
                                </div>
                                <div className="shrink-0 text-right">
                                    <p className="text-sm font-semibold tabular-nums">
                                        {formatMoney(row.amount)}
                                    </p>
                                    <div className="mt-0.5 flex items-center justify-end gap-2">
                                        <button
                                            type="button"
                                            className="text-sm font-medium text-primary hover:underline"
                                            onClick={() =>
                                                onPreview?.(
                                                    pdfPreviewFile("Payment receipt.pdf", voucherUrl),
                                                )
                                            }
                                        >
                                            Receipt
                                        </button>
                                        {row.receipt_url ? (
                                            <button
                                                type="button"
                                                className="text-sm font-medium text-muted-foreground hover:underline"
                                                onClick={() =>
                                                    onPreview?.(
                                                        previewFileFromUrl(
                                                            "Proof of payment",
                                                            row.receipt_url,
                                                        ),
                                                    )
                                                }
                                            >
                                                Proof
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}

import { Icon } from "@/components/ui/icon";
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { ledgerPdf, ledgerPreview } from "@/actions/App/Http/Controllers/Portal/DealController";

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

export function InstallmentsTab({ order, deal, liaisonActive = false, onLogRecovery, onPreview }) {
    const installments = deal?.installments || [];
    const totals = deal?.installment_totals || {};
    const ledgerHref = pathFrom(ledgerPreview.url(order.code));
    const ledgerPdfHref = pathFrom(ledgerPdf.url(order.code));
    const hasOverdue = installments.some((row) => row.overdue);

    return (
        <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                        {deal?.plan?.title || "Payment plan"}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        {deal?.plan?.summary ||
                            (deal?.plan
                                ? `${deal.plan.frequency || "Monthly"} · ${deal.plan.installment_count || 0} installments`
                                : "No payment plan set yet.")}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        className="text-sm font-medium text-primary hover:underline"
                        onClick={() =>
                            onPreview?.(pdfPreviewFile("Ledger preview.pdf", ledgerHref))
                        }
                    >
                        Preview
                    </button>
                    <button
                        type="button"
                        className="text-sm font-medium text-primary hover:underline"
                        onClick={() =>
                            onPreview?.(pdfPreviewFile("Payment ledger.pdf", ledgerPdfHref))
                        }
                    >
                        Print / Download PDF
                    </button>
                </div>
            </div>

            {liaisonActive && hasOverdue ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                    <span>Overdue installment — log a courtesy call or WhatsApp reminder.</span>
                    <button
                        type="button"
                        className="font-medium text-primary hover:underline"
                        onClick={() => onLogRecovery?.()}
                    >
                        Log recovery note
                    </button>
                </div>
            ) : null}

            {installments.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                    No installment schedule yet. Set the payment plan to generate rows.
                </div>
            ) : (
                <ul className="divide-y divide-border">
                    {installments.map((row, index) => {
                        const isPaid = String(row.status || "").toLowerCase() === "paid";

                        return (
                            <li
                                key={row.id || row.sequence}
                                className={cn(
                                    "flex min-w-0 items-center gap-2.5 py-2.5",
                                    row.overdue && !isPaid && "bg-amber-500/5"
                                )}
                            >
                                <span
                                    className={cn(
                                        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
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
                                    <p className="truncate text-sm text-muted-foreground">
                                        {row.due_on || "No due date"} · {row.status}
                                        {row.overdue ? " · overdue" : ""}
                                    </p>
                                </div>
                                <div className="shrink-0 text-right">
                                    <p className="text-sm font-semibold tabular-nums">
                                        {formatMoney(row.amount)}
                                    </p>
                                    {isPaid && (row.receipt_url || row.voucher_url) ? (
                                        <button
                                            type="button"
                                            className="text-sm font-medium text-primary hover:underline"
                                            onClick={() =>
                                                onPreview?.(
                                                    previewFileFromUrl(
                                                        "Receipt.pdf",
                                                        row.receipt_url || row.voucher_url,
                                                    ),
                                                )
                                            }
                                        >
                                            Receipt
                                        </button>
                                    ) : null}
                                    {!isPaid && row.pay_voucher_url ? (
                                        <button
                                            type="button"
                                            className="text-sm font-medium text-primary hover:underline"
                                            onClick={() =>
                                                onPreview?.(
                                                    pdfPreviewFile(
                                                        "Pay voucher.pdf",
                                                        row.pay_voucher_url,
                                                    ),
                                                )
                                            }
                                        >
                                            Pay voucher
                                        </button>
                                    ) : null}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-sm sm:grid-cols-3">
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

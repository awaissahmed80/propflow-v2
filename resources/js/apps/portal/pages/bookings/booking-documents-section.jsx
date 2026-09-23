import { useState } from "react";
import { router } from "@inertiajs/react";
import { DocumentManager } from "@/components/document-manager";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const KYC_CHECKLIST = [
    {
        id: "buyer_id",
        label: "Buyer CNIC / NICOP / passport",
        hint: "Scan or photo of the buyer’s identity document",
    },
    {
        id: "nominee",
        label: "Nominee details",
        hint: "Nominee ID copy when a nominee is named",
    },
    {
        id: "photos",
        label: "Passport photographs",
        hint: "Recent passport-sized photos for the file",
    },
    {
        id: "pay_order",
        label: "Pay order / cheque copy",
        hint: "Proof of token or down-payment instrument",
    },
];

export function BookingDocumentsSection({
    order,
    deal,
    liaisonActive = true,
    onPreview,
}) {
    const documents = deal?.kyc_documents || [];
    const docsReady = Boolean(deal?.kyc_docs_ready) || documents.length > 0;
    const [managerOpen, setManagerOpen] = useState(false);
    const canUpload = liaisonActive && Boolean(order?.id);

    return (
        <section className="space-y-3 rounded-xl border border-border/80 bg-card p-4 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">KYC documents</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        Sales assists the buyer collecting papers; Operations files them for
                        formal verification.
                    </p>
                </div>
                {canUpload ? (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setManagerOpen(true)}
                    >
                        <Icon name="upload-2-line" className="text-base" />
                        Upload
                    </Button>
                ) : null}
            </div>

            <ul className="space-y-2">
                {KYC_CHECKLIST.map((item) => (
                    <li
                        key={item.id}
                        className="flex items-start gap-2.5 rounded-lg border border-border/60 px-3 py-2"
                    >
                        <span
                            className={cn(
                                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                                docsReady
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                    : "bg-muted text-muted-foreground"
                            )}
                        >
                            <Icon
                                name={docsReady ? "check-line" : "checkbox-blank-circle-line"}
                                className="text-xs"
                            />
                        </span>
                        <span className="min-w-0">
                            <span className="block text-sm font-medium text-foreground">
                                {item.label}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                                {item.hint}
                            </span>
                        </span>
                    </li>
                ))}
            </ul>

            {documents.length > 0 ? (
                <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border/70">
                    {documents.map((doc) => (
                        <li key={doc.id}>
                            <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40"
                                onClick={() =>
                                    onPreview?.({
                                        name: doc.name,
                                        url: doc.url,
                                        type: doc.type || "application/pdf",
                                    })
                                }
                            >
                                <Icon
                                    name="file-text-line"
                                    className="shrink-0 text-base text-muted-foreground"
                                />
                                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                                    {doc.name}
                                </span>
                                <Icon
                                    name="eye-line"
                                    className="shrink-0 text-base text-muted-foreground"
                                />
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-xs text-muted-foreground">
                    No files linked yet. Upload scans so Operations can verify the token.
                </p>
            )}

            {order?.id ? (
                <DocumentManager
                    open={managerOpen}
                    onOpenChange={setManagerOpen}
                    multiple
                    assetableType="order"
                    assetableId={order.id}
                    linkage="DOCUMENT"
                    selectedIds={documents.map((doc) => doc.id)}
                    title="Booking KYC documents"
                    description="Attach identity, nominee, photos, and pay-order copies for this booking."
                    onApplied={() =>
                        router.reload({
                            only: ["openedBooking"],
                            preserveScroll: true,
                        })
                    }
                />
            ) : null}
        </section>
    );
}

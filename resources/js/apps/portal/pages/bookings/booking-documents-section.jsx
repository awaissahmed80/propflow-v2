import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DocumentManager } from "@/components/document-manager";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export function BookingDocumentsSection({
    order,
    deal,
    requiredDocuments = [],
    liaisonActive = true,
    onPreview,
    onDocumentsApplied,
    onOpenBookingForm,
}) {
    const documents = deal?.kyc_documents || [];
    const [activeType, setActiveType] = useState(null);
    const canUpload = liaisonActive && Boolean(order?.id);
    const checklist = requiredDocuments.length > 0 ? requiredDocuments : [];

    const docsByLabel = useMemo(() => {
        const map = new Map();

        for (const doc of documents) {
            const key = doc.label || "__unlabeled__";
            const list = map.get(key) || [];
            list.push(doc);
            map.set(key, list);
        }

        return map;
    }, [documents]);

    const unlabeledDocs = docsByLabel.get("__unlabeled__") || [];

    const openUpload = (item) => {
        setActiveType(item);
    };

    const closeManager = (open) => {
        if (!open) {
            setActiveType(null);
        }
    };

    const handleApplied = async () => {
        try {
            await onDocumentsApplied?.();
        } catch (error) {
            toast.error(error?.message || "Unable to refresh booking documents");
        }
    };

    const activeDocs = activeType?.label
        ? docsByLabel.get(activeType.label) || []
        : [];

    return (
        <section className="space-y-3">
            {typeof onOpenBookingForm === "function" ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card p-3 shadow-xs">
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">Booking confirmation letter</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Preview the branded confirmation letter, then print or download as PDF.
                        </p>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={onOpenBookingForm}
                    >
                        <Icon name="file-paper-2-line" className="text-base" />
                        Preview
                    </Button>
                </div>
            ) : null}

            <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">Documents</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                    Attach files for each type. Mandatory types must be uploaded before Booking
                    &amp; KYC can complete. Types are managed in Settings → Bookings.
                </p>
            </div>

            {checklist.length > 0 ? (
                <ul className="space-y-2">
                    {checklist.map((item) => {
                        const files = docsByLabel.get(item.label) || [];
                        const ready = files.length > 0;

                        return (
                            <li
                                key={item.id || item.label}
                                className="rounded-xl border border-border/70 bg-card p-3 shadow-xs"
                            >
                                <div className="flex items-start gap-2.5">
                                    <span
                                        className={cn(
                                            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                                            ready
                                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                                : "bg-muted text-muted-foreground",
                                        )}
                                    >
                                        <Icon
                                            name={
                                                ready
                                                    ? "check-line"
                                                    : "checkbox-blank-circle-line"
                                            }
                                            className="text-xs"
                                        />
                                    </span>

                                    <div className="min-w-0 flex-1 space-y-2">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-sm font-medium text-foreground">
                                                        {item.title}
                                                    </p>
                                                    {item.is_required === false ? (
                                                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                                                            Optional
                                                        </span>
                                                    ) : (
                                                        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-primary uppercase">
                                                            Mandatory
                                                        </span>
                                                    )}
                                                </div>
                                                {item.description ? (
                                                    <p className="text-xs text-muted-foreground">
                                                        {item.description}
                                                    </p>
                                                ) : null}
                                                {ready ? (
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {files.length} file
                                                        {files.length === 1 ? "" : "s"}
                                                    </p>
                                                ) : null}
                                            </div>
                                            {canUpload ? (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    className="shrink-0"
                                                    onClick={() => openUpload(item)}
                                                >
                                                    <Icon
                                                        name={
                                                            ready
                                                                ? "add-line"
                                                                : "upload-2-line"
                                                        }
                                                        className="text-base"
                                                    />
                                                    {ready ? "Add files" : "Upload"}
                                                </Button>
                                            ) : null}
                                        </div>

                                        {files.length > 0 ? (
                                            <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border/60">
                                                {files.map((doc) => (
                                                    <li key={doc.link_id || doc.id}>
                                                        <button
                                                            type="button"
                                                            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40"
                                                            onClick={() =>
                                                                onPreview?.({
                                                                    name: doc.name,
                                                                    url: doc.url,
                                                                    type:
                                                                        doc.type ||
                                                                        "application/pdf",
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
                                                No file uploaded yet.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                    No document types configured. Add them in Settings → Bookings.
                </p>
            )}

            {unlabeledDocs.length > 0 ? (
                <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                    <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
                        Unclassified files
                    </p>
                    <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border/60 bg-card">
                        {unlabeledDocs.map((doc) => (
                            <li key={doc.link_id || doc.id}>
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
                </div>
            ) : null}

            {order?.id && activeType ? (
                <DocumentManager
                    open={Boolean(activeType)}
                    onOpenChange={closeManager}
                    multiple
                    assetableType="order"
                    assetableId={order.id}
                    linkage="DOCUMENT"
                    label={activeType.label}
                    lockedFolderId={order.document_folder_id}
                    selectedIds={activeDocs.map((doc) => doc.id)}
                    title={`${activeDocs.length > 0 ? "Add files" : "Upload"} — ${activeType.title}`}
                    description={
                        activeType.description ||
                        `Select or upload one or more files for ${activeType.title}.`
                    }
                    onApplied={handleApplied}
                />
            ) : null}
        </section>
    );
}

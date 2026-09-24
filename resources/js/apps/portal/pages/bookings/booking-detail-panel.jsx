import { useEffect, useMemo, useRef, useState } from "react";
import { Link, router, usePage } from "@inertiajs/react";
import { toast } from "sonner";
import { cancel } from "@/actions/App/Http/Controllers/Portal/OrderController";
import {
    bookingFormPdf,
    showBookingForm,
} from "@/actions/App/Http/Controllers/Portal/DealController";
import { FilePreview } from "@/components/file-preview";
import { UserCard } from "@/components/ui/entity-card";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { StageBadge } from "@/components/ui/stage-badge";
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { bookingApi } from "@/portal/store/api";
import { ContactCardPopover } from "../../components/contact-card";
import { ActivityTimeline } from "./booking-activity-timeline";
import {
    BookingAssigneeMenu,
    BookingProjectField,
} from "./booking-assignment-menus";
import {
    BookingPropertyCard,
    DealOverviewSection,
    StatusControl,
} from "./booking-detail-sections";
import { BookingDocumentsSection } from "./booking-documents-section";
import { InstallmentsTab } from "./booking-installments-tab";
import { NoteComposer } from "./booking-note-composer";
import {
    stageTitle,
    stageColor,
    BookingStageDialog,
} from "./booking-stage-dialogs";

function phoneDigits(phone) {
    return String(phone || "").replace(/\D+/g, "");
}

function whatsappUrl(phone) {
    const digits = phoneDigits(phone);

    return digits ? `https://wa.me/${digits}` : null;
}

function telUrl(phone) {
    const digits = phoneDigits(phone);

    return digits ? `tel:+${digits}` : null;
}

const PANEL_TABS = [
    ["overview", "Overview"],
    ["documents", "Documents"],
    ["activity", "Activity"],
];

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

function bookingAmountValue(order, deal) {
    if (order?.token_amount != null && Number(order.token_amount) > 0) {
        return Number(order.token_amount);
    }

    if (order?.booking_amount != null && Number(order.booking_amount) > 0) {
        return Number(order.booking_amount);
    }

    if (deal?.plan?.down_payment != null && Number(deal.plan.down_payment) > 0) {
        return Number(deal.plan.down_payment);
    }

    return null;
}

/**
 * Split booking actions into Ops/Accounts (formal) vs Sales liaison CTAs.
 */
function splitActions({ stage, status, deal, cancelled, closed, liaisonActive, canVerifyToken }) {
    if (cancelled || closed) {
        return { primary: [], more: [], liaison: [] };
    }

    const primary = [];
    const more = [];
    const liaison = [];
    const tokenVerified = Boolean(deal?.booking?.verified_at);

    if (stage === "token" && canVerifyToken) {
        primary.push({
            id: "verify",
            label: "Verify token",
            group: "ops",
        });
    }

    if (stage === "token") {
        liaison.push({
            id: "verification_queue",
            label: "Monitor verification queue",
            href: "/receivables/verification?mine=1",
        });
    }

    if (stage === "booking_kyc") {
        primary.push({
            id: "enter_kyc",
            label: "Enter Booking & KYC",
            group: "ops",
        });
    }

    if (stage === "active") {
        primary.push({
            id: "payment",
            label: "Record payment",
            group: "ops",
        });
    }

    if (tokenVerified && !deal?.plan?.template && (stage === "booking_kyc" || stage === "active")) {
        more.push({ id: "plan", label: "Set payment plan", group: "ops" });
    }

    if (stage === "active") {
        if (deal?.balloting_enabled && !deal?.booking?.balloted_at) {
            more.push({ id: "ballot", label: "Record balloting", group: "ops" });
        }

        more.push({
            id: "litigation",
            label: status === "litigation" ? "Clear litigation" : "Set litigation",
            group: "ops",
        });

        if (Number(deal?.ledger?.total_outstanding) <= 0) {
            if (deal?.handover_ready_at) {
                more.push({ id: "deliver", label: "Complete / handover", group: "ops" });
            } else {
                more.push({ id: "handover", label: "Ready for handover", group: "ops" });
            }
        }
    }

    if (liaisonActive) {
        liaison.push({
            id: "transfer",
            label: "Transfer file (initiate)",
        });
    }

    more.push({ id: "cancel", label: "Cancel booking", destructive: true, group: "ops" });

    return { primary, more, liaison };
}

export default function BookingDetailPanel({
    payload,
    orderStages = [],
    orderStatuses = [],
    projects = [],
    units = [],
    paymentAccounts = [],
    assignees = [],
    activityTypes: _activityTypes = [],
    bookingDocumentTypes = [],
    onClose,
    onEditContact,
    onOrdersRefresh,
}) {
    const [localPayload, setLocalPayload] = useState(payload);
    const [payloadCode, setPayloadCode] = useState(payload?.order?.code ?? null);
    const [fetchPanel] = bookingApi.useLazyPanelQuery();
    const [emailConfirmationLetter] = bookingApi.useEmailConfirmationLetterMutation();

    if ((payload?.order?.code ?? null) !== payloadCode) {
        setPayloadCode(payload?.order?.code ?? null);
        setLocalPayload(payload);
    }

    const { auth } = usePage().props;
    const permissions = Array.isArray(auth?.user?.permissions) ? auth.user.permissions : [];
    const canVerifyToken =
        Boolean(auth?.user?.is_owner) ||
        permissions.includes("verify booking") ||
        permissions.includes("manage booking");

    const order = localPayload?.order;
    const deal = localPayload?.deal;
    const [tab, setTab] = useState("overview");
    const bodyRef = useRef(null);
    const [dialogAction, setDialogAction] = useState(null);
    const [printableOpen, setPrintableOpen] = useState(false);
    const [printableFiles, setPrintableFiles] = useState([]);
    const [printableIndex, setPrintableIndex] = useState(0);
    const [printableDownloadUrl, setPrintableDownloadUrl] = useState(null);
    const [printablePageAspect, setPrintablePageAspect] = useState(null);
    const [printableEmailTo, setPrintableEmailTo] = useState(null);
    const [printableEmailHandler, setPrintableEmailHandler] = useState(null);

    const stage = deal?.stage || order?.stage || "token";
    const status = deal?.status || order?.status || "hold";
    const cancelled = status === "cancelled";
    const closed = stage === "closed" || status === "completed" || status === "cancelled";
    const completed = status === "completed";
    const open = !cancelled && !closed;
    const liaisonActive =
        deal?.liaison_active !== undefined ? Boolean(deal.liaison_active) : open;
    const hasPlan = Boolean(deal?.plan?.template);
    const tokenVerified = Boolean(deal?.booking?.verified_at);
    const canSetPlan = tokenVerified && !hasPlan && open;
    const stageLabel = stageTitle(stage, orderStages);
    const stageTone = stageColor(stage, orderStages) || "var(--primary)";
    const contactName = order?.contact?.display_name || "—";
    const bookingNumber = order?.booking_number || deal?.booking?.booking_number || null;
    const phone = order?.contact?.phone_number;
    const wa = useMemo(() => whatsappUrl(phone), [phone]);
    const call = useMemo(() => telUrl(phone), [phone]);

    const leadHref = order?.lead?.code ? `/leads?lead=${order.lead.code}` : null;
    const { primary, more, liaison } = useMemo(
        () =>
            splitActions({
                stage,
                status,
                deal,
                cancelled,
                closed,
                liaisonActive,
                canVerifyToken,
            }),
        [stage, status, deal, cancelled, closed, liaisonActive, canVerifyToken],
    );
    const hasActions = primary.length > 0 || more.length > 0 || liaison.length > 0;

    useEffect(() => {
        setTab("overview");
        setDialogAction(null);
    }, [order?.code]);

    useEffect(() => {
        const viewport = bodyRef.current?.querySelector(
            '[data-slot="scroll-area-viewport"]',
        );

        if (!viewport) {
            return;
        }

        if (tab === "activity") {
            return;
        }

        const frame = window.requestAnimationFrame(() => {
            viewport.scrollTop = 0;
        });

        return () => window.cancelAnimationFrame(frame);
    }, [tab, order?.code]);

    const refreshPanel = async () => {
        if (!order?.code) {
            return;
        }

        const data = await fetchPanel(order.code).unwrap();
        setLocalPayload(data);
        setTab("documents");
    };

    const handlePanelUpdated = (nextPayload) => {
        if (nextPayload?.order && nextPayload?.deal) {
            setLocalPayload(nextPayload);
        }

        onOrdersRefresh?.();
    };

    const openPrintable = (file, options = {}) => {
        if (!file?.url) {
            return;
        }

        setPrintableFiles([file]);
        setPrintableIndex(0);
        setPrintableDownloadUrl(options.downloadUrl || null);
        setPrintablePageAspect(options.pageAspect || null);
        setPrintableEmailTo(options.emailTo || null);
        setPrintableEmailHandler(
            typeof options.onEmail === "function" ? () => options.onEmail : null,
        );
        setPrintableOpen(true);
    };

    const openBookingFormPreview = () => {
        if (!order?.code) {
            return;
        }

        const emailTo = String(order?.contact?.email_address || "").trim();

        openPrintable(pdfPreviewFile("Booking Confirmation Letter.pdf", pathFrom(showBookingForm.url(order.code))), {
            downloadUrl: pathFrom(bookingFormPdf.url(order.code)),
            pageAspect: "a4",
            emailTo: emailTo || null,
            onEmail: emailTo
                ? async () => {
                      try {
                          await emailConfirmationLetter(order.code).unwrap();
                          toast.success(`Letter emailed to ${emailTo}`);
                      } catch (error) {
                          toast.error(
                              error?.message ||
                                  Object.values(error?.errors || {})[0] ||
                                  "Unable to email the confirmation letter",
                          );
                          throw error;
                      }
                  }
                : null,
        });
    };

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

    const runMoreAction = (action) => {
        if (action.id === "cancel") {
            handleCancel();
            return;
        }

        if (action.id === "verification_queue" && action.href) {
            router.get(action.href);
            return;
        }

        setDialogAction(action.id);
    };

    if (!order) {
        return null;
    }

    const totalPrice = deal?.net_price ?? order?.agreed_price;
    const bookingAmount = bookingAmountValue(order, deal);
    const paid = Number(deal?.ledger?.total_paid) || 0;
    const remaining = Number(deal?.ledger?.total_outstanding) || 0;

    return (
        <div className="flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden bg-card">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
                <div className="flex min-w-0 items-center gap-2">
                    <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: stageTone }}
                        aria-hidden
                    />
                    {order.code ? (
                        <span className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            {order.code}
                        </span>
                    ) : null}
                    {bookingNumber ? (
                        <span className="truncate text-xs font-semibold tracking-wide text-foreground">
                            {bookingNumber}
                        </span>
                    ) : null}
                    <StageBadge label={stageLabel} color={stageTone} />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <StatusControl
                        order={order}
                        status={status}
                        orderStatuses={orderStatuses}
                        locked={!open}
                    />
                    <IconButton
                        type="button"
                        size="sm"
                        className="rounded-full"
                        icon="close-line"
                        aria-label="Close booking details"
                        tooltip="Close"
                        onClick={onClose}
                    />
                </div>
            </div>

            <div className="shrink-0 space-y-4 border-b border-border px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <h2 className="truncate text-2xl font-bold tracking-tight text-foreground">
                            {contactName}
                        </h2>
                        {order.contact?.uuid ? (
                            <ContactCardPopover
                                contact={order.contact}
                                onEdit={onEditContact}
                                className="size-7 shrink-0 justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground"
                            >
                                <Icon name="information-line" className="text-base" />
                            </ContactCardPopover>
                        ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                        {wa ? (
                            <Tooltip>
                                <TooltipTrigger
                                    render={
                                        <a
                                            href={wa}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex size-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 transition-colors hover:bg-emerald-500/25 dark:text-emerald-400"
                                            aria-label="WhatsApp"
                                            onClick={(event) => event.stopPropagation()}
                                        >
                                            <Icon name="whatsapp-line" className="text-lg" />
                                        </a>
                                    }
                                />
                                <TooltipContent>WhatsApp</TooltipContent>
                            </Tooltip>
                        ) : null}
                        {call ? (
                            <Tooltip>
                                <TooltipTrigger
                                    render={
                                        <a
                                            href={call}
                                            className="inline-flex size-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 transition-colors hover:bg-emerald-500/25 dark:text-emerald-400"
                                            aria-label="Call"
                                            onClick={(event) => event.stopPropagation()}
                                        >
                                            <Icon name="phone-line" className="text-lg" />
                                        </a>
                                    }
                                />
                                <TooltipContent>Call</TooltipContent>
                            </Tooltip>
                        ) : null}
                    </div>
                </div>

                <div className="flex flex-wrap items-start gap-x-10 gap-y-2">
                    <BookingAssigneeMenu
                        order={order}
                        assignees={assignees}
                        locked={!open}
                    />
                    <BookingProjectField order={order} />
                </div>
            </div>

            <div className="shrink-0 border-b border-border px-5 py-2">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap gap-2.5">
                        {PANEL_TABS.map(([id, label]) => {
                            const active = tab === id;

                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setTab(id)}
                                    className={cn(
                                        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                                        active
                                            ? "bg-muted text-foreground"
                                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                                    )}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                    {hasActions ? (
                        <div className="flex shrink-0 items-center gap-2">
                            {primary[0] ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => setDialogAction(primary[0].id)}
                                >
                                    {primary[0].label}
                                </Button>
                            ) : null}
                            <DropdownMenu>
                                <DropdownMenuTrigger
                                    render={
                                        <Button type="button" size="sm" variant="outline">
                                            Actions
                                            <Icon name="arrow-down-s-line" className="text-base" />
                                        </Button>
                                    }
                                />
                                <DropdownMenuContent align="end" className="min-w-52">
                                    {primary.slice(1).map((action) => (
                                        <DropdownMenuItem
                                            key={action.id}
                                            onClick={() => setDialogAction(action.id)}
                                        >
                                            {action.label}
                                        </DropdownMenuItem>
                                    ))}
                                    {liaison.length > 0 ? (
                                        <>
                                            {primary.length > 1 ? <DropdownMenuSeparator /> : null}
                                            <p className="px-2 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                                                Sales liaison
                                            </p>
                                            {liaison.map((action) => (
                                                <DropdownMenuItem
                                                    key={action.id}
                                                    onClick={() => runMoreAction(action)}
                                                >
                                                    {action.label}
                                                </DropdownMenuItem>
                                            ))}
                                        </>
                                    ) : null}
                                    {more.length > 0 ? (
                                        <>
                                            {primary.length > 1 || liaison.length > 0 ? (
                                                <DropdownMenuSeparator />
                                            ) : null}
                                            {liaison.length > 0 ? (
                                                <p className="px-2 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                                                    Operations / Accounts
                                                </p>
                                            ) : null}
                                            {more.map((action, index) => {
                                                const showSeparator =
                                                    action.destructive &&
                                                    index > 0 &&
                                                    !more[index - 1]?.destructive;

                                                return (
                                                    <span key={action.id} className="contents">
                                                        {showSeparator ? (
                                                            <DropdownMenuSeparator />
                                                        ) : null}
                                                        <DropdownMenuItem
                                                            className={cn(
                                                                action.destructive &&
                                                                    "text-destructive",
                                                            )}
                                                            onClick={() => runMoreAction(action)}
                                                        >
                                                            {action.label}
                                                        </DropdownMenuItem>
                                                    </span>
                                                );
                                            })}
                                        </>
                                    ) : null}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ) : null}
                </div>
            </div>

            <ScrollArea ref={bodyRef} className="min-h-0 flex-1 bg-background">
                <div className="space-y-6 px-5 py-4">
                    {tab === "overview" ? (
                        <>
                            <DealOverviewSection
                                order={order}
                                totalPrice={totalPrice}
                                bookingAmount={bookingAmount}
                                paid={paid}
                                remaining={remaining}
                            />

                            <BookingPropertyCard order={order} />

                            <section>
                                <h3 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                                    Payment Plan
                                </h3>

                                {hasPlan ? (
                                    <div className="rounded-lg border border-border bg-card px-4 py-3">
                                        <InstallmentsTab
                                            order={order}
                                            deal={deal}
                                            liaisonActive={liaisonActive}
                                            onLogRecovery={() => setTab("activity")}
                                            onPreview={openPrintable}
                                        />
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-5">
                                        <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                            <Icon name="calendar-schedule-line" className="text-xl" />
                                        </div>
                                        <div className="min-w-0 space-y-1">
                                            <p className="text-sm font-semibold text-foreground">
                                                No payment plan yet
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {open && !tokenVerified
                                                    ? "Verify the token before setting a payment plan."
                                                    : canSetPlan
                                                      ? "Set a plan to generate the installment schedule and track collections."
                                                      : "No payment plan is set for this booking."}
                                            </p>
                                        </div>
                                        {canSetPlan ? (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setDialogAction("plan")}
                                            >
                                                Add payment plan
                                            </Button>
                                        ) : null}
                                    </div>
                                )}
                            </section>

                            <section>
                                <h3 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                                    Team
                                </h3>
                                <div className="space-y-2">
                                    <UserCard user={order.sold_by} label="Sold by" size="sm" />
                                    {leadHref ? (
                                        <Link
                                            href={leadHref}
                                            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                                        >
                                            Open lead
                                            <Icon name="arrow-right-s-line" className="text-sm" />
                                        </Link>
                                    ) : null}
                                </div>
                            </section>

                            {(deal?.transfers || []).length > 0 && (
                                <section>
                                    <h3 className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                                        Transfer history
                                    </h3>
                                    <ul className="divide-y divide-border text-sm">
                                        {deal.transfers.map((row) => (
                                            <li key={row.id} className="py-2.5 first:pt-0 last:pb-0">
                                                {row.from || "Previous buyer"} → {row.to || "New buyer"}
                                                <span className="mt-0.5 block text-sm text-muted-foreground">
                                                    Outstanding {formatMoney(row.outstanding)} ·{" "}
                                                    {row.ndc_cleared ? "NDC cleared" : "NDC outstanding"}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}
                            
                        </>
                    ) : null}

                    {tab === "documents" ? (
                        <BookingDocumentsSection
                            order={order}
                            deal={deal}
                            requiredDocuments={bookingDocumentTypes}
                            liaisonActive={liaisonActive}
                            onPreview={openPrintable}
                            onDocumentsApplied={refreshPanel}
                            onOpenBookingForm={openBookingFormPreview}
                        />
                    ) : null}

                    {tab === "activity" ? (
                        <ActivityTimeline
                            entries={deal?.activities || []}
                            active={tab === "activity"}
                            showHeader={false}
                        />
                    ) : null}
                </div>
            </ScrollArea>

            {tab === "activity" ? (
                <NoteComposer
                    orderCode={order.code}
                    locked={cancelled || completed}
                />
            ) : null}

            <FilePreview
                open={printableOpen}
                onOpenChange={(next) => {
                    setPrintableOpen(next);
                    if (!next) {
                        setPrintableDownloadUrl(null);
                        setPrintablePageAspect(null);
                        setPrintableEmailTo(null);
                        setPrintableEmailHandler(null);
                    }
                }}
                files={printableFiles}
                index={printableIndex}
                onIndexChange={setPrintableIndex}
                downloadUrl={printableDownloadUrl}
                pageAspect={printablePageAspect}
                emailTo={printableEmailTo}
                onEmail={printableEmailHandler || undefined}
            />

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
                projects={projects}
                units={units}
                paymentAccounts={paymentAccounts}
                bookingDocumentTypes={bookingDocumentTypes}
                onPanelUpdated={handlePanelUpdated}
                onPreview={openPrintable}
            />
        </div>
    );
}

import { useEffect, useMemo, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import { toast } from "sonner";
import {
    ballot,
    bookingFormPdf,
    deliver,
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
import { cn } from "@/lib/utils";
import { bookingApi } from "@/portal/store/api";
import { BookingKycForm } from "./booking-kyc-form";

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

function post(url, data, success, onDone, options = {}) {
    router.post(pathFrom(url), data, {
        preserveScroll: true,
        forceFormData: data instanceof FormData || data?.receipt instanceof File,
        onSuccess: () => {
            toast.success(success);
            onDone?.();
        },
        onError: (errors) => {
            toast.error(Object.values(errors)[0] || "Unable to update this booking");
            options.onError?.(errors);
        },
        onFinish: () => options.onFinish?.(),
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

export function statusTitle(status, orderStatuses = []) {
    if (!status) {
        return null;
    }

    const match = (orderStatuses || []).find((item) => item.label === status);

    if (match?.title) {
        return match.title;
    }

    return String(status)
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

export function statusColor(status, orderStatuses = []) {
    const match = (orderStatuses || []).find((item) => item.label === status);

    return match?.color || null;
}

export function stageColor(stage, orderStages = []) {
    const match = (orderStages || []).find((item) => item.label === stage || item.id === stage);

    return match?.color || null;
}

export function BookingStageDialog({
    open,
    onOpenChange,
    action,
    order,
    deal,
    projects = [],
    units = [],
    paymentAccounts = [],
    bookingDocumentTypes = [],
    onPanelUpdated,
    onPreview,
}) {
    const { errors = {} } = usePage().props;
    const [verifyStep, setVerifyStep] = useState("form");
    const [verifyErrors, setVerifyErrors] = useState({});
    const [kycStep, setKycStep] = useState("identity");
    const [kycErrors, setKycErrors] = useState({});

    useEffect(() => {
        if (open && action === "verify") {
            setVerifyStep("form");
            setVerifyErrors({});
        }

        if (open && (action === "enter_kyc" || action === "booking")) {
            setKycStep("identity");
            setKycErrors({});
        }
    }, [open, action]);

    if (!action || !order) {
        return null;
    }

    const isKyc = action === "enter_kyc" || action === "booking";

    const title =
        {
            verify:
                verifyStep === "done"
                    ? "Token verified"
                    : verifyStep === "review"
                      ? "Confirm token details"
                      : "Verify token",
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
            <DialogContent
                className={
                    isKyc
                        ? "flex h-[min(90vh,48rem)] max-h-[92vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl lg:max-w-5xl"
                        : action === "verify"
                          ? "max-h-[90vh] gap-8 overflow-y-auto p-7 sm:max-w-2xl"
                          : "max-h-[90vh] overflow-y-auto sm:max-w-lg"
                }
            >
                {isKyc ? (
                    <BookingKycForm
                        order={order}
                        deal={deal}
                        errors={{ ...errors, ...kycErrors }}
                        step={kycStep}
                        onStepChange={setKycStep}
                        onErrorsChange={setKycErrors}
                        onPanelUpdated={onPanelUpdated}
                        bookingDocumentTypes={bookingDocumentTypes}
                        onPreview={onPreview}
                        onDone={() => onOpenChange(false)}
                    />
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>{title}</DialogTitle>
                            <DialogDescription>
                                {order.contact?.display_name || "Booking"}
                                {order.unit?.name ? ` · ${order.unit.name}` : ""}
                                {deal?.net_price != null
                                    ? ` · Net ${formatMoney(deal.net_price)}`
                                    : ""}
                            </DialogDescription>
                        </DialogHeader>
                        {action === "verify" ? (
                            <VerifyTokenForm
                                order={order}
                                deal={deal}
                                projects={projects}
                                units={units}
                                paymentAccounts={paymentAccounts}
                                errors={{ ...errors, ...verifyErrors }}
                                step={verifyStep}
                                onStepChange={setVerifyStep}
                                onErrorsChange={setVerifyErrors}
                                onPanelUpdated={onPanelUpdated}
                                onDone={() => onOpenChange(false)}
                            />
                        ) : null}
                        {action === "plan" ? (
                            <PlanForm
                                order={order}
                                deal={deal}
                                errors={errors}
                                onDone={() => onOpenChange(false)}
                            />
                        ) : null}
                        {action === "tracking" || action === "payment" ? (
                            <PaymentForm
                                order={order}
                                deal={deal}
                                errors={errors}
                                onDone={() => onOpenChange(false)}
                            />
                        ) : null}
                        {action === "ballot" ? (
                            <BallotForm
                                order={order}
                                deal={deal}
                                errors={errors}
                                onDone={() => onOpenChange(false)}
                            />
                        ) : null}
                        {action === "transfer" ? (
                            <TransferForm
                                order={order}
                                deal={deal}
                                errors={errors}
                                onDone={() => onOpenChange(false)}
                            />
                        ) : null}
                        {action === "litigation" ? (
                            <LitigationForm
                                order={order}
                                deal={deal}
                                onDone={() => onOpenChange(false)}
                            />
                        ) : null}
                        {action === "handover" ? (
                            <HandoverForm
                                order={order}
                                deal={deal}
                                errors={errors}
                                onDone={() => onOpenChange(false)}
                            />
                        ) : null}
                        {action === "deliver" ? (
                            <DeliverForm order={order} onDone={() => onOpenChange(false)} />
                        ) : null}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function unitOptionLabel(unit) {
    const name = unit?.name || "Unit";

    return unit?.price != null ? `${name} · ${formatMoney(unit.price)}` : name;
}

function paymentAccountLabel(account) {
    const typeLabel = account?.type === "cash" ? "Cash" : "Bank";
    const details = [account?.bank_name, account?.account_number].filter(Boolean).join(" · ");

    return details
        ? `${account.name} (${typeLabel}) · ${details}`
        : `${account.name} (${typeLabel})`;
}

function defaultPaymentAccountId(accounts = []) {
    const rows = Array.isArray(accounts) ? accounts : [];
    const preferred = rows.find((row) => row.is_default) || rows[0];

    return preferred?.id != null ? String(preferred.id) : "";
}

function formatReviewDate(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function validateVerifyTokenForm(form) {
    const next = {};

    if (!String(form.project_id || "").trim()) {
        next.project_id = "Select a project.";
    }

    if (!String(form.unit_id || "").trim()) {
        next.unit_id = "Select a unit.";
    }

    if (!String(form.contact_name || "").trim()) {
        next.contact_name = "Enter the customer name.";
    }

    if (!String(form.phone_number || "").trim()) {
        next.phone_number = "Enter a phone number.";
    }

    if (form.email_address && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(form.email_address).trim())) {
        next.email_address = "Enter a valid email address.";
    }

    if (form.agreed_price == null || Number(form.agreed_price) < 0) {
        next.agreed_price = "Enter the agreed price.";
    }

    if (form.token_amount == null || Number(form.token_amount) <= 0) {
        next.token_amount = "Enter the token amount.";
    } else if (
        form.agreed_price != null &&
        Number(form.token_amount) > Number(form.agreed_price)
    ) {
        next.token_amount = "The token amount cannot be more than the agreed price.";
    }

    if (!String(form.payment_account_id || "").trim()) {
        next.payment_account_id = "Select a deposit account.";
    }

    if (!String(form.method || "").trim()) {
        next.method = "Select a payment method.";
    }

    if (!String(form.paid_on || "").trim()) {
        next.paid_on = "Select the payment date.";
    }

    if (!form.receipt) {
        next.receipt = "Upload proof of token payment.";
    }

    return next;
}

function ReviewSection({ icon, title, children, className }) {
    return (
        <section
            className={cn(
                "space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs",
                className,
            )}
        >
            <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <Icon name={icon} className="text-base" />
                {title}
            </h3>
            {children}
        </section>
    );
}

function ReviewFact({ label, value, className }) {
    return (
        <div className={cn("min-w-0 space-y-1", className)}>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {label}
            </p>
            <p className="wrap-break-word text-sm font-medium text-foreground">{value || "—"}</p>
        </div>
    );
}

function ReviewMetric({ label, value, emphasize = false }) {
    return (
        <div
            className={cn(
                "min-w-0 rounded-xl border px-3.5 py-3 shadow-xs",
                emphasize
                    ? "border-primary/25 bg-primary/5"
                    : "border-border/70 bg-background",
            )}
        >
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p
                className={cn(
                    "mt-1 truncate text-lg font-semibold tracking-tight tabular-nums",
                    emphasize ? "text-primary" : "text-foreground",
                )}
            >
                {value || "—"}
            </p>
        </div>
    );
}

function VerifyTokenForm({
    order,
    deal,
    projects = [],
    units = [],
    paymentAccounts = [],
    errors,
    step = "form",
    onStepChange,
    onErrorsChange,
    onPanelUpdated,
    onDone,
}) {
    const methods = paymentMethodOptions(deal);
    const accounts =
        paymentAccounts.length > 0
            ? paymentAccounts
            : Array.isArray(deal?.payment_accounts)
              ? deal.payment_accounts
              : [];
    const contact = order?.contact || {};
    const [form, setForm] = useState({
        contact_name: contact.display_name || "",
        phone_number: contact.phone_number || "",
        email_address: contact.email_address || "",
        identity_kind: deal?.booking?.identity_kind || "cnic",
        identity_number:
            deal?.booking?.identity_number || contact.cnic || "",
        project_id: order?.project_id ? String(order.project_id) : order?.project?.id ? String(order.project.id) : "",
        unit_id: order?.unit_id ? String(order.unit_id) : order?.unit?.id ? String(order.unit.id) : "",
        payment_account_id: defaultPaymentAccountId(accounts),
        agreed_price:
            order?.agreed_price != null
                ? Number(order.agreed_price)
                : deal?.net_price != null
                  ? Number(deal.net_price)
                  : null,
        token_amount:
            deal?.booking?.token_amount != null && Number(deal.booking.token_amount) > 0
                ? Number(deal.booking.token_amount)
                : null,
        method: methods[0] || "Cash",
        reference: "",
        paid_on: new Date().toISOString().slice(0, 10),
        receipt: null,
    });
    const [clientErrors, setClientErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [verifyToken] = bookingApi.useVerifyTokenMutation();

    const fieldErrors = { ...clientErrors, ...errors };

    const projectOptions = useMemo(
        () =>
            projects.map((project) => ({
                value: String(project.id),
                label: project.title,
                image: project.thumbnail || undefined,
                icon: project.thumbnail ? undefined : "community-line",
            })),
        [projects],
    );

    const unitOptions = useMemo(() => {
        const currentUnitId = order?.unit_id
            ? String(order.unit_id)
            : order?.unit?.id
              ? String(order.unit.id)
              : "";

        return units
            .filter((unit) => {
                const bookable = unit.status === "AVAILABLE" || unit.status === "HOLD";
                const current = String(unit.id) === currentUnitId;

                if (!bookable && !current) {
                    return false;
                }

                if (form.project_id && String(unit.project_id) !== form.project_id) {
                    return false;
                }

                return true;
            })
            .map((unit) => ({
                value: String(unit.id),
                label: unitOptionLabel(unit),
            }));
    }, [units, form.project_id, order?.unit_id, order?.unit?.id]);

    const accountOptions = useMemo(
        () =>
            accounts.map((account) => ({
                value: String(account.id),
                label: paymentAccountLabel(account),
            })),
        [accounts],
    );

    const selectedProject = projects.find((item) => String(item.id) === String(form.project_id));
    const selectedUnit = units.find((item) => String(item.id) === String(form.unit_id));
    const selectedAccount = accounts.find(
        (item) => String(item.id) === String(form.payment_account_id),
    );
    const bookingNumber = order?.booking_number || deal?.booking?.booking_number;
    const letterDownloadUrl = order?.code
        ? pathFrom(bookingFormPdf.url(order.code))
        : null;

    const downloadLetter = () => {
        if (!letterDownloadUrl) {
            return;
        }

        window.location.assign(letterDownloadUrl);
    };

    const goToReview = () => {
        const nextErrors = validateVerifyTokenForm(form);

        if (Object.keys(nextErrors).length > 0) {
            setClientErrors(nextErrors);
            onErrorsChange?.({});
            toast.error(Object.values(nextErrors)[0]);
            return;
        }

        setClientErrors({});
        onErrorsChange?.({});
        onStepChange?.("review");
    };

    const confirmVerify = async () => {
        if (!order?.code) {
            return;
        }

        setSubmitting(true);
        onErrorsChange?.({});

        try {
            const panel = await verifyToken({
                code: order.code,
                contact_name: form.contact_name,
                phone_number: form.phone_number,
                email_address: form.email_address || "",
                identity_kind: form.identity_kind || "cnic",
                identity_number: form.identity_number || "",
                cnic: form.identity_kind === "cnic" ? form.identity_number || "" : "",
                project_id: form.project_id ? Number(form.project_id) : null,
                unit_id: form.unit_id ? Number(form.unit_id) : null,
                payment_account_id: form.payment_account_id
                    ? Number(form.payment_account_id)
                    : null,
                agreed_price: form.agreed_price,
                token_amount: form.token_amount,
                method: form.method,
                reference: form.reference || "",
                paid_on: form.paid_on,
                receipt: form.receipt,
            }).unwrap();

            toast.success("Token verified");
            onPanelUpdated?.(panel);
            onStepChange?.("done");
        } catch (error) {
            const nextErrors = {};
            const rawErrors = error?.errors && typeof error.errors === "object" ? error.errors : {};

            Object.entries(rawErrors).forEach(([key, value]) => {
                nextErrors[key] = Array.isArray(value) ? value[0] : value;
            });

            if (Object.keys(nextErrors).length > 0) {
                onErrorsChange?.(nextErrors);
            }

            toast.error(
                Object.values(nextErrors)[0] ||
                    error?.message ||
                    "Unable to verify this token",
            );
            onStepChange?.("form");
        } finally {
            setSubmitting(false);
        }
    };

    if (step === "done") {
        return (
            <div className="space-y-6">
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-foreground">
                    <p className="font-medium">Token payment verified</p>
                    <p className="mt-1.5 text-muted-foreground">
                        {bookingNumber
                            ? `Booking number ${bookingNumber} is ready for documentation.`
                            : "You can download the booking confirmation letter now."}
                    </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs">
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                            Booking confirmation letter
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Download the branded PDF for this booking.
                        </p>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        disabled={!letterDownloadUrl}
                        onClick={downloadLetter}
                    >
                        <Icon name="download-2-line" className="text-base" />
                        Download
                    </Button>
                </div>

                <DialogFooter className="pt-1">
                    <Button type="button" onClick={() => onDone?.()}>
                        Done
                    </Button>
                </DialogFooter>
            </div>
        );
    }

    if (step === "review") {
        const unitName = selectedUnit?.name || "—";
        const accountTypeLabel = selectedAccount?.type === "cash" ? "Cash" : "Bank";

        return (
            <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                    Review everything below, then confirm to verify the token payment.
                </p>

                <article className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
                    <div className="flex gap-3 p-4">
                        <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-18">
                            {selectedProject?.thumbnail ? (
                                <img
                                    src={selectedProject.thumbnail}
                                    alt=""
                                    className="absolute inset-0 size-full object-cover"
                                />
                            ) : (
                                <div className="flex size-full items-center justify-center text-muted-foreground">
                                    <Icon name="community-line" className="text-xl" />
                                </div>
                            )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5 py-0.5">
                            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                                Property
                            </p>
                            <h4 className="truncate text-base font-semibold tracking-tight text-foreground">
                                {unitName}
                            </h4>
                            <p className="truncate text-sm text-muted-foreground">
                                {selectedProject?.title || "—"}
                            </p>
                            {selectedUnit?.price != null ? (
                                <p className="text-xs text-muted-foreground">
                                    List price{" "}
                                    <span className="font-medium text-foreground">
                                        {formatMoney(selectedUnit.price)}
                                    </span>
                                </p>
                            ) : null}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 border-t border-border/70 bg-muted/20 p-4">
                        <ReviewMetric
                            label="Agreed price"
                            value={
                                form.agreed_price != null
                                    ? formatMoney(form.agreed_price)
                                    : null
                            }
                        />
                        <ReviewMetric
                            label="Token amount"
                            value={
                                form.token_amount != null
                                    ? formatMoney(form.token_amount)
                                    : null
                            }
                            emphasize
                        />
                    </div>
                </article>

                <ReviewSection icon="user-line" title="Customer">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <ReviewFact label="Name" value={form.contact_name} className="sm:col-span-2" />
                        <ReviewFact label="Phone" value={form.phone_number} />
                        <ReviewFact label="Email" value={form.email_address} />
                        <ReviewFact
                            label="Identity"
                            value={
                                form.identity_number
                                    ? `${String(form.identity_kind || "cnic").toUpperCase()} · ${form.identity_number}`
                                    : null
                            }
                            className="sm:col-span-2"
                        />
                    </div>
                </ReviewSection>

                <ReviewSection icon="bank-card-line" title="Token payment">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <ReviewFact
                            label="Deposit account"
                            value={
                                selectedAccount
                                    ? `${selectedAccount.name} · ${accountTypeLabel}`
                                    : null
                            }
                            className="sm:col-span-2"
                        />
                        {selectedAccount &&
                        (selectedAccount.bank_name || selectedAccount.account_number) ? (
                            <ReviewFact
                                label="Account details"
                                value={[selectedAccount.bank_name, selectedAccount.account_number]
                                    .filter(Boolean)
                                    .join(" · ")}
                                className="sm:col-span-2"
                            />
                        ) : null}
                        <ReviewFact label="Method" value={form.method} />
                        <ReviewFact label="Paid on" value={formatReviewDate(form.paid_on)} />
                        <ReviewFact label="Reference" value={form.reference} />
                        <div className="min-w-0 space-y-1">
                            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                                Proof
                            </p>
                            {form.receipt?.name ? (
                                <div className="inline-flex max-w-full items-center gap-2 rounded-md border border-border/70 bg-muted/30 px-2.5 py-1.5 text-sm font-medium text-foreground">
                                    <Icon
                                        name="file-text-line"
                                        className="shrink-0 text-base text-muted-foreground"
                                    />
                                    <span className="min-w-0 truncate">{form.receipt.name}</span>
                                </div>
                            ) : (
                                <p className="text-sm font-medium text-foreground">—</p>
                            )}
                        </div>
                    </div>
                </ReviewSection>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs">
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                            Booking confirmation letter
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            The letter updates with the booking number after you confirm.
                        </p>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        disabled={!letterDownloadUrl}
                        onClick={downloadLetter}
                    >
                        <Icon name="download-2-line" className="text-base" />
                        Download
                    </Button>
                </div>

                <DialogFooter className="pt-1 sm:justify-between">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onStepChange?.("form")}
                        disabled={submitting}
                    >
                        Back
                    </Button>
                    <Button type="button" loading={submitting} onClick={confirmVerify}>
                        Confirm
                    </Button>
                </DialogFooter>
            </div>
        );
    }

    return (
        <form
            className="space-y-6"
            onSubmit={(event) => {
                event.preventDefault();
                goToReview();
            }}
            >
       

            <div className="grid gap-4 sm:grid-cols-2">
                <SelectBox
                    label="Project"
                    required
                    clearable
                    value={form.project_id}
                    options={projectOptions}
                    placeholder="Select project"
                    error={fieldErrors.project_id}
                    onValueChange={(value) =>
                        setForm((current) => ({
                            ...current,
                            project_id: value || "",
                            unit_id: "",
                        }))
                    }
                />
                <SelectBox
                    label="Unit"
                    required
                    clearable
                    value={form.unit_id}
                    options={unitOptions}
                    placeholder="Select unit"
                    error={fieldErrors.unit_id}
                    onValueChange={(value) => {
                        const next = value || "";
                        const unit = units.find((item) => String(item.id) === next);

                        setForm((current) => ({
                            ...current,
                            unit_id: next,
                            project_id: unit?.project_id
                                ? String(unit.project_id)
                                : current.project_id,
                            agreed_price:
                                unit?.price != null ? Number(unit.price) : current.agreed_price,
                        }));
                    }}
                />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Input
                    label="Customer name"
                    required
                    value={form.contact_name}
                    error={fieldErrors.contact_name}
                    onChange={(event) =>
                        setForm((current) => ({ ...current, contact_name: event.target.value }))
                    }
                />
                <Input
                    label="Phone"
                    required
                    value={form.phone_number}
                    error={fieldErrors.phone_number}
                    onChange={(event) =>
                        setForm((current) => ({ ...current, phone_number: event.target.value }))
                    }
                />
                <Input
                    label="Email"
                    type="email"
                    value={form.email_address}
                    error={fieldErrors.email_address}
                    onChange={(event) =>
                        setForm((current) => ({ ...current, email_address: event.target.value }))
                    }
                />
                <SelectBox
                    label="Identity"
                    value={form.identity_kind}
                    options={[
                        { value: "cnic", label: "CNIC" },
                        { value: "nicop", label: "NICOP" },
                        { value: "passport", label: "Passport" },
                    ]}
                    onValueChange={(value) =>
                        setForm((current) => ({
                            ...current,
                            identity_kind: value || "cnic",
                        }))
                    }
                />
                <Input
                    label="Identity number"
                    value={form.identity_number}
                    error={fieldErrors.identity_number || fieldErrors.cnic}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            identity_number: event.target.value,
                        }))
                    }
                />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <NumberInput
                    label="Agreed price"
                    required
                    min={0}
                    step={0.01}
                    allowDecimal
                    value={form.agreed_price}
                    error={fieldErrors.agreed_price}
                    onChange={(value) => setForm((current) => ({ ...current, agreed_price: value }))}
                />
                <NumberInput
                    label="Token amount"
                    required
                    min={0.01}
                    step={0.01}
                    allowDecimal
                    value={form.token_amount}
                    error={fieldErrors.token_amount}
                    onChange={(value) => setForm((current) => ({ ...current, token_amount: value }))}
                />
                <SelectBox
                    label="Deposit account"
                    required
                    value={form.payment_account_id}
                    options={accountOptions}
                    placeholder="Select account"
                    error={fieldErrors.payment_account_id}
                    onValueChange={(value) =>
                        setForm((current) => ({
                            ...current,
                            payment_account_id: value || "",
                        }))
                    }
                />
                <ComboBox
                    label="Payment method"
                    required
                    value={form.method}
                    options={methods}
                    placeholder="Cash, Pay order..."
                    error={fieldErrors.method}
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
                    error={fieldErrors.paid_on}
                    onChange={(value) => setForm((current) => ({ ...current, paid_on: value }))}
                />
                <Input
                    label="Reference"
                    value={form.reference}
                    error={fieldErrors.reference}
                    onChange={(event) =>
                        setForm((current) => ({ ...current, reference: event.target.value }))
                    }
                />
            </div>

            <div className="space-y-2">
                <p className="text-label font-medium text-muted-foreground">
                    Proof of token payment <span className="text-destructive">*</span>
                </p>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2.5 text-sm shadow-xs transition-colors hover:bg-muted/40">
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
                {fieldErrors.receipt ? (
                    <p className="text-[13px] text-destructive">{fieldErrors.receipt}</p>
                ) : null}
            </div>

            <DialogFooter className="pt-1">
                <Button type="submit">Continue</Button>
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
        down_payment: saved.down_payment != null ? Number(saved.down_payment) : null,
        handover_percent: saved.handover_percent != null ? Number(saved.handover_percent) : 10,
        installment_count: saved.installment_count != null ? Number(saved.installment_count) : 12,
        frequency: saved.frequency || "monthly",
        first_due_on: "",
        late_fee_basis: saved.late_fee_basis || "monthly",
        late_fee_rate: saved.late_fee_rate != null ? Number(saved.late_fee_rate) : 0,
    });

    useEffect(() => {
        const selected = templates.find((item) => String(item.id) === String(form.template_id));

        if (!selected || selected.id === "custom") {
            return;
        }

        setForm((current) => ({
            ...current,
            frequency: selected.frequency || current.frequency,
            installment_count:
                selected.count != null ? Number(selected.count) : current.installment_count,
            handover_percent:
                selected.handover_percent != null
                    ? Number(selected.handover_percent)
                    : current.handover_percent,
            down_payment:
                selected.down_payment_percent != null && deal?.net_price
                    ? Math.round((Number(deal.net_price) * Number(selected.down_payment_percent)) / 100)
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
                <NumberInput
                    label="Down payment"
                    required
                    min={0}
                    step={0.01}
                    allowDecimal
                    value={form.down_payment}
                    error={errors.down_payment}
                    onChange={(value) => setForm((current) => ({ ...current, down_payment: value }))}
                />
                <NumberInput
                    label="Handover %"
                    required
                    min={0}
                    max={100}
                    step={0.01}
                    allowDecimal
                    value={form.handover_percent}
                    error={errors.handover_percent}
                    onChange={(value) => setForm((current) => ({ ...current, handover_percent: value }))}
                />
                {isCustom ? (
                    <>
                        <NumberInput
                            label="Installments"
                            min={1}
                            max={120}
                            step={1}
                            value={form.installment_count}
                            error={errors.installment_count}
                            onChange={(value) =>
                                setForm((current) => ({ ...current, installment_count: value }))
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
                Transfer this file to a new buyer. Stage stays the same; payment history remains on this booking.
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
                <ul className="space-y-1.5 rounded-md border border-border/70 px-3 py-2 text-sm text-muted-foreground">
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

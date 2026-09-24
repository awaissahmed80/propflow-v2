import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import {
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { SelectBox } from "@/components/ui/select";
import { Icon } from "@/components/ui/icon";
import { MetaComboBox } from "@/components/ui/meta-combo-box";
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { bookingApi } from "@/portal/store/api";
import { BookingDocumentsSection } from "./booking-documents-section";

const IDENTITY_KIND_OPTIONS = [
    { value: "cnic", label: "CNIC" },
    { value: "nicop", label: "NICOP" },
    { value: "passport", label: "Passport" },
];

export const KYC_STEPS = ["identity", "nominee", "category", "documents", "review"];

const KYC_STEP_META = {
    identity: {
        title: "Buyer identity",
        description: "Legal name, ID, and phones",
        icon: "user-line",
    },
    nominee: {
        title: "Next of kin",
        description: "Nominee and relation",
        icon: "group-line",
    },
    category: {
        title: "Category & pricing",
        description: "Category, pricing, and payment plan",
        icon: "price-tag-3-line",
    },
    documents: {
        title: "Documents",
        description: "Required KYC files",
        icon: "file-list-3-line",
    },
    review: {
        title: "Review",
        description: "Confirm and complete",
        icon: "checkbox-circle-line",
    },
};

export function kycStepTitle(step) {
    return KYC_STEP_META[step]?.title || "Enter Booking & KYC";
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

function LockedUnitBanner({ order }) {
    const parts = [order?.project?.title, order?.unit?.name].filter(Boolean);

    return (
        <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/30 px-3.5 py-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-xs">
                <Icon name="lock-line" className="text-base" />
            </span>
            <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                    {parts.length > 0 ? parts.join(" · ") : "Unit assigned"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                    Unit is locked after token verification and cannot be changed at this stage.
                </p>
            </div>
        </div>
    );
}

function formatTokenPaidOn(value) {
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

function TokenVerificationSummary({ order, deal }) {
    const booking = deal?.booking || {};
    const tokenPayment = booking.token_payment || null;
    const agreedPrice =
        booking.agreed_price != null
            ? Number(booking.agreed_price)
            : order?.agreed_price != null
              ? Number(order.agreed_price)
              : null;
    const tokenAmount =
        booking.token_amount != null
            ? Number(booking.token_amount)
            : tokenPayment?.amount != null
              ? Number(tokenPayment.amount)
              : null;

    return (
        <ReviewSection icon="shield-check-line" title="Token verification">
            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-3">
                <ReviewMetric
                    label="Agreed price"
                    value={agreedPrice != null ? formatMoney(agreedPrice) : "—"}
                />
                <ReviewMetric
                    label="Token amount"
                    value={tokenAmount != null ? formatMoney(tokenAmount) : "—"}
                    emphasize
                />
                <ReviewMetric
                    label="Booking number"
                    value={booking.booking_number || "—"}
                />
            </div>
            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                <ReviewFact label="Payment method" value={tokenPayment?.method} />
                <ReviewFact
                    label="Deposit account"
                    value={tokenPayment?.payment_account}
                />
                <ReviewFact
                    label="Token payment date"
                    value={formatTokenPaidOn(tokenPayment?.paid_on)}
                />
                <ReviewFact label="Reference" value={tokenPayment?.reference} />
            </div>
        </ReviewSection>
    );
}

function KycStepNav({ step, onSelect }) {
    const index = KYC_STEPS.indexOf(step);

    return (
        <ol className="relative space-y-1">
            {KYC_STEPS.map((id, i) => {
                const meta = KYC_STEP_META[id];
                const active = i === index;
                const done = i < index;
                const upcoming = i > index;
                const isLast = i === KYC_STEPS.length - 1;
                const canSelect = done || active;

                return (
                    <li key={id} className="relative">
                        {!isLast ? (
                            <span
                                className={cn(
                                    "absolute top-9 -bottom-1 left-4.5 w-px",
                                    done ? "bg-primary/40" : "bg-border",
                                )}
                                aria-hidden
                            />
                        ) : null}

                        <button
                            type="button"
                            disabled={!canSelect}
                            onClick={() => {
                                if (done) {
                                    onSelect?.(id);
                                }
                            }}
                            className={cn(
                                "relative z-1 flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left transition-colors",
                                active
                                    ? "bg-primary/10"
                                    : canSelect
                                      ? "hover:bg-muted/60"
                                      : "cursor-default opacity-60",
                            )}
                        >
                            <span
                                className={cn(
                                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1",
                                    active
                                        ? "bg-primary text-primary-foreground ring-primary"
                                        : done
                                          ? "bg-primary/15 text-primary ring-primary/30"
                                          : "bg-muted text-muted-foreground ring-border",
                                )}
                            >
                                {done && !active ? (
                                    <Icon name="check-line" className="text-sm" />
                                ) : (
                                    i + 1
                                )}
                            </span>

                            <span className="min-w-0 pt-0.5">
                                <span
                                    className={cn(
                                        "block text-sm font-medium",
                                        active
                                            ? "text-foreground"
                                            : upcoming
                                              ? "text-muted-foreground"
                                              : "text-foreground",
                                    )}
                                >
                                    {meta.title}
                                </span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                    {meta.description}
                                </span>
                            </span>
                        </button>
                    </li>
                );
            })}
        </ol>
    );
}

function validateIdentity(form) {
    const next = {};

    if (!String(form.customer_legal_name || "").trim()) {
        next.customer_legal_name = "Enter the customer’s legal name.";
    }

    if (!String(form.identity_kind || "").trim()) {
        next.identity_kind = "Select an identity type.";
    }

    if (!String(form.identity_number || "").trim()) {
        next.identity_number = "Enter the identity number.";
    }

    if (!String(form.international_phone || "").trim()) {
        next.international_phone = "Enter the main phone number.";
    }

    return next;
}

function validateNominee(form) {
    const next = {};

    if (!String(form.nominee_name || "").trim()) {
        next.nominee_name = "Enter the nominee name.";
    }

    if (!String(form.nominee_relation || "").trim()) {
        next.nominee_relation = "Enter the relation.";
    }

    if (!String(form.nominee_identity_kind || "").trim()) {
        next.nominee_identity_kind = "Select an identity type.";
    }

    if (!String(form.nominee_cnic || "").trim()) {
        next.nominee_cnic = "Enter the nominee identity number.";
    }

    return next;
}

function validateCategory(form) {
    const next = {};

    if (!String(form.category || "").trim()) {
        next.category = "Select a category.";
    }

    if (form.premium_percent == null || Number(form.premium_percent) < 0) {
        next.premium_percent = "Premium cannot be negative.";
    } else if (Number(form.premium_percent) > 100) {
        next.premium_percent = "Premium cannot exceed 100%.";
    }

    if (form.discount_percent == null || Number(form.discount_percent) < 0) {
        next.discount_percent = "Discount cannot be negative.";
    } else if (Number(form.discount_percent) > 100) {
        next.discount_percent = "Discount cannot exceed 100%.";
    }

    if (!String(form.template_id || "").trim()) {
        next.template_id = "Choose a payment plan template.";
    }

    if (form.down_payment == null || Number(form.down_payment) < 0) {
        next.down_payment = "Enter the down payment.";
    }

    if (form.handover_percent == null || Number(form.handover_percent) < 0) {
        next.handover_percent = "Enter the handover percent.";
    } else if (Number(form.handover_percent) > 100) {
        next.handover_percent = "Handover cannot exceed 100%.";
    }

    if (String(form.template_id) === "custom") {
        if (form.installment_count == null || Number(form.installment_count) < 1) {
            next.installment_count = "Enter the installment count.";
        }

        if (!String(form.frequency || "").trim()) {
            next.frequency = "Choose a payment frequency.";
        }
    }

    if (!String(form.first_due_on || "").trim()) {
        next.first_due_on = "Choose the first due date.";
    }

    return next;
}

function initialPlanTemplate(deal) {
    const saved = deal?.plan || {};
    const templates = deal?.templates || [];

    if (saved.template?.startsWith?.("template:")) {
        return saved.template.replace("template:", "");
    }

    const match = templates.find((item) => String(item.id) !== "custom");

    return match ? String(match.id) : "custom";
}

function planTemplateLabel(deal, templateId) {
    const match = (deal?.templates || []).find(
        (item) => String(item.id) === String(templateId),
    );

    return match?.label || (templateId === "custom" ? "Custom" : templateId || "—");
}

function moneyFromPercent(base, percent) {
    const amount = Number(base || 0) * (Number(percent || 0) / 100);

    return Math.round(amount * 100) / 100;
}

function percentFromMoney(base, money) {
    const agreed = Number(base || 0);

    if (agreed <= 0) {
        return 0;
    }

    return Math.round((Number(money || 0) / agreed) * 10000) / 100;
}

function inventorySnapshot(order, booking = {}) {
    return {
        phase: booking.phase || order?.project?.title || "",
        sector: booking.sector || order?.unit?.sector || "",
        plot_or_file:
            booking.plot_or_file || order?.unit?.name || order?.unit?.code || "",
    };
}

function identityKindLabel(kind) {
    return IDENTITY_KIND_OPTIONS.find((row) => row.value === kind)?.label || kind || "—";
}

function categoryLabel(category) {
    const value = String(category || "").trim();

    return value || "—";
}

export function BookingKycForm({
    order,
    deal,
    errors = {},
    step = "identity",
    onStepChange,
    onErrorsChange,
    onPanelUpdated,
    bookingDocumentTypes = [],
    onPreview,
    onDone,
}) {
    const bookingData = deal?.booking || {};
    const planData = deal?.plan || {};
    const templates = deal?.templates || [];
    const agreedPrice = Number(order?.agreed_price ?? bookingData.agreed_price ?? 0);
    const [form, setForm] = useState({
        customer_legal_name:
            bookingData.customer_legal_name || order?.contact?.display_name || "",
        identity_kind: bookingData.identity_kind || "cnic",
        identity_number:
            bookingData.identity_number || order?.contact?.cnic || "",
        overseas: Boolean(bookingData.overseas),
        local_phone: bookingData.local_phone || "",
        international_phone:
            bookingData.international_phone || order?.contact?.phone_number || "",
        nominee_name: bookingData.nominee_name || "",
        nominee_relation: bookingData.nominee_relation || "",
        nominee_identity_kind: bookingData.nominee_identity_kind || "cnic",
        nominee_cnic: bookingData.nominee_cnic || "",
        nominee_phone: bookingData.nominee_phone || "",
        category: bookingData.category || "",
        premium_percent: percentFromMoney(agreedPrice, bookingData.premium),
        discount_percent: percentFromMoney(agreedPrice, bookingData.discount),
        template_id: initialPlanTemplate(deal),
        down_payment:
            planData.down_payment != null ? Number(planData.down_payment) : null,
        handover_percent:
            planData.handover_percent != null ? Number(planData.handover_percent) : 10,
        installment_count:
            planData.installment_count != null ? Number(planData.installment_count) : 12,
        frequency: planData.frequency || "monthly",
        first_due_on: "",
        late_fee_basis: planData.late_fee_basis || "monthly",
        late_fee_rate: planData.late_fee_rate != null ? Number(planData.late_fee_rate) : 0,
    });
    const [clientErrors, setClientErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [completeKyc] = bookingApi.useCompleteKycMutation();
    const [fetchPanel] = bookingApi.useLazyPanelQuery();

    const fieldErrors = { ...clientErrors, ...errors };
    const docsReady = Boolean(deal?.kyc_docs_ready);
    const requiredDocs =
        bookingDocumentTypes.length > 0
            ? bookingDocumentTypes
            : [];
    const mandatoryDocs = requiredDocs.filter((item) => item.is_required !== false);

    const premiumAmount = moneyFromPercent(agreedPrice, form.premium_percent);
    const discountAmount = moneyFromPercent(agreedPrice, form.discount_percent);
    const netPreview = Math.max(0, agreedPrice + premiumAmount - discountAmount);
    const isCustomPlan = String(form.template_id) === "custom";

    useEffect(() => {
        const selected = templates.find(
            (item) => String(item.id) === String(form.template_id),
        );

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
                selected.down_payment_percent != null
                    ? Math.round(
                          (netPreview * Number(selected.down_payment_percent)) / 100,
                      )
                    : current.down_payment,
        }));
        // Only re-apply template defaults when the template changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.template_id]);

    const missingDocTitles = useMemo(() => {
        if (mandatoryDocs.length === 0) {
            return [];
        }

        const linked = new Set(
            (deal?.kyc_documents || []).map((doc) => doc.label).filter(Boolean),
        );

        return mandatoryDocs
            .filter((item) => !linked.has(item.label))
            .map((item) => item.title || item.label);
    }, [deal?.kyc_documents, mandatoryDocs]);

    const setField = (key, value) => {
        setForm((current) => ({ ...current, [key]: value }));
    };

    const goNext = (validator, nextStep) => {
        const nextErrors = validator(form);

        if (Object.keys(nextErrors).length > 0) {
            setClientErrors(nextErrors);
            onErrorsChange?.({});
            toast.error(Object.values(nextErrors)[0]);
            return;
        }

        setClientErrors({});
        onErrorsChange?.({});
        onStepChange?.(nextStep);
    };

    const goBack = (prevStep) => {
        setClientErrors({});
        onErrorsChange?.({});
        onStepChange?.(prevStep);
    };

    const refreshDocuments = async () => {
        if (!order?.code) {
            return;
        }

        try {
            const panel = await fetchPanel(order.code).unwrap();
            onPanelUpdated?.(panel);
        } catch (error) {
            toast.error(error?.message || "Unable to refresh booking documents");
        }
    };

    const submitKyc = async () => {
        if (!order?.code) {
            return;
        }

        if (mandatoryDocs.length > 0 && !docsReady) {
            toast.error(
                missingDocTitles.length > 0
                    ? `Upload mandatory documents: ${missingDocTitles.join(", ")}.`
                    : "Upload all mandatory KYC documents before completing.",
            );
            onStepChange?.("documents");
            return;
        }

        setSubmitting(true);
        onErrorsChange?.({});

        try {
            const inventory = inventorySnapshot(order, bookingData);
            const panel = await completeKyc({
                code: order.code,
                customer_legal_name: form.customer_legal_name,
                identity_kind: form.identity_kind,
                identity_number: form.identity_number,
                overseas: Boolean(form.overseas),
                local_phone: form.local_phone || "",
                international_phone: form.international_phone || "",
                nominee_name: form.nominee_name,
                nominee_relation: form.nominee_relation,
                nominee_identity_kind: form.nominee_identity_kind,
                nominee_cnic: form.nominee_cnic,
                nominee_phone: form.nominee_phone || "",
                phase: inventory.phase,
                sector: inventory.sector,
                plot_or_file: inventory.plot_or_file,
                category: form.category,
                premium: moneyFromPercent(agreedPrice, form.premium_percent),
                discount: moneyFromPercent(agreedPrice, form.discount_percent),
                template_id: isCustomPlan ? "custom" : form.template_id,
                template: isCustomPlan ? "custom" : undefined,
                down_payment: form.down_payment ?? 0,
                handover_percent: form.handover_percent ?? 0,
                installment_count: form.installment_count,
                frequency: form.frequency,
                first_due_on: form.first_due_on,
                late_fee_basis: form.late_fee_basis,
                late_fee_rate: form.late_fee_rate ?? 0,
            }).unwrap();

            toast.success("Booking & KYC completed");
            onPanelUpdated?.(panel);
            onDone?.();
        } catch (error) {
            const nextErrors = {};
            const rawErrors = error?.errors && typeof error.errors === "object" ? error.errors : {};

            Object.entries(rawErrors).forEach(([key, value]) => {
                nextErrors[key] = Array.isArray(value) ? value[0] : value;
            });

            if (Object.keys(nextErrors).length > 0) {
                onErrorsChange?.(nextErrors);
            }

            const message =
                nextErrors.documents ||
                Object.values(nextErrors)[0] ||
                error?.message ||
                "Unable to complete Booking & KYC";

            toast.error(message);

            if (nextErrors.documents) {
                onStepChange?.("documents");
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <aside className="shrink-0 border-b border-border bg-muted/25 px-5 py-5 md:w-60 md:border-r md:border-b-0 lg:w-64">
                <div className="mb-5 pr-8">
                    <DialogTitle className="text-base font-semibold tracking-tight">
                        Booking &amp; KYC
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-xs leading-relaxed">
                        {[order?.contact?.display_name, order?.unit?.name]
                            .filter(Boolean)
                            .join(" · ") || "Complete buyer details to activate this booking."}
                        {deal?.net_price != null
                            ? ` · Net ${formatMoney(deal.net_price)}`
                            : ""}
                    </DialogDescription>
                </div>

                <KycStepNav
                    step={step}
                    onSelect={(nextStep) => {
                        setClientErrors({});
                        onErrorsChange?.({});
                        onStepChange?.(nextStep);
                    }}
                />
            </aside>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-5 sm:px-4">
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold tracking-tight text-foreground">
                            {kycStepTitle(step)}
                        </h3>
                        {KYC_STEP_META[step]?.description ? (
                            <p className="mt-0.5 text-sm text-muted-foreground">
                                {KYC_STEP_META[step].description}
                            </p>
                        ) : null}
                    </div>

                    {step === "identity" ? (
                        <TokenVerificationSummary order={order} deal={deal} />
                    ) : null}
                    <LockedUnitBanner order={order} />

                    {step === "identity" ? (
                        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                            <div className="space-y-1 sm:col-span-2">
                                <Input
                                    label="Legal name"
                                    required
                                    info="Name as it should appear on legal booking documents. Can differ from the CRM contact name."
                                    value={form.customer_legal_name}
                                    error={fieldErrors.customer_legal_name}
                                    onChange={(event) =>
                                        setField("customer_legal_name", event.target.value)
                                    }
                                />
                                {order?.contact?.display_name ? (
                                    <p className="text-xs text-muted-foreground">
                                        Contact on file: {order.contact.display_name}
                                    </p>
                                ) : null}
                            </div>
                            <SelectBox
                                label="Identity"
                                value={form.identity_kind}
                                options={IDENTITY_KIND_OPTIONS}
                                onValueChange={(value) =>
                                    setField("identity_kind", value || "cnic")
                                }
                            />
                            <Input
                                label="Identity number"
                                required
                                value={form.identity_number}
                                error={fieldErrors.identity_number}
                                onChange={(event) =>
                                    setField("identity_number", event.target.value)
                                }
                            />
                            <div className="sm:col-span-2">
                                <Checkbox
                                    checked={Boolean(form.overseas)}
                                    onCheckedChange={(value) =>
                                        setField("overseas", Boolean(value))
                                    }
                                >
                                    Overseas buyer
                                </Checkbox>
                            </div>
                            <PhoneInput
                                label="Main phone number"
                                required
                                value={form.international_phone}
                                error={fieldErrors.international_phone}
                                onChange={(value) => setField("international_phone", value)}
                            />
                            <PhoneInput
                                label="Alternate phone number"
                                value={form.local_phone}
                                error={fieldErrors.local_phone}
                                onChange={(value) => setField("local_phone", value)}
                            />
                        </div>
                    ) : null}

                    {step === "nominee" ? (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Record next of kin (nominee) details and their identity document
                                number.
                            </p>
                            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                                <Input
                                    label="Nominee name"
                                    required
                                    value={form.nominee_name}
                                    error={fieldErrors.nominee_name}
                                    onChange={(event) =>
                                        setField("nominee_name", event.target.value)
                                    }
                                />
                                <Input
                                    label="Relation"
                                    required
                                    value={form.nominee_relation}
                                    error={fieldErrors.nominee_relation}
                                    onChange={(event) =>
                                        setField("nominee_relation", event.target.value)
                                    }
                                />
                                <SelectBox
                                    label="Nominee identity"
                                    value={form.nominee_identity_kind}
                                    options={IDENTITY_KIND_OPTIONS}
                                    onValueChange={(value) =>
                                        setField("nominee_identity_kind", value || "cnic")
                                    }
                                />
                                <Input
                                    label="Nominee identity number"
                                    required
                                    value={form.nominee_cnic}
                                    error={fieldErrors.nominee_cnic}
                                    onChange={(event) =>
                                        setField("nominee_cnic", event.target.value)
                                    }
                                />
                                <Input
                                    label="Nominee phone"
                                    className="sm:col-span-2"
                                    value={form.nominee_phone}
                                    error={fieldErrors.nominee_phone}
                                    onChange={(event) =>
                                        setField("nominee_phone", event.target.value)
                                    }
                                />
                            </div>
                        </div>
                    ) : null}

                    {step === "category" ? (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Choose the inventory category and payment plan. Premium and
                                discount are applied as percentages of the agreed price.
                            </p>
                            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                                <MetaComboBox
                                    label="Category"
                                    className="sm:col-span-2"
                                    metaType="UNIT_CATEGORY"
                                    required
                                    value={form.category}
                                    placeholder="Standard, Corner..."
                                    error={fieldErrors.category}
                                    onValueChange={(value) => setField("category", value || "")}
                                />
                                <NumberInput
                                    label="Premium"
                                    min={0}
                                    max={100}
                                    step={0.01}
                                    allowDecimal
                                    startElement="%"
                                    value={form.premium_percent}
                                    error={fieldErrors.premium_percent || fieldErrors.premium}
                                    onChange={(value) =>
                                        setField("premium_percent", value ?? 0)
                                    }
                                />
                                <NumberInput
                                    label="Discount"
                                    min={0}
                                    max={100}
                                    step={0.01}
                                    allowDecimal
                                    startElement="%"
                                    value={form.discount_percent}
                                    error={fieldErrors.discount_percent || fieldErrors.discount}
                                    onChange={(value) =>
                                        setField("discount_percent", value ?? 0)
                                    }
                                />
                            </div>
                            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-3">
                                <ReviewMetric label="Agreed" value={formatMoney(agreedPrice)} />
                                <ReviewMetric
                                    label="Premium − discount"
                                    value={formatMoney(premiumAmount - discountAmount)}
                                />
                                <ReviewMetric
                                    label="Net price"
                                    value={formatMoney(netPreview)}
                                    emphasize
                                />
                            </div>

                            <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs">
                                <h4 className="text-sm font-semibold text-foreground">
                                    Payment plan
                                </h4>
                                <SelectBox
                                    label="Template"
                                    value={String(form.template_id)}
                                    error={fieldErrors.template_id}
                                    options={templates.map((item) => ({
                                        value: String(item.id),
                                        label: item.label,
                                    }))}
                                    onValueChange={(value) =>
                                        setField("template_id", value || "custom")
                                    }
                                />
                                <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                                    <NumberInput
                                        label="Down payment"
                                        required
                                        min={0}
                                        step={0.01}
                                        allowDecimal
                                        value={form.down_payment}
                                        error={fieldErrors.down_payment}
                                        onChange={(value) => setField("down_payment", value)}
                                    />
                                    <NumberInput
                                        label="Handover"
                                        required
                                        min={0}
                                        max={100}
                                        step={0.01}
                                        allowDecimal
                                        startElement="%"
                                        value={form.handover_percent}
                                        error={fieldErrors.handover_percent}
                                        onChange={(value) =>
                                            setField("handover_percent", value)
                                        }
                                    />
                                    {isCustomPlan ? (
                                        <>
                                            <NumberInput
                                                label="Installments"
                                                min={1}
                                                max={120}
                                                step={1}
                                                value={form.installment_count}
                                                error={fieldErrors.installment_count}
                                                onChange={(value) =>
                                                    setField("installment_count", value)
                                                }
                                            />
                                            <SelectBox
                                                label="Frequency"
                                                value={form.frequency}
                                                error={fieldErrors.frequency}
                                                options={[
                                                    { value: "monthly", label: "Monthly" },
                                                    {
                                                        value: "quarterly",
                                                        label: "Quarterly",
                                                    },
                                                ]}
                                                onValueChange={(value) =>
                                                    setField(
                                                        "frequency",
                                                        value || "monthly",
                                                    )
                                                }
                                            />
                                        </>
                                    ) : null}
                                    <DatePicker
                                        label="First due date"
                                        required
                                        className="sm:col-span-2"
                                        value={form.first_due_on}
                                        error={fieldErrors.first_due_on}
                                        onChange={(value) =>
                                            setField("first_due_on", value)
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {step === "documents" ? (
                        <div className="space-y-4">
                            <BookingDocumentsSection
                                order={order}
                                deal={deal}
                                requiredDocuments={requiredDocs}
                                liaisonActive={deal?.liaison_active !== false}
                                onPreview={onPreview}
                                onDocumentsApplied={refreshDocuments}
                            />
                            {mandatoryDocs.length > 0 && !docsReady ? (
                                <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                                    Upload every mandatory document before completing Booking &amp;
                                    KYC
                                    {missingDocTitles.length > 0
                                        ? `: ${missingDocTitles.join(", ")}`
                                        : ""}
                                    .
                                </p>
                            ) : null}
                        </div>
                    ) : null}

                    {step === "review" ? (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Review legal details and documents, then complete Booking &amp; KYC
                                to activate the booking.
                            </p>
                            <ReviewSection icon="user-line" title="Buyer identity">
                                <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                                    <ReviewFact
                                        label="Legal name"
                                        value={form.customer_legal_name}
                                    />
                                    <ReviewFact
                                        label="Identity"
                                        value={`${identityKindLabel(form.identity_kind)} · ${form.identity_number}`}
                                    />
                                    <ReviewFact
                                        label="Overseas"
                                        value={form.overseas ? "Yes" : "No"}
                                    />
                                    <ReviewFact
                                        label="Main phone"
                                        value={form.international_phone}
                                    />
                                    <ReviewFact label="Alternate phone" value={form.local_phone} />
                                </div>
                            </ReviewSection>
                            <ReviewSection icon="group-line" title="Next of kin">
                                <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                                    <ReviewFact
                                        label="Nominee"
                                        value={`${form.nominee_name} (${form.nominee_relation})`}
                                    />
                                    <ReviewFact
                                        label="Identity"
                                        value={`${identityKindLabel(form.nominee_identity_kind)} · ${form.nominee_cnic}`}
                                    />
                                    <ReviewFact label="Phone" value={form.nominee_phone} />
                                </div>
                            </ReviewSection>
                            <ReviewSection icon="price-tag-3-line" title="Category & pricing">
                                <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                                    <ReviewFact
                                        label="Category"
                                        value={categoryLabel(form.category)}
                                    />
                                    <ReviewFact
                                        label="Unit"
                                        value={
                                            [order?.project?.title, order?.unit?.name]
                                                .filter(Boolean)
                                                .join(" · ") || "—"
                                        }
                                    />
                                    <ReviewFact
                                        label="Premium"
                                        value={`${Number(form.premium_percent || 0)}% (${formatMoney(premiumAmount)})`}
                                    />
                                    <ReviewFact
                                        label="Discount"
                                        value={`${Number(form.discount_percent || 0)}% (${formatMoney(discountAmount)})`}
                                    />
                                </div>
                                <div className="grid gap-x-5 gap-y-4 sm:grid-cols-3">
                                    <ReviewMetric
                                        label="Agreed"
                                        value={formatMoney(agreedPrice)}
                                    />
                                    <ReviewMetric
                                        label="Premium − discount"
                                        value={formatMoney(premiumAmount - discountAmount)}
                                    />
                                    <ReviewMetric
                                        label="Net"
                                        value={formatMoney(netPreview)}
                                        emphasize
                                    />
                                </div>
                            </ReviewSection>
                            <ReviewSection icon="calendar-schedule-line" title="Payment plan">
                                <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                                    <ReviewFact
                                        label="Template"
                                        value={planTemplateLabel(deal, form.template_id)}
                                    />
                                    <ReviewFact
                                        label="First due"
                                        value={form.first_due_on || "—"}
                                    />
                                    <ReviewFact
                                        label="Down payment"
                                        value={formatMoney(form.down_payment)}
                                    />
                                    <ReviewFact
                                        label="Handover"
                                        value={`${Number(form.handover_percent || 0)}%`}
                                    />
                                    {isCustomPlan ? (
                                        <>
                                            <ReviewFact
                                                label="Installments"
                                                value={String(form.installment_count || "—")}
                                            />
                                            <ReviewFact
                                                label="Frequency"
                                                value={
                                                    form.frequency === "quarterly"
                                                        ? "Quarterly"
                                                        : "Monthly"
                                                }
                                            />
                                        </>
                                    ) : null}
                                </div>
                            </ReviewSection>
                            <ReviewSection icon="file-list-3-line" title="Documents">
                                <ReviewFact
                                    label="Status"
                                    value={
                                        mandatoryDocs.length === 0
                                            ? "No mandatory types configured"
                                            : docsReady
                                              ? "All mandatory documents uploaded"
                                              : `Missing: ${missingDocTitles.join(", ") || "mandatory files"}`
                                    }
                                />
                            </ReviewSection>
                        </div>
                    ) : null}
                </div>

                <DialogFooter className="shrink-0 gap-2 border-t border-border bg-background px-3 py-4 sm:justify-between sm:px-4">
                    {step === "identity" ? (
                        <>
                            <span />
                            <Button
                                type="button"
                                onClick={() => goNext(validateIdentity, "nominee")}
                            >
                                Continue
                            </Button>
                        </>
                    ) : null}

                    {step === "nominee" ? (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => goBack("identity")}
                            >
                                Back
                            </Button>
                            <Button
                                type="button"
                                onClick={() => goNext(validateNominee, "category")}
                            >
                                Continue
                            </Button>
                        </>
                    ) : null}

                    {step === "category" ? (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => goBack("nominee")}
                            >
                                Back
                            </Button>
                            <Button
                                type="button"
                                onClick={() => goNext(validateCategory, "documents")}
                            >
                                Continue
                            </Button>
                        </>
                    ) : null}

                    {step === "documents" ? (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => goBack("category")}
                            >
                                Back
                            </Button>
                            <Button
                                type="button"
                                disabled={mandatoryDocs.length > 0 && !docsReady}
                                onClick={() => {
                                    if (mandatoryDocs.length > 0 && !docsReady) {
                                        toast.error(
                                            missingDocTitles.length > 0
                                                ? `Still missing: ${missingDocTitles.join(", ")}.`
                                                : "Upload all mandatory documents first.",
                                        );
                                        return;
                                    }
                                    setClientErrors({});
                                    onErrorsChange?.({});
                                    onStepChange?.("review");
                                }}
                            >
                                Continue
                            </Button>
                        </>
                    ) : null}

                    {step === "review" ? (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={submitting}
                                onClick={() => goBack("documents")}
                            >
                                Back
                            </Button>
                            <Button
                                type="button"
                                disabled={submitting || (mandatoryDocs.length > 0 && !docsReady)}
                                onClick={submitKyc}
                            >
                                {submitting ? "Saving…" : "Complete Booking & KYC"}
                            </Button>
                        </>
                    ) : null}
                </DialogFooter>
            </div>
        </div>
    );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { forms as metaForms } from "@/actions/App/Http/Controllers/Portal/MetaIntegrationController";
import { store } from "@/routes/portal/campaigns";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupNumberInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SelectBox } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";

function csrfHeaders() {
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
    const xsrf = document.cookie
        .split("; ")
        .find((row) => row.startsWith("XSRF-TOKEN="))
        ?.split("=")[1];

    const headers = {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
    };

    if (token) {
        headers["X-CSRF-TOKEN"] = token;
    }

    if (xsrf) {
        headers["X-XSRF-TOKEN"] = decodeURIComponent(xsrf);
    }

    return headers;
}

const PURPOSE_OPTIONS = [
    { value: "lead_generation", label: "Lead Generation" },
    { value: "brand_awareness", label: "Brand Awareness" },
    { value: "sales", label: "Sales" },
    { value: "event", label: "Event" },
];

const STATUS_OPTIONS = [
    { value: "draft", label: "Draft" },
    { value: "active", label: "Active" },
    { value: "archived", label: "Archived" },
];

const CHANNEL_OPTIONS = [
    { value: "website", label: "Website" },
    { value: "social", label: "Social" },
    { value: "search", label: "Search" },
    { value: "email", label: "Email" },
    { value: "referral", label: "Referral" },
    { value: "offline", label: "Offline" },
    { value: "partner", label: "Partner" },
    { value: "other", label: "Other" },
];

const FALLBACK_GOAL_FIELDS = [
    { key: "total_leads", label: "Total Leads" },
    { key: "qualified_leads", label: "Qualified Leads" },
    { key: "engagement", label: "Engagement" },
    { key: "closed_deals", label: "Closed Deals" },
];

const STEPS = [
    {
        id: "essentials",
        title: "Essentials",
        description: "Name the campaign. Everything else can wait.",
        fields: ["title", "project_id", "purpose", "status", "source_type", "source_config.page_id", "description"],
    },
    {
        id: "details",
        title: "Details",
        description: "Optional schedule, budget, and lead routing.",
        fields: [
            "channel",
            "owner_id",
            "starts_at",
            "ends_at",
            "tags",
            "budget",
            "target_cpl",
            "default_assignee_id",
            "default_lead_stage_id",
            "lead_source_label",
        ],
    },
    {
        id: "targets",
        title: "Goals & page",
        description: "Optional targets and landing copy. Form fields can be edited later.",
        fields: [
            "goals",
            "landing.headline",
            "landing.subheadline",
            "landing.cta_label",
            "landing.redirect_url",
            "landing.thank_you_message",
            "utm.source",
            "utm.medium",
            "utm.campaign",
            "utm.content",
            "utm.term",
        ],
    },
];

const EXTERNAL_STEPS = [
    STEPS[0],
    {
        ...STEPS[1],
        description: "Optional schedule, budget, and how leads are routed.",
        fields: STEPS[1].fields.filter((field) => field !== "channel"),
    },
    {
        id: "targets",
        title: "Goals",
        description: "Optional targets for this campaign.",
        fields: ["goals"],
    },
];

const emptyGoalsFromFields = (fields) =>
    Object.fromEntries(
        fields.map(({ key }) => [key, { enabled: false, target: 0 }])
    );

const emptyValuesForGoals = (goalFields) => ({
    source_type: "custom_form",
    source_config: {
        page_id: "",
        page_name: "",
        form_id: "",
        form_name: "",
        phone_number_id: "",
        phone_number: "",
        phone_name: "",
        waba_id: "",
    },
    title: "",
    status: "draft",
    description: "",
    purpose: "lead_generation",
    channel: "website",
    project_id: "",
    owner_id: "",
    starts_at: "",
    ends_at: "",
    budget: null,
    target_cpl: null,
    tags: "",
    default_assignee_id: "",
    default_lead_stage_id: "",
    lead_source_label: "Campaign landing",
    landing: {
        headline: "",
        subheadline: "",
        cta_label: "Register interest",
        thank_you_message: "Thanks — we will be in touch shortly.",
        redirect_url: "",
    },
    utm: {
        source: "",
        medium: "",
        campaign: "",
        content: "",
        term: "",
    },
    goals: emptyGoalsFromFields(goalFields),
});

function mapSelectOptions(items, fallbacks) {
    return (items || fallbacks).map((item) => {
        if (typeof item !== "string") {
            return item;
        }

        return (
            fallbacks.find((option) => option.value === item) || {
                value: item,
                label: item
                    .split("_")
                    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                    .join(" "),
            }
        );
    });
}

function WizardSteps({ steps, current }) {
    return (
        <ol className="flex items-center gap-2">
            {steps.map((step, index) => {
                const active = index === current;
                const done = index < current;

                return (
                    <li key={step.id} className="flex min-w-0 flex-1 items-center gap-2">
                        <div
                            className={cn(
                                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                                active && "bg-primary text-primary-foreground",
                                done && "bg-primary/15 text-primary",
                                !active && !done && "bg-muted text-muted-foreground"
                            )}
                        >
                            {done ? <Icon name="check-line" className="text-sm" /> : index + 1}
                        </div>
                        <div className="min-w-0 hidden sm:block">
                            <p
                                className={cn(
                                    "truncate text-xs font-medium",
                                    active ? "text-foreground" : "text-muted-foreground"
                                )}
                            >
                                {step.title}
                            </p>
                        </div>
                        {index < steps.length - 1 ? (
                            <div
                                className={cn(
                                    "mx-1 hidden h-px flex-1 sm:block",
                                    done ? "bg-primary/40" : "bg-border"
                                )}
                            />
                        ) : null}
                    </li>
                );
            })}
        </ol>
    );
}

function MoneyField({ label, value, onChange, error, currencySymbol }) {
    return (
        <div className="space-y-0.5">
            <Label className="mb-1 text-label font-medium text-muted-foreground">
                {label}
            </Label>
            <InputGroup className={cn(error && "border-destructive")}>
                <InputGroupAddon>{currencySymbol}</InputGroupAddon>
                <InputGroupNumberInput
                    value={value}
                    onChange={onChange}
                    allowDecimal
                    min={0}
                    placeholder="0"
                />
            </InputGroup>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
    );
}

function GoalRow({ label, color, enabled, target, onEnabledChange, onTargetChange }) {
    return (
        <div
            className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-3 shadow-xs transition-colors",
                enabled
                    ? "border-border bg-background"
                    : "border-border/60 bg-muted/20"
            )}
        >
            <Checkbox
                checked={enabled}
                onCheckedChange={(checked) => onEnabledChange(Boolean(checked))}
                className="shrink-0"
            >
                <span className="flex min-w-0 items-center gap-2.5">
                    <span
                        className="size-3 shrink-0 rounded-full ring-2 ring-background"
                        style={{ backgroundColor: color || "#64748B" }}
                        aria-hidden
                    />
                    <span
                        className={cn(
                            "truncate text-sm font-medium",
                            enabled ? "text-foreground" : "text-muted-foreground"
                        )}
                    >
                        {label}
                    </span>
                </span>
            </Checkbox>
            <div
                className={cn(
                    "ml-auto w-[6.25rem] shrink-0 space-y-0.5 transition-opacity",
                    !enabled && "pointer-events-none opacity-40"
                )}
            >
                <span className="block text-sm font-bold tracking-tight text-muted-foreground">
                    Target
                </span>
                <NumberInput
                    value={target}
                    onChange={(value) => onTargetChange(value ?? 0)}
                    min={0}
                    showSteppers={false}
                    disabled={!enabled}
                    placeholder="0"
                    aria-label={`${label} target`}
                />
            </div>
        </div>
    );
}

export default function CampaignForm({ isOpen, onClose, formOptions = {} }) {
    const { symbol: currencySymbol } = useCurrency();
    const [processing, setProcessing] = useState(false);
    const [serverErrors, setServerErrors] = useState({});
    const [stepIndex, setStepIndex] = useState(0);
    const stepIndexRef = useRef(0);
    const ignoreSubmitUntilRef = useRef(0);
    const [metaLeadForms, setMetaLeadForms] = useState([]);
    const [loadingMetaForms, setLoadingMetaForms] = useState(false);

    const goalFields = useMemo(() => {
        const types = formOptions.goal_types || [];

        if (types.length === 0) {
            return FALLBACK_GOAL_FIELDS;
        }

        return types.map((type) => ({
            key: type.label,
            label: type.title || type.label,
            color: type.color,
        }));
    }, [formOptions.goal_types]);

    const emptyValues = useMemo(
        () => emptyValuesForGoals(goalFields),
        [goalFields]
    );

    const projectOptions = useMemo(
        () =>
            (formOptions.projects || []).map((project) => ({
                value: String(project.id),
                label: project.title,
            })),
        [formOptions.projects]
    );

    const assigneeOptions = useMemo(
        () =>
            (formOptions.assignees || []).map((user) => ({
                value: String(user.id),
                label: user.display_name,
            })),
        [formOptions.assignees]
    );

    const stageOptions = useMemo(
        () =>
            (formOptions.stages || []).map((stage) => ({
                value: String(stage.id),
                label: stage.title || stage.label,
            })),
        [formOptions.stages]
    );

    const purposeOptions = useMemo(
        () => mapSelectOptions(formOptions.purposes, PURPOSE_OPTIONS),
        [formOptions.purposes]
    );

    const statusOptions = useMemo(
        () => mapSelectOptions(formOptions.statuses, STATUS_OPTIONS),
        [formOptions.statuses]
    );

    const channelOptions = useMemo(
        () => mapSelectOptions(formOptions.channels, CHANNEL_OPTIONS),
        [formOptions.channels]
    );

    const {
        handleSubmit,
        register,
        reset,
        control,
        trigger,
        getValues,
        setValue,
        formState: { errors },
    } = useForm({
        defaultValues: emptyValuesForGoals(FALLBACK_GOAL_FIELDS),
        mode: "onSubmit",
        reValidateMode: "onChange",
    });

    const sourceType = useWatch({ control, name: "source_type" });
    const metaConnected = Boolean(formOptions.meta?.connected);
    const whatsappConnected = Boolean(formOptions.whatsapp?.connected);
    const metaPages = formOptions.meta?.pages || [];
    const whatsappPhones = formOptions.whatsapp?.phones || [];
    const facebookSelected = sourceType === "facebook";
    const whatsappSelected = sourceType === "whatsapp";
    const externalIntake = facebookSelected || whatsappSelected;
    const wizardSteps = externalIntake ? EXTERNAL_STEPS : STEPS;
    const wizardLengthRef = useRef(wizardSteps.length);
    stepIndexRef.current = stepIndex;
    wizardLengthRef.current = wizardSteps.length;
    const metaPageOptions = useMemo(
        () =>
            metaPages.map((page) => ({
                value: String(page.id),
                label: page.instagram?.username
                    ? `${page.name} · @${page.instagram.username}`
                    : page.name,
            })),
        [metaPages]
    );
    const whatsappPhoneOptions = useMemo(
        () =>
            whatsappPhones.map((phone) => ({
                value: String(phone.id),
                label: phone.verified_name
                    ? `${phone.display_phone_number} · ${phone.verified_name}`
                    : phone.display_phone_number,
            })),
        [whatsappPhones]
    );
    const currentStep = wizardSteps[stepIndex] || wizardSteps[0];
    const isLastStep = stepIndex === wizardSteps.length - 1;

    const fieldError = (name) => {
        if (serverErrors[name]) {
            return Array.isArray(serverErrors[name])
                ? serverErrors[name][0]
                : serverErrors[name];
        }

        const parts = name.split(".");
        let current = errors;

        for (const part of parts) {
            current = current?.[part];
        }

        return current?.message;
    };

    const handleClose = () => {
        if (processing) {
            return;
        }

        reset(emptyValues);
        setServerErrors({});
        setStepIndex(0);
        setMetaLeadForms([]);
        setLoadingMetaForms(false);
        onClose(false);
    };

    const selectedMetaPageId = useWatch({ control, name: "source_config.page_id" });

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setServerErrors({});
        setStepIndex(0);
        setMetaLeadForms([]);
        setLoadingMetaForms(false);
        reset(emptyValues);
    }, [isOpen, reset, emptyValues]);

    useEffect(() => {
        if (!isOpen || !facebookSelected || !selectedMetaPageId) {
            setMetaLeadForms([]);
            setLoadingMetaForms(false);
            return;
        }

        const controller = new AbortController();
        let cancelled = false;

        const loadForms = async () => {
            setLoadingMetaForms(true);

            try {
                const response = await fetch(
                    metaForms.url({ query: { page_id: selectedMetaPageId } }),
                    {
                        method: "GET",
                        headers: csrfHeaders(),
                        credentials: "same-origin",
                        signal: controller.signal,
                    }
                );
                const body = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(
                        body?.message || "Unable to load Meta lead forms."
                    );
                }

                if (cancelled) {
                    return;
                }

                setMetaLeadForms(Array.isArray(body.forms) ? body.forms : []);
            } catch (error) {
                if (cancelled || error?.name === "AbortError") {
                    return;
                }

                setMetaLeadForms([]);
                toast.error(
                    error instanceof Error
                        ? error.message
                        : "Unable to load Meta lead forms."
                );
            } finally {
                if (!cancelled) {
                    setLoadingMetaForms(false);
                }
            }
        };

        loadForms();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [isOpen, facebookSelected, selectedMetaPageId]);

    const metaFormOptions = useMemo(
        () =>
            metaLeadForms.map((form) => ({
                value: String(form.id),
                label:
                    form.status && form.status !== "ACTIVE"
                        ? `${form.name} (${form.status})`
                        : form.name,
            })),
        [metaLeadForms]
    );

    const submitCampaign = (formData) => {
        if (formData.source_type === "facebook" && !metaConnected) {
            toast.error("Connect Meta in Settings → Integrations first.");
            return;
        }

        if (formData.source_type === "facebook" && !formData.source_config?.page_id) {
            toast.error("Select a Meta Page for this campaign.");
            return;
        }

        if (formData.source_type === "whatsapp" && !whatsappConnected) {
            toast.error("Connect WhatsApp in Settings → Integrations first.");
            return;
        }

        if (formData.source_type === "whatsapp" && !formData.source_config?.phone_number_id) {
            toast.error("Select a WhatsApp number for this campaign.");
            return;
        }

        setProcessing(true);
        setServerErrors({});

        const campaignTitle = formData.title.trim();
        const tags = String(formData.tags || "")
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);

        const selectedPage = metaPages.find(
            (page) => String(page.id) === String(formData.source_config?.page_id || "")
        );
        const selectedPhone = whatsappPhones.find(
            (phone) =>
                String(phone.id) === String(formData.source_config?.phone_number_id || "")
        );

        let sourceConfig = null;

        if (formData.source_type === "facebook") {
            sourceConfig = {
                page_id: formData.source_config?.page_id || null,
                page_name:
                    formData.source_config?.page_name || selectedPage?.name || null,
                form_id: formData.source_config?.form_id || null,
                form_name: formData.source_config?.form_name || null,
            };
        } else if (formData.source_type === "whatsapp") {
            sourceConfig = {
                phone_number_id: formData.source_config?.phone_number_id || null,
                phone_number:
                    formData.source_config?.phone_number ||
                    selectedPhone?.display_phone_number ||
                    null,
                phone_name:
                    formData.source_config?.phone_name ||
                    selectedPhone?.verified_name ||
                    null,
                waba_id:
                    formData.source_config?.waba_id || selectedPhone?.waba_id || null,
            };
        }

        const payload = {
            title: campaignTitle,
            description: formData.description?.trim() || null,
            purpose: formData.purpose || "lead_generation",
            source_type: formData.source_type || "custom_form",
            source_config: sourceConfig,
            channel:
                formData.channel ||
                (formData.source_type === "facebook" || formData.source_type === "whatsapp"
                    ? "social"
                    : null),
            status: formData.status || "draft",
            project_id: formData.project_id ? Number(formData.project_id) : null,
            owner_id: formData.owner_id ? Number(formData.owner_id) : null,
            default_assignee_id: formData.default_assignee_id
                ? Number(formData.default_assignee_id)
                : null,
            default_lead_stage_id: formData.default_lead_stage_id
                ? Number(formData.default_lead_stage_id)
                : null,
            lead_source_label:
                formData.lead_source_label?.trim() ||
                (formData.source_type === "facebook"
                    ? "Meta Lead Ads"
                    : formData.source_type === "whatsapp"
                      ? "WhatsApp"
                      : "Campaign landing"),
            starts_at: formData.starts_at || null,
            ends_at: formData.ends_at || null,
            budget:
                formData.budget === "" || formData.budget == null
                    ? null
                    : Number(formData.budget),
            target_cpl:
                formData.target_cpl === "" || formData.target_cpl == null
                    ? null
                    : Number(formData.target_cpl),
            tags,
            create_form: (formData.source_type || "custom_form") === "custom_form",
            utm: {
                source:
                    formData.utm?.source?.trim() ||
                    (formData.source_type === "facebook"
                        ? "facebook"
                        : formData.source_type === "whatsapp"
                          ? "whatsapp"
                          : null),
                medium:
                    formData.utm?.medium?.trim() ||
                    (formData.source_type === "facebook" ||
                    formData.source_type === "whatsapp"
                        ? "paid"
                        : null),
                campaign: formData.utm?.campaign?.trim() || null,
                content: formData.utm?.content?.trim() || null,
                term: formData.utm?.term?.trim() || null,
            },
            goals: Object.fromEntries(
                goalFields.map(({ key }) => {
                    const goal = formData.goals?.[key] || {
                        enabled: false,
                        target: 0,
                    };

                    return [
                        key,
                        {
                            enabled: Boolean(goal.enabled),
                            target: Number(goal.target) || 0,
                        },
                    ];
                })
            ),
            landing:
                formData.source_type === "facebook" || formData.source_type === "whatsapp"
                    ? null
                    : {
                          headline: formData.landing?.headline?.trim() || campaignTitle,
                          subheadline: formData.landing?.subheadline?.trim() || null,
                          body: formData.description?.trim() || null,
                          cta_label: formData.landing?.cta_label?.trim() || "Register interest",
                          thank_you_message:
                              formData.landing?.thank_you_message?.trim() ||
                              "Thanks — we will be in touch shortly.",
                          redirect_url: formData.landing?.redirect_url?.trim() || null,
                          highlights: [],
                      },
        };

        router.post(store.url(), payload, {
            onSuccess: () => {
                toast.success(
                    formData.source_type === "facebook"
                        ? "Meta campaign created — lead ads will route here"
                        : formData.source_type === "whatsapp"
                          ? "WhatsApp campaign created — messages will route here"
                          : "Campaign created — customize the form anytime"
                );
                handleClose();
            },
            onError: (submitErrors) => {
                setServerErrors(submitErrors);
                toast.error(
                    submitErrors.title ||
                        submitErrors["source_config.page_id"] ||
                        submitErrors.source_type ||
                        submitErrors.project_id ||
                        submitErrors.message ||
                        "Could not create campaign"
                );
            },
            onFinish: () => setProcessing(false),
        });
    };

    const validateEssentials = async () => {
        const valid = await trigger(["title"]);

        if (!valid) {
            toast.error("Campaign title is required.");
            return false;
        }

        if (getValues("source_type") === "facebook") {
            if (!metaConnected) {
                toast.error("Connect Meta in Settings → Integrations first.");
                return false;
            }

            if (!getValues("source_config.page_id")) {
                toast.error("Select a Meta Page for this campaign.");
                return false;
            }
        }

        if (getValues("source_type") === "whatsapp") {
            if (!whatsappConnected) {
                toast.error("Connect WhatsApp in Settings → Integrations first.");
                return false;
            }

            if (!getValues("source_config.phone_number_id")) {
                toast.error("Select a WhatsApp number for this campaign.");
                return false;
            }
        }

        return true;
    };

    const goNext = async (event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();

        if (stepIndexRef.current === 0) {
            const ok = await validateEssentials();
            if (!ok) {
                return;
            }
        }

        if (stepIndexRef.current >= wizardLengthRef.current - 1) {
            return;
        }

        // A double-click would land on the create button that replaces Continue.
        ignoreSubmitUntilRef.current = Date.now() + 600;
        setStepIndex((current) => Math.min(current + 1, wizardLengthRef.current - 1));
    };

    const submitFromLastStep = (event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();

        if (Date.now() < ignoreSubmitUntilRef.current) {
            return;
        }

        if (stepIndexRef.current < wizardLengthRef.current - 1) {
            return;
        }

        handleSubmit(submitCampaign)();
    };

    const goBack = () => {
        setStepIndex((current) => Math.max(current - 1, 0));
    };

    const createNow = async () => {
        const ok = await validateEssentials();
        if (!ok) {
            return;
        }

        submitCampaign(getValues());
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) {
                    handleClose();
                }
            }}
        >
            <DialogContent className="grid max-h-[min(92vh,40rem)] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl">
                <DialogHeader className="border-b border-border px-6 py-4">
                    <DialogTitle>Add Campaign</DialogTitle>
                    <DialogDescription>
                        {currentStep.description}
                    </DialogDescription>
                </DialogHeader>

                <div className="border-b border-border px-6 py-3">
                    <WizardSteps steps={wizardSteps} current={stepIndex} />
                </div>

                <form
                    id="campaign-create-form"
                    className="min-h-0 overflow-y-auto px-6 py-5"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const intent = event.nativeEvent?.submitter?.getAttribute("data-intent");

                        if (intent === "create") {
                            submitFromLastStep(event);
                            return;
                        }

                        if (stepIndexRef.current < wizardLengthRef.current - 1) {
                            goNext(event);
                        }
                    }}
                >
                    {stepIndex === 0 ? (
                        <div className="space-y-4">
                            <Controller
                                name="source_type"
                                control={control}
                                render={({ field }) => (
                                    <div className="space-y-2">
                                        <Label className="text-label font-medium text-muted-foreground">
                                            Intake type
                                        </Label>
                                        <RadioGroup
                                            value={field.value}
                                            onValueChange={(value) => {
                                                field.onChange(value);
                                                if (value === "facebook") {
                                                    setValue("channel", "social");
                                                    setValue("utm.source", "facebook");
                                                    setValue("utm.medium", "paid");
                                                    setValue(
                                                        "lead_source_label",
                                                        "Meta Lead Ads"
                                                    );
                                                } else if (value === "whatsapp") {
                                                    setValue("channel", "social");
                                                    setValue("utm.source", "whatsapp");
                                                    setValue("utm.medium", "paid");
                                                    setValue("lead_source_label", "WhatsApp");
                                                } else {
                                                    setValue("channel", "website");
                                                    setValue(
                                                        "lead_source_label",
                                                        "Campaign landing"
                                                    );
                                                }
                                                setStepIndex((current) =>
                                                    Math.min(current, EXTERNAL_STEPS.length - 1)
                                                );
                                            }}
                                            className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
                                        >
                                            <label
                                                className={cn(
                                                    "relative flex h-full cursor-pointer flex-col gap-3 rounded-xl border p-3.5 transition-all",
                                                    field.value === "custom_form"
                                                        ? "border-teal-500/50 bg-teal-500/8 ring-1 ring-teal-500/25"
                                                        : "border-border/80 bg-background hover:border-teal-500/35 hover:bg-teal-500/[0.04]"
                                                )}
                                            >
                                                <RadioGroupItem
                                                    value="custom_form"
                                                    className="sr-only"
                                                />
                                                <span
                                                    className={cn(
                                                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                                                        field.value === "custom_form"
                                                            ? "bg-teal-500 text-white"
                                                            : "bg-teal-500/12 text-teal-700 dark:text-teal-300"
                                                    )}
                                                >
                                                    <Icon
                                                        name="file-list-3-line"
                                                        className="text-lg"
                                                    />
                                                </span>
                                                <span className="min-w-0 space-y-1">
                                                    <span className="block text-sm font-semibold leading-snug text-foreground">
                                                        Custom form
                                                    </span>
                                                    <span className="block text-xs leading-relaxed text-muted-foreground">
                                                        Landing page, embed snippet, and form
                                                        fields
                                                    </span>
                                                </span>
                                            </label>
                                            <label
                                                className={cn(
                                                    "relative flex h-full flex-col gap-3 rounded-xl border p-3.5 transition-all",
                                                    !metaConnected
                                                        ? "cursor-not-allowed opacity-55"
                                                        : "cursor-pointer",
                                                    field.value === "facebook"
                                                        ? "border-[#1877F2]/55 bg-[#1877F2]/8 ring-1 ring-[#1877F2]/25"
                                                        : metaConnected
                                                          ? "border-border/80 bg-background hover:border-[#1877F2]/40 hover:bg-[#1877F2]/[0.04]"
                                                          : "border-border/60 bg-muted/20"
                                                )}
                                                title={
                                                    metaConnected
                                                        ? "Route Meta Lead Ads into this campaign"
                                                        : "Connect Meta in Settings → Integrations"
                                                }
                                            >
                                                <RadioGroupItem
                                                    value="facebook"
                                                    disabled={!metaConnected}
                                                    className="sr-only"
                                                />
                                                <span
                                                    className={cn(
                                                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                                                        field.value === "facebook"
                                                            ? "bg-[#1877F2] text-white"
                                                            : "bg-[#1877F2]/12 text-[#1877F2]"
                                                    )}
                                                >
                                                    <Icon name="meta-fill" className="text-lg" />
                                                </span>
                                                <span className="min-w-0 space-y-1">
                                                    <span className="block text-sm font-semibold leading-snug text-foreground">
                                                        Meta Lead Ads
                                                    </span>
                                                    <span className="block text-xs leading-relaxed text-muted-foreground">
                                                        {metaConnected
                                                            ? "Facebook & Instagram lead forms"
                                                            : "Connect Meta in Settings to enable"}
                                                    </span>
                                                </span>
                                            </label>
                                            <label
                                                className={cn(
                                                    "relative flex h-full flex-col gap-3 rounded-xl border p-3.5 transition-all",
                                                    !whatsappConnected
                                                        ? "cursor-not-allowed opacity-55"
                                                        : "cursor-pointer",
                                                    field.value === "whatsapp"
                                                        ? "border-[#25D366]/55 bg-[#25D366]/8 ring-1 ring-[#25D366]/25"
                                                        : whatsappConnected
                                                          ? "border-border/80 bg-background hover:border-[#25D366]/40 hover:bg-[#25D366]/[0.04]"
                                                          : "border-border/60 bg-muted/20"
                                                )}
                                                title={
                                                    whatsappConnected
                                                        ? "Route WhatsApp messages into this campaign"
                                                        : "Connect WhatsApp in Settings → Integrations"
                                                }
                                            >
                                                <RadioGroupItem
                                                    value="whatsapp"
                                                    disabled={!whatsappConnected}
                                                    className="sr-only"
                                                />
                                                <span
                                                    className={cn(
                                                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                                                        field.value === "whatsapp"
                                                            ? "bg-[#25D366] text-white"
                                                            : "bg-[#25D366]/12 text-[#25D366]"
                                                    )}
                                                >
                                                    <Icon
                                                        name="whatsapp-fill"
                                                        className="text-lg"
                                                    />
                                                </span>
                                                <span className="min-w-0 space-y-1">
                                                    <span className="block text-sm font-semibold leading-snug text-foreground">
                                                        WhatsApp
                                                    </span>
                                                    <span className="block text-xs leading-relaxed text-muted-foreground">
                                                        {whatsappConnected
                                                            ? "Inbound messages as campaign leads"
                                                            : "Connect WhatsApp in Settings to enable"}
                                                    </span>
                                                </span>
                                            </label>
                                        </RadioGroup>
                                    </div>
                                )}
                            />

                            {facebookSelected ? (
                                <div className="space-y-4">
                                    <Controller
                                        name="source_config.page_id"
                                        control={control}
                                        rules={{
                                            required: facebookSelected
                                                ? "Select a Meta Page."
                                                : false,
                                        }}
                                        render={({ field }) => (
                                            <SelectBox
                                                label="Meta Page"
                                                required
                                                value={field.value}
                                                onValueChange={(value) => {
                                                    field.onChange(value);
                                                    const page = metaPages.find(
                                                        (item) => String(item.id) === String(value)
                                                    );
                                                    setValue(
                                                        "source_config.page_name",
                                                        page?.name || ""
                                                    );
                                                    setValue("source_config.form_id", "");
                                                    setValue("source_config.form_name", "");
                                                    setMetaLeadForms([]);
                                                }}
                                                options={metaPageOptions}
                                                placeholder="Select page"
                                                error={fieldError("source_config.page_id")}
                                            />
                                        )}
                                    />
                                    <Controller
                                        name="source_config.form_id"
                                        control={control}
                                        render={({ field }) => (
                                            <SelectBox
                                                label="Lead form"
                                                value={field.value}
                                                onValueChange={(value) => {
                                                    field.onChange(value);
                                                    const form = metaLeadForms.find(
                                                        (item) =>
                                                            String(item.id) === String(value)
                                                    );
                                                    setValue(
                                                        "source_config.form_name",
                                                        form?.name || ""
                                                    );
                                                }}
                                                options={metaFormOptions}
                                                placeholder={
                                                    loadingMetaForms
                                                        ? "Loading forms…"
                                                        : selectedMetaPageId
                                                          ? "All forms on this Page"
                                                          : "Select a Page first"
                                                }
                                                clearable
                                                disabled={
                                                    !selectedMetaPageId || loadingMetaForms
                                                }
                                                error={fieldError("source_config.form_id")}
                                            />
                                        )}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {loadingMetaForms
                                            ? "Fetching lead forms from Facebook…"
                                            : metaLeadForms.length === 0 && selectedMetaPageId
                                              ? "No lead forms found on this Page. Leave blank to accept all forms."
                                              : "Optional — leave blank to accept all Lead Ads forms on this Page."}
                                    </p>
                                </div>
                            ) : null}

                            {whatsappSelected ? (
                                <div className="space-y-4">
                                    <Controller
                                        name="source_config.phone_number_id"
                                        control={control}
                                        rules={{
                                            required: whatsappSelected
                                                ? "Select a WhatsApp number."
                                                : false,
                                        }}
                                        render={({ field }) => (
                                            <SelectBox
                                                label="WhatsApp number"
                                                required
                                                value={field.value}
                                                onValueChange={(value) => {
                                                    field.onChange(value);
                                                    const phone = whatsappPhones.find(
                                                        (item) => String(item.id) === String(value)
                                                    );
                                                    setValue(
                                                        "source_config.phone_number",
                                                        phone?.display_phone_number || ""
                                                    );
                                                    setValue(
                                                        "source_config.phone_name",
                                                        phone?.verified_name || ""
                                                    );
                                                    setValue(
                                                        "source_config.waba_id",
                                                        phone?.waba_id || ""
                                                    );
                                                }}
                                                options={whatsappPhoneOptions}
                                                placeholder="Select number"
                                                error={fieldError("source_config.phone_number_id")}
                                            />
                                        )}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Inbound messages to this number create leads on this
                                        campaign. Messaging charges are billed by Meta to your
                                        WhatsApp Business account.
                                    </p>
                                </div>
                            ) : null}

                            <Input
                                label="Campaign Title"
                                required
                                placeholder="Spring launch"
                                error={fieldError("title")}
                                {...register("title", {
                                    required: "Campaign title is required.",
                                })}
                            />

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Controller
                                    name="project_id"
                                    control={control}
                                    render={({ field }) => (
                                        <SelectBox
                                            label="Project"
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            options={projectOptions}
                                            placeholder="Optional"
                                            clearable
                                            error={fieldError("project_id")}
                                        />
                                    )}
                                />
                                <Controller
                                    name="status"
                                    control={control}
                                    render={({ field }) => (
                                        <SelectBox
                                            label="Status"
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            options={statusOptions}
                                            placeholder="Select"
                                            error={fieldError("status")}
                                        />
                                    )}
                                />
                                <Controller
                                    name="purpose"
                                    control={control}
                                    render={({ field }) => (
                                        <SelectBox
                                            label="Purpose"
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            options={purposeOptions}
                                            placeholder="Select"
                                            error={fieldError("purpose")}
                                        />
                                    )}
                                />
                            </div>

                            <div className="space-y-0.5">
                                <Label className="mb-1 flex text-label font-medium text-muted-foreground">
                                    Description
                                </Label>
                                <Textarea
                                    rows={3}
                                    placeholder="Optional short brief"
                                    {...register("description")}
                                />
                            </div>

                            {externalIntake ? (
                                <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                                    {whatsappSelected
                                        ? "Leads sync from WhatsApp messages — no Propflow form, landing page, or embed snippet is needed."
                                        : "Leads sync from Meta Lead Ads — no Propflow form, landing page, or embed snippet is needed."}
                                </p>
                            ) : (
                                <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                                    A lead form is created automatically. You can customize fields
                                    after creating the campaign.
                                </p>
                            )}
                        </div>
                    ) : null}

                    {stepIndex === 1 ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {!externalIntake ? (
                                    <Controller
                                        name="channel"
                                        control={control}
                                        render={({ field }) => (
                                            <SelectBox
                                                label="Channel"
                                                value={field.value}
                                                onValueChange={field.onChange}
                                                options={channelOptions}
                                                placeholder="Select"
                                                error={fieldError("channel")}
                                            />
                                        )}
                                    />
                                ) : null}
                                <Controller
                                    name="owner_id"
                                    control={control}
                                    render={({ field }) => (
                                        <SelectBox
                                            label="Owner"
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            options={assigneeOptions}
                                            placeholder="Select"
                                            clearable
                                            error={fieldError("owner_id")}
                                        />
                                    )}
                                />
                                <Controller
                                    name="starts_at"
                                    control={control}
                                    render={({ field }) => (
                                        <DatePicker
                                            label="Start Date"
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder="Select date..."
                                            error={fieldError("starts_at")}
                                        />
                                    )}
                                />
                                <Controller
                                    name="ends_at"
                                    control={control}
                                    render={({ field }) => (
                                        <DatePicker
                                            label="End Date"
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder="Select date..."
                                            error={fieldError("ends_at")}
                                        />
                                    )}
                                />
                            </div>

                            <Input
                                label="Tags"
                                placeholder="launch, q2, whatsapp"
                                error={fieldError("tags")}
                                {...register("tags")}
                            />

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Controller
                                    name="budget"
                                    control={control}
                                    render={({ field }) => (
                                        <MoneyField
                                            label="Total budget"
                                            value={field.value}
                                            onChange={field.onChange}
                                            error={fieldError("budget")}
                                            currencySymbol={currencySymbol}
                                        />
                                    )}
                                />
                                <Controller
                                    name="target_cpl"
                                    control={control}
                                    render={({ field }) => (
                                        <MoneyField
                                            label="Target CPL"
                                            value={field.value}
                                            onChange={field.onChange}
                                            error={fieldError("target_cpl")}
                                            currencySymbol={currencySymbol}
                                        />
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Controller
                                    name="default_assignee_id"
                                    control={control}
                                    render={({ field }) => (
                                        <SelectBox
                                            label="Default assignee"
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            options={assigneeOptions}
                                            placeholder="Select"
                                            clearable
                                            error={fieldError("default_assignee_id")}
                                        />
                                    )}
                                />
                                <Controller
                                    name="default_lead_stage_id"
                                    control={control}
                                    render={({ field }) => (
                                        <SelectBox
                                            label="Default stage"
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            options={stageOptions}
                                            placeholder="Select"
                                            clearable
                                            error={fieldError("default_lead_stage_id")}
                                        />
                                    )}
                                />
                            </div>

                            <Input
                                label="Lead source label"
                                placeholder={
                                    facebookSelected
                                        ? "Meta Lead Ads"
                                        : whatsappSelected
                                          ? "WhatsApp"
                                          : "Campaign landing"
                                }
                                error={fieldError("lead_source_label")}
                                {...register("lead_source_label")}
                            />
                        </div>
                    ) : null}

                    {stepIndex === 2 ? (
                        <div className="space-y-5">
                            <div className="space-y-3">
                                <div>
                                    <h3 className="text-base font-bold tracking-tight">
                                        Set Goals
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Enable a metric and set its target.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    {goalFields.map(({ key, label, color }) => (
                                        <Controller
                                            key={key}
                                            name={`goals.${key}`}
                                            control={control}
                                            render={({ field }) => (
                                                <GoalRow
                                                    label={label}
                                                    color={color}
                                                    enabled={Boolean(field.value?.enabled)}
                                                    target={field.value?.target ?? 0}
                                                    onEnabledChange={(enabled) =>
                                                        field.onChange({
                                                            ...field.value,
                                                            enabled,
                                                            target: field.value?.target ?? 0,
                                                        })
                                                    }
                                                    onTargetChange={(target) =>
                                                        field.onChange({
                                                            ...field.value,
                                                            enabled: Boolean(field.value?.enabled),
                                                            target,
                                                        })
                                                    }
                                                />
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>

                            {!externalIntake ? (
                                <>
                                    <div className="space-y-3 border-t border-border pt-5">
                                        <div>
                                            <h3 className="text-base font-bold tracking-tight">
                                                Landing page
                                            </h3>
                                            <p className="text-xs text-muted-foreground">
                                                Optional — you can refine this later.
                                            </p>
                                        </div>
                                        <Input
                                            label="Headline"
                                            placeholder="Find your next home"
                                            {...register("landing.headline")}
                                        />
                                        <Input
                                            label="Subheadline"
                                            placeholder="Register interest in a few seconds"
                                            {...register("landing.subheadline")}
                                        />
                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            <Input
                                                label="CTA label"
                                                placeholder="Register interest"
                                                {...register("landing.cta_label")}
                                            />
                                            <Input
                                                label="Redirect URL"
                                                placeholder="https://example.com/thanks"
                                                error={fieldError("landing.redirect_url")}
                                                {...register("landing.redirect_url")}
                                            />
                                        </div>
                                        <div className="space-y-0.5">
                                            <Label className="mb-1 flex text-label font-medium text-muted-foreground">
                                                Thank-you message
                                            </Label>
                                            <Textarea
                                                rows={2}
                                                placeholder="Thanks — we will be in touch shortly."
                                                {...register("landing.thank_you_message")}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-3 border-t border-border pt-5">
                                        <div>
                                            <h3 className="text-base font-bold tracking-tight">
                                                Attribution
                                            </h3>
                                            <p className="text-xs text-muted-foreground">
                                                Optional UTM defaults.
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            <Input
                                                label="utm_source"
                                                placeholder="facebook"
                                                {...register("utm.source")}
                                            />
                                            <Input
                                                label="utm_medium"
                                                placeholder="cpc"
                                                {...register("utm.medium")}
                                            />
                                            <Input
                                                label="utm_campaign"
                                                placeholder="spring-launch"
                                                {...register("utm.campaign")}
                                            />
                                            <Input
                                                label="utm_content"
                                                placeholder="hero-cta"
                                                {...register("utm.content")}
                                            />
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                                    Landing pages, UTM defaults, and embed snippets are skipped —
                                    {whatsappSelected
                                        ? " WhatsApp messages deliver leads directly into this campaign."
                                        : " Meta Lead Ads deliver leads directly into this campaign."}
                                </p>
                            )}
                        </div>
                    ) : null}
                </form>

                <DialogFooter className="border-t border-border bg-popover px-6 py-4 sm:justify-between">
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={stepIndex === 0 ? handleClose : goBack}
                            disabled={processing}
                        >
                            {stepIndex === 0 ? "Cancel" : "Back"}
                        </Button>

                        <div className="flex flex-wrap items-center gap-2">
                            {!isLastStep ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    loading={processing}
                                    onClick={createNow}
                                >
                                    Create campaign
                                </Button>
                            ) : null}
                            {isLastStep ? (
                                <Button
                                    key="create-campaign"
                                    type="button"
                                    data-intent="create"
                                    loading={processing}
                                    onClick={submitFromLastStep}
                                >
                                    Create campaign
                                </Button>
                            ) : (
                                <Button
                                    key="continue-step"
                                    type="button"
                                    onClick={goNext}
                                    disabled={processing}
                                >
                                    Continue
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

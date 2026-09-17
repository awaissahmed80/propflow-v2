import { useEffect, useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
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
        fields: ["title", "project_id", "purpose", "status", "source_type", "description"],
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

const emptyGoalsFromFields = (fields) =>
    Object.fromEntries(
        fields.map(({ key }) => [key, { enabled: false, target: 0 }])
    );

const emptyValuesForGoals = (goalFields) => ({
    source_type: "custom_form",
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

function GoalRow({ label, enabled, target, onEnabledChange, onTargetChange }) {
    return (
        <div className="flex items-center gap-3 rounded-md border border-border bg-muted/20 px-3 py-2.5">
            <Checkbox
                checked={enabled}
                onCheckedChange={(checked) => onEnabledChange(Boolean(checked))}
            >
                <span className="text-sm text-foreground">{label}</span>
            </Checkbox>
            <div className="ml-auto w-24">
                <NumberInput
                    value={target}
                    onChange={(value) => onTargetChange(value ?? 0)}
                    min={0}
                    showSteppers={false}
                    disabled={!enabled}
                    placeholder="0"
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
        formState: { errors },
    } = useForm({
        defaultValues: emptyValuesForGoals(FALLBACK_GOAL_FIELDS),
        mode: "onSubmit",
        reValidateMode: "onChange",
    });

    const sourceType = useWatch({ control, name: "source_type" });
    const facebookSelected = sourceType === "facebook";
    const currentStep = STEPS[stepIndex];
    const isLastStep = stepIndex === STEPS.length - 1;

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
        onClose(false);
    };

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setServerErrors({});
        setStepIndex(0);
        reset(emptyValues);
    }, [isOpen, reset, emptyValues]);

    const submitCampaign = (formData) => {
        if (formData.source_type === "facebook") {
            toast.error("Facebook campaigns are coming soon.");
            return;
        }

        setProcessing(true);
        setServerErrors({});

        const campaignTitle = formData.title.trim();
        const tags = String(formData.tags || "")
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);

        const payload = {
            title: campaignTitle,
            description: formData.description?.trim() || null,
            purpose: formData.purpose || "lead_generation",
            source_type: formData.source_type || "custom_form",
            channel: formData.channel || null,
            status: formData.status || "draft",
            project_id: formData.project_id ? Number(formData.project_id) : null,
            owner_id: formData.owner_id ? Number(formData.owner_id) : null,
            default_assignee_id: formData.default_assignee_id
                ? Number(formData.default_assignee_id)
                : null,
            default_lead_stage_id: formData.default_lead_stage_id
                ? Number(formData.default_lead_stage_id)
                : null,
            lead_source_label: formData.lead_source_label?.trim() || "Campaign landing",
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
                source: formData.utm?.source?.trim() || null,
                medium: formData.utm?.medium?.trim() || null,
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
            landing: {
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
                toast.success("Campaign created — customize the form anytime");
                handleClose();
            },
            onError: (submitErrors) => {
                setServerErrors(submitErrors);
                toast.error(
                    submitErrors.title ||
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
            toast.error("Facebook campaigns are coming soon.");
            return false;
        }

        return true;
    };

    const goNext = async () => {
        if (stepIndex === 0) {
            const ok = await validateEssentials();
            if (!ok) {
                return;
            }
        }

        setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
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
                    <WizardSteps steps={STEPS} current={stepIndex} />
                </div>

                <form
                    id="campaign-create-form"
                    className="min-h-0 overflow-y-auto px-6 py-5"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (isLastStep) {
                            handleSubmit(submitCampaign)();
                            return;
                        }
                        goNext();
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
                                            Intake
                                        </Label>
                                        <RadioGroup
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            className="flex flex-wrap gap-6"
                                        >
                                            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                                                <RadioGroupItem value="custom_form" />
                                                Custom Form
                                            </label>
                                            <label
                                                className="flex cursor-pointer items-center gap-2 text-sm text-foreground opacity-60"
                                                title="Coming soon"
                                            >
                                                <RadioGroupItem value="facebook" disabled />
                                                Facebook
                                            </label>
                                        </RadioGroup>
                                    </div>
                                )}
                            />

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

                            <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                                A lead form is created automatically. You can customize fields
                                after creating the campaign.
                            </p>
                        </div>
                    ) : null}

                    {stepIndex === 1 ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                                placeholder="Campaign landing"
                                error={fieldError("lead_source_label")}
                                {...register("lead_source_label")}
                            />
                        </div>
                    ) : null}

                    {stepIndex === 2 ? (
                        <div className="space-y-5">
                            <div className="space-y-3">
                                <div>
                                    <h3 className="text-sm font-semibold tracking-tight">
                                        Set Goals
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Enable a metric and set its target.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    {goalFields.map(({ key, label }) => (
                                        <Controller
                                            key={key}
                                            name={`goals.${key}`}
                                            control={control}
                                            render={({ field }) => (
                                                <GoalRow
                                                    label={label}
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

                            <div className="space-y-3 border-t border-border pt-5">
                                <div>
                                    <h3 className="text-sm font-semibold tracking-tight">
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
                                    <h3 className="text-sm font-semibold tracking-tight">
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
                                    disabled={facebookSelected}
                                    onClick={createNow}
                                >
                                    Create campaign
                                </Button>
                            ) : null}
                            {isLastStep ? (
                                <Button
                                    type="submit"
                                    form="campaign-create-form"
                                    loading={processing}
                                    disabled={facebookSelected}
                                >
                                    Create campaign
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    onClick={goNext}
                                    disabled={processing || facebookSelected}
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

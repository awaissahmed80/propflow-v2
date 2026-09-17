import { useEffect, useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { store, update } from "@/actions/App/Http/Controllers/Portal/LeadController";
import { Button } from "@/components/ui/button";
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
import { ComboBox } from "@/components/ui/combo-box";
import { HeatIconButton } from "@/components/ui/heat-icon";
import { SelectBox } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
    TooltipProvider,
} from "@/components/ui/tooltip";
import { HEAT_OPTIONS } from "@/lib/heat";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

const emptyValues = {
    contact_name: "",
    contact_phone_number: "",
    contact_email_address: "",
    project_id: "",
    assigned_to: "",
    lead_stage_id: "",
    source: "",
    tag: "MODERATE",
    budget: null,
    notes: "",
};

function splitName(fullName) {
    const parts = String(fullName || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 0) {
        return { first_name: null, last_name: null };
    }

    if (parts.length === 1) {
        return { first_name: parts[0], last_name: null };
    }

    return {
        first_name: parts[0],
        last_name: parts.slice(1).join(" "),
    };
}

function joinName(contact) {
    return [contact?.first_name, contact?.last_name].filter(Boolean).join(" ");
}

export default function LeadForm({
    isOpen,
    onClose,
    data = null,
    projects = [],
    stages = [],
    assignees = [],
    sources = [],
}) {
    const isEditing = Boolean(data?.id);
    const { symbol: currencySymbol } = useCurrency();
    const [processing, setProcessing] = useState(false);
    const [serverErrors, setServerErrors] = useState({});

    const {
        handleSubmit,
        register,
        reset,
        control,
        formState: { errors },
    } = useForm({
        defaultValues: emptyValues,
        mode: "onSubmit",
        reValidateMode: "onChange",
    });

    const assigneeOptions = useMemo(
        () =>
            assignees.map((user) => ({
                value: String(user.id),
                label: user.display_name,
                description: user.title || undefined,
                avatar: {
                    name: user.display_name,
                    src: user.avatar || undefined,
                },
            })),
        [assignees]
    );

    const sourceOptions = useMemo(() => {
        const known = [
            "Website",
            "Referral",
            "Walk-in",
            "Facebook",
            "Google",
            "Call",
            "WhatsApp",
            ...sources,
        ];

        return Array.from(new Set(known.filter(Boolean)));
    }, [sources]);

    const fieldError = (name) => {
        if (serverErrors[name]) {
            return Array.isArray(serverErrors[name])
                ? serverErrors[name][0]
                : serverErrors[name];
        }

        if (name.startsWith("contact.")) {
            const nested = serverErrors.contact?.[name.split(".")[1]];
            if (nested) {
                return Array.isArray(nested) ? nested[0] : nested;
            }
        }

        return errors[name]?.message;
    };

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setServerErrors({});

        if (data) {
            reset({
                contact_name: joinName(data.contact),
                contact_phone_number: data.contact?.phone_number || "",
                contact_email_address: data.contact?.email_address || "",
                project_id: data.project_id ? String(data.project_id) : "",
                assigned_to: data.assigned_to ? String(data.assigned_to) : "",
                lead_stage_id: data.lead_stage_id ? String(data.lead_stage_id) : "",
                source: data.source || "",
                tag: data.tag || "MODERATE",
                budget: data.budget ?? null,
                notes: data.notes || "",
            });
        } else {
            const defaultStage =
                stages.find((stage) => stage.label === "new") || stages[0];

            reset({
                ...emptyValues,
                lead_stage_id: defaultStage ? String(defaultStage.id) : "",
            });
        }
    }, [isOpen, data, reset, stages]);

    const handleClose = () => {
        if (processing) {
            return;
        }

        onClose();
    };

    const onSubmit = (values) => {
        const phone = String(values.contact_phone_number || "").trim();
        const email = String(values.contact_email_address || "").trim();

        if (!phone && !email) {
            setServerErrors({
                "contact.phone_number": "Phone or email is required.",
                "contact.email_address": "Phone or email is required.",
            });
            toast.error("Please fix the highlighted fields");
            return;
        }

        setProcessing(true);
        setServerErrors({});

        const { first_name, last_name } = splitName(values.contact_name);

        const payload = {
            contact_id: data?.contact_id || null,
            contact: {
                first_name,
                last_name,
                phone_number: phone || null,
                email_address: email || null,
            },
            project_id: values.project_id ? Number(values.project_id) : null,
            unit_id: null,
            assigned_to: values.assigned_to ? Number(values.assigned_to) : null,
            lead_stage_id: values.lead_stage_id
                ? Number(values.lead_stage_id)
                : null,
            source: values.source || null,
            tag: values.tag || "MODERATE",
            budget:
                values.budget === "" || values.budget == null
                    ? null
                    : Number(values.budget),
            notes: values.notes || null,
        };

        const visit = {
            preserveScroll: true,
            onSuccess: (page) => {
                const reused = page?.props?.flash?.contact_reused;
                toast.success(
                    isEditing
                        ? "Lead updated"
                        : reused
                          ? "Lead created and linked to existing contact"
                          : "Lead created"
                );
                handleClose();
            },
            onError: (errs) => {
                setServerErrors(errs || {});
                toast.error("Please fix the highlighted fields");
            },
            onFinish: () => setProcessing(false),
        };

        if (isEditing) {
            router.put(update.url(data.id), payload, visit);
        } else {
            router.post(store.url(), payload, visit);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
                <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
                    <DialogTitle className="flex items-center gap-2">
                        <Icon name="user-star-line" className="text-xl" />
                        {isEditing ? "Edit lead" : "New lead"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? `Update details for ${data?.code || "this lead"}.`
                            : "Add a lead contact. Matching phone or email reuses an existing contact."}
                    </DialogDescription>
                </DialogHeader>

                <form
                    className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
                    onSubmit={handleSubmit(onSubmit)}
                >
                    <div className="space-y-4">
                        {isEditing && data?.code ? (
                            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                                <span className="text-muted-foreground">Code </span>
                                <span className="font-medium text-foreground">
                                    {data.code}
                                </span>
                            </div>
                        ) : null}

                        <Input
                            label="Name"
                            required
                            placeholder="Sonia Koll"
                            error={
                                fieldError("contact_name") ||
                                fieldError("contact.first_name")
                            }
                            {...register("contact_name", {
                                required: "Name is required.",
                            })}
                        />

                        <div className="space-y-1.5">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Input
                                    label="Phone"
                                    required
                                    placeholder="+92 300 1234567"
                                    error={
                                        fieldError("contact_phone_number") ||
                                        fieldError("contact.phone_number")
                                    }
                                    {...register("contact_phone_number")}
                                />
                                <Input
                                    label="Email"
                                    required
                                    type="email"
                                    placeholder="sonia@example.com"
                                    error={
                                        fieldError("contact_email_address") ||
                                        fieldError("contact.email_address")
                                    }
                                    {...register("contact_email_address")}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                At least one of phone or email is required to match existing
                                contacts.
                            </p>
                        </div>

                        <Controller
                            name="project_id"
                            control={control}
                            render={({ field }) => (
                                <div className="space-y-1.5">
                                    <Label className="mb-1 text-label font-medium text-muted-foreground">
                                        Project
                                    </Label>
                                    {projects.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            No projects available.
                                        </p>
                                    ) : (
                                        <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-1.5">
                                            {projects.map((project) => {
                                                const value = String(project.id);
                                                const selected = field.value === value;

                                                return (
                                                    <button
                                                        key={project.id}
                                                        type="button"
                                                        onClick={() =>
                                                            field.onChange(
                                                                selected ? "" : value
                                                            )
                                                        }
                                                        className={cn(
                                                            "flex w-full items-center gap-2.5 rounded-md border px-2 py-1.5 text-left transition-colors",
                                                            selected
                                                                ? "border-primary/40 bg-primary/10"
                                                                : "border-transparent hover:bg-muted/50"
                                                        )}
                                                    >
                                                        {project.thumbnail ? (
                                                            <img
                                                                src={project.thumbnail}
                                                                alt=""
                                                                className="size-9 shrink-0 rounded-md object-cover"
                                                            />
                                                        ) : (
                                                            <span
                                                                className={cn(
                                                                    "flex size-9 shrink-0 items-center justify-center rounded-md",
                                                                    selected
                                                                        ? "bg-primary/15 text-primary"
                                                                        : "bg-muted text-muted-foreground"
                                                                )}
                                                            >
                                                                <Icon
                                                                    name="community-line"
                                                                    className="text-lg"
                                                                />
                                                            </span>
                                                        )}
                                                        <span className="min-w-0 flex-1">
                                                            <span
                                                                className={cn(
                                                                    "block truncate text-sm",
                                                                    selected
                                                                        ? "font-medium text-primary"
                                                                        : "text-foreground"
                                                                )}
                                                            >
                                                                {project.title}
                                                            </span>
                                                            {project.code ? (
                                                                <span className="block truncate text-xs text-muted-foreground">
                                                                    {project.code}
                                                                </span>
                                                            ) : null}
                                                        </span>
                                                        {selected ? (
                                                            <Icon
                                                                name="check-line"
                                                                className="shrink-0 text-base text-primary"
                                                            />
                                                        ) : null}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {fieldError("project_id") ? (
                                        <p className="text-sm text-destructive">
                                            {fieldError("project_id")}
                                        </p>
                                    ) : null}
                                </div>
                            )}
                        />

                        <Controller
                            name="lead_stage_id"
                            control={control}
                            rules={{ required: "Stage is required." }}
                            render={({ field }) => (
                                <div className="space-y-1.5">
                                    <Label className="mb-1 text-label font-medium text-muted-foreground">
                                        Stage
                                        <span className="ml-0.5 text-destructive">*</span>
                                    </Label>
                                    <div className="flex flex-wrap gap-2">
                                        {stages.map((stage) => {
                                            const value = String(stage.id);
                                            const selected = field.value === value;
                                            const color =
                                                stage.color || "var(--muted-foreground)";

                                            return (
                                                <button
                                                    key={stage.id}
                                                    type="button"
                                                    onClick={() => field.onChange(value)}
                                                    className={cn(
                                                        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors",
                                                        selected
                                                            ? "ring-1 ring-current"
                                                            : "opacity-80 hover:opacity-100"
                                                    )}
                                                    style={{
                                                        backgroundColor: selected
                                                            ? `${color}22`
                                                            : `${color}14`,
                                                        borderColor: selected
                                                            ? `${color}66`
                                                            : `${color}33`,
                                                        color,
                                                    }}
                                                >
                                                    <span
                                                        className="size-1.5 shrink-0 rounded-sm"
                                                        style={{ backgroundColor: color }}
                                                        aria-hidden
                                                    />
                                                    {stage.title}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {fieldError("lead_stage_id") ? (
                                        <p className="text-sm text-destructive">
                                            {fieldError("lead_stage_id")}
                                        </p>
                                    ) : null}
                                </div>
                            )}
                        />

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Controller
                                name="budget"
                                control={control}
                                render={({ field }) => (
                                    <div className="space-y-0.5">
                                        <Label className="mb-1 text-label font-medium text-muted-foreground">
                                            Deal value
                                        </Label>
                                        <InputGroup
                                            className={cn(
                                                fieldError("budget") &&
                                                    "border-destructive"
                                            )}
                                        >
                                            <InputGroupAddon>{currencySymbol}</InputGroupAddon>
                                            <InputGroupNumberInput
                                                value={field.value}
                                                onChange={field.onChange}
                                                allowDecimal
                                                min={0}
                                                placeholder="0"
                                            />
                                        </InputGroup>
                                        {fieldError("budget") ? (
                                            <p className="text-sm text-destructive">
                                                {fieldError("budget")}
                                            </p>
                                        ) : null}
                                    </div>
                                )}
                            />
                            <Controller
                                name="source"
                                control={control}
                                render={({ field }) => (
                                    <ComboBox
                                        label="Source"
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        options={sourceOptions}
                                        placeholder="Google, Referral..."
                                        clearable
                                        error={fieldError("source")}
                                    />
                                )}
                            />
                        </div>

                        <Controller
                            name="assigned_to"
                            control={control}
                            render={({ field }) => (
                                <SelectBox
                                    label="Assign to"
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    options={assigneeOptions}
                                    placeholder="Select assignee..."
                                    clearable
                                    error={fieldError("assigned_to")}
                                />
                            )}
                        />

                        <Controller
                            name="tag"
                            control={control}
                            render={({ field }) => (
                                <div className="space-y-1.5">
                                    <Label className="mb-1 text-label font-medium text-muted-foreground">
                                        Heat
                                    </Label>
                                    <TooltipProvider delay={200}>
                                        <div className="flex flex-wrap gap-2">
                                            {HEAT_OPTIONS.map((option) => (
                                                <HeatIconButton
                                                    key={option.value}
                                                    tag={option.value}
                                                    selected={
                                                        field.value === option.value
                                                    }
                                                    onClick={() =>
                                                        field.onChange(option.value)
                                                    }
                                                />
                                            ))}
                                        </div>
                                    </TooltipProvider>
                                    {fieldError("tag") ? (
                                        <p className="text-sm text-destructive">
                                            {fieldError("tag")}
                                        </p>
                                    ) : null}
                                </div>
                            )}
                        />

                        <Textarea
                            label="Notes"
                            rows={3}
                            placeholder="Needs a lot of attention and patience"
                            error={fieldError("notes")}
                            {...register("notes")}
                        />
                    </div>
                </form>

                <DialogFooter className="shrink-0 border-t border-border bg-popover px-6 py-4 sm:justify-end">
                    <Button type="button" variant="outline" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        loading={processing}
                        onClick={handleSubmit(onSubmit)}
                    >
                        {isEditing ? "Save changes" : "Create lead"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

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
import { DatePicker } from "@/components/ui/date-picker";
import { SelectBox } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const TAG_OPTIONS = [
    { value: "VERY HOT", label: "Very Hot" },
    { value: "HOT", label: "Hot" },
    { value: "MODERATE", label: "Moderate" },
    { value: "COLD", label: "Cold" },
    { value: "VERY COLD", label: "Very Cold" },
];

const emptyValues = {
    contact_first_name: "",
    contact_last_name: "",
    contact_phone_number: "",
    contact_email_address: "",
    project_id: "",
    unit_id: "",
    assigned_to: "",
    lead_stage_id: "",
    source: "",
    tag: "MODERATE",
    budget: null,
    next_action: "",
    due_date: "",
    notes: "",
};

export default function LeadForm({
    isOpen,
    onClose,
    data = null,
    projects = [],
    units = [],
    stages = [],
    assignees = [],
    sources = [],
}) {
    const isEditing = Boolean(data?.id);
    const [processing, setProcessing] = useState(false);
    const [serverErrors, setServerErrors] = useState({});

    const {
        handleSubmit,
        register,
        reset,
        control,
        watch,
        setValue,
        formState: { errors },
    } = useForm({
        defaultValues: emptyValues,
        mode: "onSubmit",
        reValidateMode: "onChange",
    });

    const projectId = watch("project_id");

    const projectOptions = useMemo(
        () =>
            projects.map((project) => ({
                value: String(project.id),
                label: project.title,
            })),
        [projects]
    );

    const unitOptions = useMemo(
        () =>
            units
                .filter(
                    (unit) =>
                        !projectId || String(unit.project_id) === String(projectId)
                )
                .map((unit) => ({
                    value: String(unit.id),
                    label: unit.name ? `${unit.name} (${unit.code})` : unit.code,
                })),
        [units, projectId]
    );

    const stageOptions = useMemo(
        () =>
            stages.map((stage) => ({
                value: String(stage.id),
                label: stage.title,
            })),
        [stages]
    );

    const assigneeOptions = useMemo(
        () =>
            assignees.map((user) => ({
                value: String(user.id),
                label: user.display_name,
            })),
        [assignees]
    );

    const sourceOptions = useMemo(() => {
        const known = [
            "Website",
            "Referral",
            "Walk-in",
            "Facebook",
            "Call",
            "WhatsApp",
            ...sources,
        ];

        return Array.from(new Set(known.filter(Boolean)));
    }, [sources]);

    const fieldError = (name) => {
        if (serverErrors[name]) {
            return serverErrors[name];
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
                contact_first_name: data.contact?.first_name || "",
                contact_last_name: data.contact?.last_name || "",
                contact_phone_number: data.contact?.phone_number || "",
                contact_email_address: data.contact?.email_address || "",
                project_id: data.project_id ? String(data.project_id) : "",
                unit_id: data.unit_id ? String(data.unit_id) : "",
                assigned_to: data.assigned_to ? String(data.assigned_to) : "",
                lead_stage_id: data.lead_stage_id ? String(data.lead_stage_id) : "",
                source: data.source || "",
                tag: data.tag || "MODERATE",
                budget: data.budget ?? null,
                next_action: data.next_action || "",
                due_date: data.due_date ? data.due_date.slice(0, 10) : "",
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

    useEffect(() => {
        if (!projectId) {
            return;
        }

        const currentUnitId = watch("unit_id");
        if (!currentUnitId) {
            return;
        }

        const stillValid = units.some(
            (unit) =>
                String(unit.id) === String(currentUnitId) &&
                String(unit.project_id) === String(projectId)
        );

        if (!stillValid) {
            setValue("unit_id", "");
        }
    }, [projectId, units, setValue, watch]);

    const handleClose = () => {
        if (processing) {
            return;
        }

        onClose();
    };

    const onSubmit = (values) => {
        setProcessing(true);
        setServerErrors({});

        const payload = {
            contact_id: data?.contact_id || null,
            contact: {
                first_name: values.contact_first_name || null,
                last_name: values.contact_last_name || null,
                phone_number: values.contact_phone_number || null,
                email_address: values.contact_email_address || null,
            },
            project_id: values.project_id ? Number(values.project_id) : null,
            unit_id: values.unit_id ? Number(values.unit_id) : null,
            assigned_to: values.assigned_to ? Number(values.assigned_to) : null,
            lead_stage_id: values.lead_stage_id ? Number(values.lead_stage_id) : null,
            source: values.source || null,
            tag: values.tag || "MODERATE",
            budget:
                values.budget === "" || values.budget == null
                    ? null
                    : Number(values.budget),
            next_action: values.next_action || null,
            due_date: values.due_date || null,
            notes: values.notes || null,
        };

        const visit = {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(isEditing ? "Lead updated" : "Lead created");
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
                        <Icon name="customer-service-line" className="text-xl" />
                        {isEditing ? "Edit lead" : "Add lead"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? `Update details for ${data?.code || "this lead"}.`
                            : "Capture a new inquiry. Lead code is assigned automatically."}
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
                                <span className="font-medium text-foreground">{data.code}</span>
                            </div>
                        ) : null}

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Input
                                label="First name"
                                required
                                placeholder="Ali"
                                error={
                                    fieldError("contact_first_name") ||
                                    fieldError("contact.first_name")
                                }
                                {...register("contact_first_name", {
                                    required: "First name is required.",
                                })}
                            />
                            <Input
                                label="Last name"
                                placeholder="Khan"
                                error={
                                    fieldError("contact_last_name") ||
                                    fieldError("contact.last_name")
                                }
                                {...register("contact_last_name")}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Input
                                label="Phone"
                                required
                                placeholder="03xx xxxxxxx"
                                error={
                                    fieldError("contact_phone_number") ||
                                    fieldError("contact.phone_number")
                                }
                                {...register("contact_phone_number", {
                                    required: "Phone is required.",
                                })}
                            />
                            <Input
                                label="Email"
                                type="email"
                                placeholder="ali@example.com"
                                error={
                                    fieldError("contact_email_address") ||
                                    fieldError("contact.email_address")
                                }
                                {...register("contact_email_address")}
                            />
                        </div>

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
                                        placeholder="Optional project..."
                                        clearable
                                        error={fieldError("project_id")}
                                    />
                                )}
                            />
                            <Controller
                                name="unit_id"
                                control={control}
                                render={({ field }) => (
                                    <SelectBox
                                        label="Unit"
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        options={unitOptions}
                                        placeholder="Optional unit..."
                                        disabled={!projectId}
                                        clearable
                                        error={fieldError("unit_id")}
                                    />
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Controller
                                name="lead_stage_id"
                                control={control}
                                rules={{ required: "Stage is required." }}
                                render={({ field }) => (
                                    <SelectBox
                                        label="Stage"
                                        required
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        options={stageOptions}
                                        placeholder="Select stage..."
                                        error={fieldError("lead_stage_id")}
                                    />
                                )}
                            />
                            <Controller
                                name="tag"
                                control={control}
                                render={({ field }) => (
                                    <SelectBox
                                        label="Heat"
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        options={TAG_OPTIONS}
                                        placeholder="Select heat..."
                                        error={fieldError("tag")}
                                    />
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Controller
                                name="assigned_to"
                                control={control}
                                render={({ field }) => (
                                    <SelectBox
                                        label="Assignee"
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        options={assigneeOptions}
                                        placeholder="Assign to..."
                                        clearable
                                        error={fieldError("assigned_to")}
                                    />
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
                                        placeholder="Website, Referral..."
                                        clearable
                                        error={fieldError("source")}
                                    />
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Controller
                                name="budget"
                                control={control}
                                render={({ field }) => (
                                    <div className="space-y-0.5">
                                        <Label className="mb-0.5 text-base font-medium text-muted-foreground">
                                            Budget
                                        </Label>
                                        <InputGroup
                                            className={cn(
                                                fieldError("budget") && "border-destructive"
                                            )}
                                        >
                                            <InputGroupAddon>PKR</InputGroupAddon>
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
                                name="due_date"
                                control={control}
                                render={({ field }) => (
                                    <DatePicker
                                        label="Due date"
                                        value={field.value}
                                        onChange={field.onChange}
                                        placeholder="Select Date..."
                                        error={fieldError("due_date")}
                                    />
                                )}
                            />
                        </div>

                        <Input
                            label="Next action"
                            placeholder="Call back, site visit..."
                            error={fieldError("next_action")}
                            {...register("next_action")}
                        />

                        <Textarea
                            label="Notes"
                            rows={3}
                            placeholder="Interest, preferences, follow-up notes..."
                            error={fieldError("notes")}
                            {...register("notes")}
                        />
                    </div>

                    <DialogFooter className="sticky bottom-0 -mx-6 mt-6 border-t border-border bg-background px-6 py-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={processing}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing
                                ? "Saving..."
                                : isEditing
                                  ? "Save changes"
                                  : "Create lead"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

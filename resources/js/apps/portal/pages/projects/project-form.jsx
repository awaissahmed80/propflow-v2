import { useEffect, useState } from "react";
import { router } from "@inertiajs/react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { store, update } from "@/actions/App/Http/Controllers/Portal/ProjectController";
import { Button } from "@/components/ui/button";
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
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { MetaComboBox } from "@/components/ui/meta-combo-box";
import { SelectBox } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useMeta } from "@/hooks/use-meta";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
    { value: "draft", label: "Draft" },
    { value: "active", label: "Active" },
    { value: "on_hold", label: "On hold" },
    { value: "completed", label: "Completed" },
    { value: "archived", label: "Archived" },
];

const formDefaults = {
    title: "",
    description: "",
    type: "",
    country: "",
    city: "",
    location: "",
    status: "draft",
    area_unit: "",
    total_area: null,
    start_date: "",
    end_date: "",
    balloting_enabled: false,
};

function buildPayload(formData) {
    return {
        title: formData.title.trim(),
        description: formData.description?.trim() || null,
        type: formData.type || null,
        country: formData.country?.trim() || null,
        city: formData.city || null,
        location: formData.location?.trim() || null,
        status: formData.status || "draft",
        area_unit: formData.area_unit || null,
        total_area:
            formData.total_area === null || formData.total_area === ""
                ? null
                : Number(formData.total_area),
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        balloting_enabled: Boolean(formData.balloting_enabled),
    };
}

export default function ProjectForm({
    isOpen,
    onClose,
    data = null,
}) {
    const meta = useMeta();
    const isEditing = Boolean(data?.code || data?.id);
    const [processing, setProcessing] = useState(false);
    const [serverErrors, setServerErrors] = useState({});
    const {
        handleSubmit,
        register,
        reset,
        control,
        formState: { errors },
    } = useForm({
        defaultValues: formDefaults,
        mode: "onSubmit",
        reValidateMode: "onChange",
    });

    const fieldError = (name) => serverErrors[name] || errors[name]?.message;

    const handleClose = () => {
        reset(formDefaults);
        setServerErrors({});
        onClose(false);
    };

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setServerErrors({});

        const defaultAreaUnit = meta.AREA?.[0] ?? "";

        if (data) {
            reset({
                title: data.title ?? "",
                description: data.description ?? "",
                type: data.type ?? "",
                country: data.country ?? "",
                city: data.city ?? "",
                location: data.location ?? "",
                status: data.status || "draft",
                area_unit: data.area_unit || defaultAreaUnit,
                total_area:
                    data.total_area === null || data.total_area === undefined
                        ? null
                        : Number(data.total_area),
                start_date: data.start_date ?? "",
                end_date: data.end_date ?? "",
                balloting_enabled: Boolean(data.balloting_enabled),
            });
            return;
        }

        reset({
            ...formDefaults,
            area_unit: defaultAreaUnit,
        });
    }, [isOpen, data, reset, meta.AREA]);

    const onInvalid = (validationErrors) => {
        const firstError = Object.values(validationErrors).find(
            (error) => error?.message
        )?.message;

        if (firstError) {
            toast.error(firstError);
        }
    };

    const onSubmit = (formData) => {
        setProcessing(true);
        setServerErrors({});

        const payload = buildPayload(formData);

        if (isEditing) {
            router.patch(update.url(data.code), payload, {
                preserveScroll: true,
                preserveState: "errors",
                onSuccess: () => {
                    toast.success("Project updated successfully");
                    handleClose();
                },
                onError: (submitErrors) => {
                    setServerErrors(submitErrors);
                    toast.error(
                        submitErrors.title ||
                            submitErrors.message ||
                            "Unable to update project"
                    );
                },
                onFinish: () => setProcessing(false),
            });
            return;
        }

        router.post(store.url(), payload, {
            preserveScroll: true,
            preserveState: "errors",
            onSuccess: () => {
                toast.success("Project created successfully");
                handleClose();
            },
            onError: (submitErrors) => {
                setServerErrors(submitErrors);
                toast.error(
                    submitErrors.title ||
                        submitErrors.message ||
                        "Unable to create project"
                );
            },
            onFinish: () => setProcessing(false),
        });
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
            <DialogContent
                showCloseButton
                className={cn(
                    "grid max-h-[min(92vh,48rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-md p-0 sm:max-w-2xl"
                )}
            >
                <DialogHeader className="gap-3 border-b border-border px-6 py-5 text-left">
                    <div className="flex items-start gap-3 pr-8">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                            <Icon name="community-line" className="text-xl" />
                        </div>
                        <div className="min-w-0 space-y-1">
                            <DialogTitle className="text-lg font-semibold tracking-tight">
                                {isEditing ? "Edit project details" : "Create a new project"}
                            </DialogTitle>
                            <DialogDescription>
                                {isEditing
                                    ? "Update the project’s basic information and location."
                                    : "Set up the project’s basic information and location."}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form
                    id="project-form"
                    className="min-h-0 overflow-y-auto px-6 py-5"
                    onSubmit={handleSubmit(onSubmit, onInvalid)}
                    noValidate
                >
                    <div className="flex flex-col gap-5">
                        <Input
                            label="Project name"
                            required
                            placeholder="e.g. Marina Residences"
                            error={fieldError("title")}
                            {...register("title", {
                                required: "Project name is required.",
                                validate: (value) =>
                                    value.trim().length > 0 || "Project name is required.",
                            })}
                        />

                        <Controller
                            name="description"
                            control={control}
                            rules={{
                                validate: (value) => {
                                    if (!value) {
                                        return true;
                                    }

                                    return (
                                        String(value).length <= 10000 ||
                                        "Description must be 10000 characters or less."
                                    );
                                },
                            }}
                            render={({ field }) => (
                                <MarkdownEditor
                                    id="project-description"
                                    label="Description"
                                    value={field.value}
                                    onChange={field.onChange}
                                    onBlur={field.onBlur}
                                    placeholder="Describe the project — use headings, lists, and images as needed"
                                    error={fieldError("description")}
                                />
                            )}
                        />

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Controller
                                name="status"
                                control={control}
                                rules={{ required: "Status is required." }}
                                render={({ field }) => (
                                    <SelectBox
                                        label="Status"
                                        required
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        options={STATUS_OPTIONS}
                                        placeholder="Select status..."
                                        error={fieldError("status")}
                                    />
                                )}
                            />
                            <Controller
                                name="type"
                                control={control}
                                render={({ field }) => (
                                    <MetaComboBox
                                        label="Type"
                                        metaType="PROJECT"
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        placeholder="Type or select..."
                                        error={fieldError("type")}
                                    />
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Input
                                label="Location"
                                placeholder="Area, street, or landmark"
                                error={fieldError("location")}
                                {...register("location")}
                            />

                            <div className="space-y-0.5">
                                <Label className="mb-1 flex flex-row items-center text-label font-medium text-muted-foreground">
                                    Total Area
                                </Label>
                                <InputGroup>
                                    <Controller
                                        name="total_area"
                                        control={control}
                                        render={({ field }) => (
                                            <InputGroupNumberInput
                                                id="project-total-area"
                                                value={field.value}
                                                onChange={field.onChange}
                                                allowDecimal
                                                min={0}
                                                placeholder="0"
                                                error={fieldError("total_area")}
                                            />
                                        )}
                                    />
                                    <InputGroupAddon align="inline-end">
                                        <Controller
                                            name="area_unit"
                                            control={control}
                                            render={({ field }) => (
                                                <SelectBox
                                                    variant="group"
                                                    value={field.value}
                                                    onValueChange={field.onChange}
                                                    options={meta.AREA ?? []}
                                                    placeholder="Unit"
                                                    error={fieldError("area_unit")}
                                                />
                                            )}
                                        />
                                    </InputGroupAddon>
                                </InputGroup>
                                {fieldError("total_area") || fieldError("area_unit") ? (
                                    <div className="text-[13px] text-destructive">
                                        {fieldError("total_area") || fieldError("area_unit")}
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Controller
                                name="country"
                                control={control}
                                render={({ field }) => (
                                    <MetaComboBox
                                        label="Country"
                                        metaType="COUNTRY"
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        placeholder="Type or select..."
                                        error={fieldError("country")}
                                    />
                                )}
                            />
                            <Controller
                                name="city"
                                control={control}
                                render={({ field }) => (
                                    <MetaComboBox
                                        label="City"
                                        metaType="CITY"
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        placeholder="Type or select..."
                                        error={fieldError("city")}
                                    />
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Controller
                                name="start_date"
                                control={control}
                                render={({ field }) => (
                                    <DatePicker
                                        label="Start date"
                                        value={field.value}
                                        onChange={field.onChange}
                                        placeholder="Select Date..."
                                        error={fieldError("start_date")}
                                    />
                                )}
                            />
                            <Controller
                                name="end_date"
                                control={control}
                                render={({ field }) => (
                                    <DatePicker
                                        label="End date"
                                        value={field.value}
                                        onChange={field.onChange}
                                        placeholder="Select Date..."
                                        error={fieldError("end_date")}
                                    />
                                )}
                            />
                        </div>

                        <Controller
                            name="balloting_enabled"
                            control={control}
                            render={({ field }) => (
                                <div className="flex items-start justify-between gap-4 rounded-md border border-border px-4 py-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-foreground">
                                            Balloting enabled
                                        </p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            Optional society plot allotment step for bookings on this
                                            project.
                                        </p>
                                    </div>
                                    <Switch
                                        className="mt-0.5 shrink-0"
                                        checked={Boolean(field.value)}
                                        onCheckedChange={field.onChange}
                                    />
                                </div>
                            )}
                        />
                    </div>
                </form>

                <DialogFooter className="shrink-0 border-t border-border bg-popover px-6 py-4 sm:justify-end">
                    <div className="flex w-full items-center justify-end gap-2">
                        <Button type="button" variant="outline" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button type="submit" form="project-form" loading={processing}>
                            {isEditing ? "Save changes" : "Create project"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

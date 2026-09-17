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
import { MetaComboBox } from "@/components/ui/meta-combo-box";
import { SelectBox } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMeta } from "@/hooks/use-meta";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
    { value: "draft", label: "Draft" },
    { value: "active", label: "Active" },
    { value: "on_hold", label: "On hold" },
    { value: "completed", label: "Completed" },
    { value: "archived", label: "Archived" },
];

const createDefaults = {
    title: "",
    type: "",
    status: "draft",
};

const editDefaults = {
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
};

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
        defaultValues: isEditing ? editDefaults : createDefaults,
        mode: "onSubmit",
        reValidateMode: "onChange",
    });

    const fieldError = (name) => serverErrors[name] || errors[name]?.message;

    const handleClose = () => {
        reset(isEditing ? editDefaults : createDefaults);
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
            });
            return;
        }

        reset(createDefaults);
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

        if (isEditing) {
            router.patch(
                update.url(data.code),
                {
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
                },
                {
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
                }
            );
            return;
        }

        router.post(
            store.url(),
            {
                title: formData.title.trim(),
                type: formData.type || null,
                status: formData.status || "draft",
            },
            {
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
            }
        );
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
                    "grid gap-0 overflow-hidden rounded-md p-0",
                    isEditing ? "sm:max-w-2xl" : "sm:max-w-lg",
                    "max-h-[min(92vh,48rem)] grid-rows-[auto_minmax(0,1fr)_auto]"
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
                                    : "Start with the basics. You can refine details on the project page."}
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

                        {isEditing ? (
                            <div className="space-y-0.5">
                                <Label className="mb-1 flex flex-row items-center text-label font-medium text-muted-foreground">
                                    Description
                                </Label>
                                <Textarea
                                    placeholder="Short overview of the project"
                                    className="min-h-20 rounded-md dark:bg-input/30"
                                    {...register("description", {
                                        maxLength: {
                                            value: 5000,
                                            message:
                                                "Description must be 5000 characters or less.",
                                        },
                                    })}
                                />
                                {fieldError("description") ? (
                                    <div className="text-[13px] text-destructive">
                                        {fieldError("description")}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}

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

                        {isEditing ? (
                            <>
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
                            </>
                        ) : null}
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

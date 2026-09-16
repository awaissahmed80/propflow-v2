import { useEffect, useState } from "react";
import { router } from "@inertiajs/react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
    destroy,
    store,
    update,
} from "@/actions/App/Http/Controllers/Portal/ProjectProgressController";
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
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { SelectBox } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const STATUS_OPTIONS = [
    { value: "planned", label: "Planned" },
    { value: "in_progress", label: "In progress" },
    { value: "completed", label: "Completed" },
    { value: "delayed", label: "Delayed" },
];

const emptyValues = {
    title: "",
    description: "",
    status: "planned",
    progress: 0,
    start_date: "",
    end_date: "",
};

export default function ProgressForm({
    isOpen,
    onClose,
    projectCode,
    data = null,
}) {
    const isEditing = Boolean(data?.id);
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

    const fieldError = (name) => serverErrors[name] || errors[name]?.message;

    const handleClose = () => {
        reset(emptyValues);
        setServerErrors({});
        onClose(false);
    };

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setServerErrors({});

        if (data) {
            reset({
                title: data.title ?? "",
                description: data.description ?? "",
                status: data.status || "planned",
                progress:
                    data.progress === null || data.progress === undefined
                        ? 0
                        : Number(data.progress),
                start_date: data.start_date ?? "",
                end_date: data.end_date ?? "",
            });
            return;
        }

        reset(emptyValues);
    }, [isOpen, data, reset]);

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

        const payload = {
            title: formData.title.trim(),
            description: formData.description?.trim() || null,
            status: formData.status || "planned",
            progress:
                formData.progress === null || formData.progress === ""
                    ? 0
                    : Number(formData.progress),
            start_date: formData.start_date || null,
            end_date: formData.end_date || null,
        };

        const options = {
            preserveScroll: true,
            only: ["project"],
            onSuccess: () => {
                toast.success(
                    isEditing ? "Milestone updated" : "Milestone added"
                );
                handleClose();
            },
            onError: (submitErrors) => {
                setServerErrors(submitErrors);
                toast.error(
                    submitErrors.message ||
                        submitErrors.title ||
                        "Unable to save milestone"
                );
            },
            onFinish: () => setProcessing(false),
        };

        if (isEditing) {
            router.patch(
                update.url({ project: projectCode, progress: data.id }),
                payload,
                options
            );
            return;
        }

        router.post(store.url(projectCode), payload, options);
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
            <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
                <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
                    <DialogTitle>
                        {isEditing ? "Edit milestone" : "Add milestone"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? "Update this project milestone on the timeline."
                            : "Add a milestone to the project progress timeline."}
                    </DialogDescription>
                </DialogHeader>

                <form
                    id="project-progress-form"
                    className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
                    onSubmit={handleSubmit(onSubmit, onInvalid)}
                >
                    <div className="space-y-4">
                        <Input
                            label="Title"
                            required
                            placeholder="e.g. Foundation complete"
                            error={fieldError("title")}
                            {...register("title", {
                                required: "Title is required.",
                            })}
                        />

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
                            name="progress"
                            control={control}
                            render={({ field }) => (
                                <NumberInput
                                    label="Progress %"
                                    value={field.value}
                                    onChange={field.onChange}
                                    min={0}
                                    max={100}
                                    showSteppers={false}
                                    placeholder="0"
                                    error={fieldError("progress")}
                                />
                            )}
                        />

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

                        <div className="space-y-0.5">
                            <label className="mb-0.5 flex text-base font-medium text-muted-foreground">
                                Description
                            </label>
                            <Textarea
                                rows={3}
                                placeholder="Optional notes about this milestone"
                                aria-invalid={Boolean(fieldError("description"))}
                                className={
                                    fieldError("description")
                                        ? "border-destructive"
                                        : undefined
                                }
                                {...register("description")}
                            />
                            {fieldError("description") ? (
                                <div className="text-[13px] text-destructive">
                                    {fieldError("description")}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </form>

                <DialogFooter className="shrink-0 border-t border-border bg-popover px-6 py-4 sm:justify-between">
                    <div className="flex w-full items-center justify-between gap-2">
                        {isEditing ? (
                            <Button
                                type="button"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                disabled={processing}
                                onClick={async () => {
                                    const confirmed = await confirm(
                                        `Delete "${data.title}"? This cannot be undone.`,
                                        "Delete Milestone"
                                    );

                                    if (!confirmed) {
                                        return;
                                    }

                                    setProcessing(true);
                                    router.delete(
                                        destroy.url({
                                            project: projectCode,
                                            progress: data.id,
                                        }),
                                        {
                                            preserveScroll: true,
                                            only: ["project"],
                                            onSuccess: () => {
                                                toast.success("Milestone deleted");
                                                handleClose();
                                            },
                                            onError: () => {
                                                toast.error("Unable to delete milestone");
                                            },
                                            onFinish: () => setProcessing(false),
                                        }
                                    );
                                }}
                            >
                                Delete
                            </Button>
                        ) : (
                            <span />
                        )}
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleClose}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                form="project-progress-form"
                                loading={processing}
                            >
                                {isEditing ? "Save changes" : "Add milestone"}
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

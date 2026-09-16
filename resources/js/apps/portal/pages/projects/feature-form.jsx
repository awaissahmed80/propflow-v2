import { useEffect, useState } from "react";
import { router } from "@inertiajs/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { update } from "@/actions/App/Http/Controllers/Portal/ProjectController";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const emptyValues = {
    value: "",
};

/**
 * Add / edit a single project feature string.
 * Features are stored as a JSON string array on the project.
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {(open: boolean) => void} props.onClose
 * @param {string} props.projectCode
 * @param {string[]} [props.features]
 * @param {{ index: number, value: string } | null} [props.data]
 */
export default function FeatureForm({
    isOpen,
    onClose,
    projectCode,
    features = [],
    data = null,
}) {
    const isEditing = data !== null && typeof data.index === "number";
    const [processing, setProcessing] = useState(false);
    const [serverErrors, setServerErrors] = useState({});
    const {
        handleSubmit,
        register,
        reset,
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
        reset({
            value: isEditing ? (data.value ?? "") : "",
        });
    }, [isOpen, data, isEditing, reset]);

    const saveFeatures = (nextFeatures, successMessage) => {
        setProcessing(true);
        setServerErrors({});

        router.patch(
            update.url(projectCode),
            { features: nextFeatures },
            {
                preserveScroll: true,
                only: ["project"],
                onSuccess: () => {
                    toast.success(successMessage);
                    handleClose();
                },
                onError: (submitErrors) => {
                    setServerErrors(submitErrors);
                    toast.error(
                        submitErrors.message ||
                            submitErrors["features.0"] ||
                            submitErrors.features ||
                            "Unable to save feature"
                    );
                },
                onFinish: () => setProcessing(false),
            }
        );
    };

    const onInvalid = (validationErrors) => {
        const firstError = Object.values(validationErrors).find(
            (error) => error?.message
        )?.message;

        if (firstError) {
            toast.error(firstError);
        }
    };

    const onSubmit = (formData) => {
        const value = formData.value.trim();
        const current = Array.isArray(features) ? [...features] : [];

        if (isEditing) {
            current[data.index] = value;
            saveFeatures(current, "Feature updated");
            return;
        }

        saveFeatures([...current, value], "Feature added");
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
            <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
                <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
                    <DialogTitle>
                        {isEditing ? "Edit feature" : "Add feature"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? "Update this project feature highlight."
                            : "Add a feature or amenity for this project."}
                    </DialogDescription>
                </DialogHeader>

                <form
                    id="project-feature-form"
                    className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
                    onSubmit={handleSubmit(onSubmit, onInvalid)}
                >
                    <Input
                        label="Feature"
                        required
                        placeholder="e.g. Swimming pool"
                        error={fieldError("value") || fieldError("features.0")}
                        {...register("value", {
                            required: "Feature is required.",
                            maxLength: {
                                value: 150,
                                message: "Feature must be 150 characters or less.",
                            },
                        })}
                    />
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
                                        `Delete "${data.value}"? This cannot be undone.`,
                                        "Delete Feature"
                                    );

                                    if (!confirmed) {
                                        return;
                                    }

                                    const next = (Array.isArray(features) ? features : []).filter(
                                        (_item, index) => index !== data.index
                                    );

                                    saveFeatures(next, "Feature deleted");
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
                                form="project-feature-form"
                                loading={processing}
                            >
                                {isEditing ? "Save changes" : "Add feature"}
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

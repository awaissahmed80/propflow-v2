import { useEffect, useState } from "react";
import { router } from "@inertiajs/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
    destroy as destroyReminder,
    store as storeReminder,
    update as updateReminder,
} from "@/actions/App/Http/Controllers/Portal/TodoListController";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const emptyValues = {
    title: "",
    notes: "",
    due_at: "",
};

/**
 * Normalize ISO / date values to `yyyy-MM-ddTHH:mm` for the datetime picker.
 *
 * @param {string | null | undefined} value
 * @returns {string}
 */
function toDateTimeLocal(value) {
    if (!value) {
        return "";
    }

    const raw = String(value);
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/);

    if (match) {
        return `${match[1]}T${match[2]}:${match[3]}`;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw.slice(0, 10))) {
        return `${raw.slice(0, 10)}T09:00`;
    }

    return "";
}

function pathFrom(url) {
    const raw = String(url || "/");

    if (raw.startsWith("//") || raw.startsWith("http://") || raw.startsWith("https://")) {
        try {
            const parsed = new URL(raw.startsWith("//") ? `https:${raw}` : raw);

            return `${parsed.pathname || "/"}${parsed.search}${parsed.hash}`;
        } catch {
            return "/";
        }
    }

    return raw.startsWith("/") ? raw : `/${raw}`;
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object | null} [props.reminder]
 * @param {string} [props.window]
 */
export function ReminderForm({ open, onClose, reminder = null, window = "week" }) {
    const isEditing = Boolean(reminder?.id);
    const [processing, setProcessing] = useState(false);
    const [serverErrors, setServerErrors] = useState({});
    const {
        handleSubmit,
        register,
        reset,
        setValue,
        watch,
        formState: { errors },
    } = useForm({
        defaultValues: emptyValues,
        mode: "onSubmit",
    });

    const dueAt = watch("due_at");
    const fieldError = (name) => serverErrors[name] || errors[name]?.message;

    useEffect(() => {
        if (!open) {
            return;
        }

        setServerErrors({});
        reset({
            title: reminder?.title || "",
            notes: reminder?.notes || "",
            due_at: toDateTimeLocal(reminder?.due_at),
        });
    }, [open, reminder, reset]);

    const handleClose = () => {
        reset(emptyValues);
        setServerErrors({});
        onClose();
    };

    const onSubmit = (values) => {
        setProcessing(true);
        setServerErrors({});

        const payload = {
            title: values.title.trim(),
            notes: values.notes?.trim() || null,
            due_at: values.due_at || null,
        };

        const options = {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(isEditing ? "Reminder updated" : "Reminder added");
                handleClose();
            },
            onError: (submitErrors) => {
                setServerErrors(submitErrors || {});
                toast.error(
                    submitErrors?.title ||
                        submitErrors?.message ||
                        "Unable to save reminder"
                );
            },
            onFinish: () => setProcessing(false),
        };

        const query = window && window !== "week" ? { window } : {};

        if (isEditing) {
            router.put(
                pathFrom(updateReminder.url(reminder.id, { query })),
                payload,
                options
            );
        } else {
            router.post(pathFrom(storeReminder.url({ query })), payload, options);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    handleClose();
                }
            }}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Edit reminder" : "Add reminder"}</DialogTitle>
                    <DialogDescription>
                        Personal notes that only you see on the Todo List.
                    </DialogDescription>
                </DialogHeader>

                <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                    <div className="space-y-1.5">
                        <Label htmlFor="reminder-title">Title</Label>
                        <Input
                            id="reminder-title"
                            placeholder="Call the bank, review inventory…"
                            aria-invalid={Boolean(fieldError("title"))}
                            {...register("title", { required: "Title is required" })}
                        />
                        {fieldError("title") ? (
                            <p className="text-xs text-destructive">{fieldError("title")}</p>
                        ) : null}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="reminder-notes">Notes</Label>
                        <Textarea
                            id="reminder-notes"
                            rows={3}
                            placeholder="Optional details"
                            {...register("notes")}
                        />
                        {fieldError("notes") ? (
                            <p className="text-xs text-destructive">{fieldError("notes")}</p>
                        ) : null}
                    </div>

                    <DatePicker
                        label="Due date & time"
                        showTime
                        placeholder="Select date and time..."
                        value={dueAt || ""}
                        error={fieldError("due_at")}
                        onChange={(value) =>
                            setValue("due_at", value || "", { shouldDirty: true })
                        }
                    />

                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={processing}
                            onClick={handleClose}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing ? "Saving…" : isEditing ? "Save" : "Add reminder"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function destroyPersonalReminder(reminderId, window = "week") {
    return new Promise((resolve, reject) => {
        router.delete(
            pathFrom(
                destroyReminder.url(reminderId, {
                    query: window && window !== "week" ? { window } : {},
                })
            ),
            {
                preserveScroll: true,
                onSuccess: () => resolve(),
                onError: () => reject(new Error("Unable to delete reminder")),
            }
        );
    });
}

export function togglePersonalReminder(reminder, completed, window = "week") {
    return new Promise((resolve, reject) => {
        router.put(
            pathFrom(
                updateReminder.url(reminder.id, {
                    query: window && window !== "week" ? { window } : {},
                })
            ),
            { completed },
            {
                preserveScroll: true,
                onSuccess: () => resolve(),
                onError: () => reject(new Error("Unable to update reminder")),
            }
        );
    });
}

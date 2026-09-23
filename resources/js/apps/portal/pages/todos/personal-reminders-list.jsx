import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { CheckboxControl } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { formatDateTime, formatRelativeTime, toDayjs } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import {
    destroyPersonalReminder,
    togglePersonalReminder,
} from "./reminder-form";

function dueLabel(dueAt, overdue, completed) {
    if (completed) {
        return "Done";
    }

    const date = toDayjs(dueAt);

    if (!date) {
        return "No due date";
    }

    if (overdue) {
        return `Overdue · ${formatRelativeTime(dueAt)}`;
    }

    if (date.isSame(toDayjs(new Date()), "day")) {
        return `Today · ${formatDateTime(dueAt, "h:mm A")}`;
    }

    return formatDateTime(dueAt, "MMM D, YYYY h:mm A");
}

export function PersonalRemindersList({
    reminders = [],
    window = "week",
    onEdit,
}) {
    const open = reminders.filter((item) => !item.completed);
    const done = reminders.filter((item) => item.completed);

    if (reminders.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
                No personal reminders yet. Add one to keep yourself on track.
            </div>
        );
    }

    const toggle = async (reminder, completed) => {
        try {
            await togglePersonalReminder(reminder, completed, window);
            toast.success(completed ? "Marked complete" : "Reopened");
        } catch {
            toast.error("Unable to update reminder");
        }
    };

    const remove = async (reminder) => {
        const confirmed = await confirm(
            `Delete “${reminder.title}”? This cannot be undone.`,
            "Delete reminder"
        );

        if (!confirmed) {
            return;
        }

        try {
            await destroyPersonalReminder(reminder.id, window);
            toast.success("Reminder deleted");
        } catch {
            toast.error("Unable to delete reminder");
        }
    };

    const renderRow = (reminder) => (
        <div
            key={reminder.id}
            className={cn(
                "flex items-start gap-3 rounded-xl border border-border/80 bg-card px-4 py-3 shadow-xs",
                reminder.completed && "opacity-70"
            )}
        >
            <CheckboxControl
                className="mt-1"
                checked={Boolean(reminder.completed)}
                onCheckedChange={(checked) => toggle(reminder, Boolean(checked))}
                aria-label={`Mark ${reminder.title} ${reminder.completed ? "open" : "complete"}`}
            />
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <p
                        className={cn(
                            "truncate text-sm font-semibold text-foreground",
                            reminder.completed && "line-through text-muted-foreground"
                        )}
                    >
                        {reminder.title}
                    </p>
                    <Badge
                        variant="outline"
                        className={cn(
                            "rounded-md px-1.5 py-0 text-[11px] font-medium",
                            reminder.overdue && !reminder.completed
                                ? "border-destructive/40 text-destructive"
                                : "text-muted-foreground"
                        )}
                    >
                        {dueLabel(reminder.due_at, reminder.overdue, reminder.completed)}
                    </Badge>
                </div>
                {reminder.notes ? (
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        {reminder.notes}
                    </p>
                ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
                <IconButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon="pencil-line"
                    aria-label={`Edit ${reminder.title}`}
                    onClick={() => onEdit?.(reminder)}
                />
                <IconButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon="delete-bin-line"
                    aria-label={`Delete ${reminder.title}`}
                    onClick={() => remove(reminder)}
                />
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            {open.length > 0 ? (
                <div className="space-y-2">{open.map(renderRow)}</div>
            ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                    All caught up — no open reminders.
                </div>
            )}

            {done.length > 0 ? (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <Icon name="checkbox-circle-line" className="text-sm" />
                        Completed
                    </div>
                    {done.map(renderRow)}
                </div>
            ) : null}
        </div>
    );
}

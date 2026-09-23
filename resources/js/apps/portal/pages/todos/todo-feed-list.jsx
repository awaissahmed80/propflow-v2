import { router } from "@inertiajs/react";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { formatDateTime, formatRelativeTime, toDayjs } from "@/lib/datetime";
import { cn } from "@/lib/utils";

const SOURCE_STYLES = {
    lead: {
        label: "Lead",
        icon: "border-primary/30 bg-primary/10 text-primary",
        card: "border-primary/25 hover:border-primary/40 hover:bg-primary/5",
        badge: "border-primary/35 bg-primary/10 text-primary",
        accent: "bg-primary",
    },
    installment: {
        label: "Booking",
        icon: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        card: "border-emerald-500/25 hover:border-emerald-500/40 hover:bg-emerald-500/5",
        badge: "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        accent: "bg-emerald-500",
    },
    task: {
        label: "Task",
        icon: "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300",
        card: "border-amber-500/25 hover:border-amber-500/40 hover:bg-amber-500/5",
        badge: "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        accent: "bg-amber-500",
    },
};

const FALLBACK_STYLE = {
    label: "Other",
    icon: "border-slate-500/30 bg-slate-500/15 text-slate-700 dark:text-slate-300",
    card: "border-slate-500/25 hover:border-slate-500/40 hover:bg-slate-500/5",
    badge: "border-slate-500/35 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    accent: "bg-slate-500",
};

function sourceStyle(source) {
    return SOURCE_STYLES[source] || FALLBACK_STYLE;
}

function dueLabel(dueAt, overdue) {
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

    return formatDateTime(dueAt, "MMM D, YYYY");
}

export function TodoFeedList({ items = [] }) {
    if (items.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
                Nothing critical in this window. You’re clear for now.
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {items.map((item) => {
                const style = sourceStyle(item.source);

                return (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                            if (item.href) {
                                router.get(item.href);
                            }
                        }}
                        className={cn(
                            "relative flex w-full items-start gap-3 overflow-hidden rounded-xl border bg-card px-4 py-3 text-left shadow-xs transition-colors",
                            style.card,
                            !item.href && "cursor-default"
                        )}
                    >
                        <span
                            className={cn(
                                "absolute inset-y-0 left-0 w-1",
                                item.overdue ? "bg-destructive" : style.accent
                            )}
                            aria-hidden
                        />
                        <span
                            className={cn(
                                "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border",
                                item.overdue
                                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                                    : style.icon
                            )}
                        >
                            <Icon name={item.icon || "checkbox-line"} className="text-base" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-sm font-semibold text-foreground">
                                    {item.title}
                                </span>
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "rounded-md px-1.5 py-0 text-[11px] font-medium",
                                        style.badge
                                    )}
                                >
                                    {style.label}
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "rounded-md px-1.5 py-0 text-[11px] font-medium",
                                        item.overdue
                                            ? "border-destructive/40 text-destructive"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    {dueLabel(item.due_at, item.overdue)}
                                </Badge>
                            </span>
                            {item.subtitle ? (
                                <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                                    {item.subtitle}
                                </span>
                            ) : null}
                        </span>
                        {item.href ? (
                            <Icon
                                name="arrow-right-s-line"
                                className="mt-1.5 shrink-0 text-lg text-muted-foreground"
                            />
                        ) : null}
                    </button>
                );
            })}
        </div>
    );
}

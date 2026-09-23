import { Link } from "@inertiajs/react";
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";

export function StatItem({ icon, label, value, href }) {
    const content = (
        <>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon name={icon} className="text-xl" />
            </div>
            <div className="min-w-0">
                <div className="truncate text-xs text-muted-foreground">{label}</div>
                <div className="truncate text-base font-semibold tracking-tight text-foreground">
                    {value}
                </div>
            </div>
        </>
    );

    if (href) {
        return (
            <Link
                href={href}
                className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
            >
                {content}
            </Link>
        );
    }

    return (
        <div className="flex min-w-0 items-center gap-3 px-4 py-3 sm:px-5">
            {content}
        </div>
    );
}

export function EmptyPanel({ icon = "folder-warning-line", message, action }) {
    return (
        <div className="flex min-h-40 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <div className="relative flex size-16 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
                <Icon name={icon} className="text-3xl" />
            </div>
            <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
            {action}
        </div>
    );
}

export function SidebarSection({ title, icon = "flag-line", onAdd, action, children }) {
    return (
        <Card
            size="sm"
            className="gap-0 rounded-md py-0 shadow-[0_16px_48px_-24px_rgba(0,0,0,0.12)] ring-border/60 dark:shadow-[0_16px_48px_-24px_rgba(0,0,0,0.45)]"
        >
            <CardHeader className="border-b border-border px-4 py-3 [.border-b]:pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <Icon name={icon} className="text-base text-muted-foreground" />
                    {title}
                </CardTitle>
                {action ? <CardAction>{action}</CardAction> : null}
                {!action && onAdd ? (
                    <CardAction>
                        <IconButton
                            type="button"
                            size="sm"
                            className="rounded-md"
                            icon="add-line"
                            aria-label={`Add to ${title}`}
                            onClick={onAdd}
                        />
                    </CardAction>
                ) : null}
            </CardHeader>
            <CardContent className="px-4 py-4">{children}</CardContent>
        </Card>
    );
}

import { useState } from "react";
import { router } from "@inertiajs/react";
import { index as activityIndex } from "@/routes/portal/activity";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { isPagePending, PageSkeleton } from "../../components/page-skeleton";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDateTime, formatRelativeTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

const SECTION_ICONS = {
    users: "user-2-line",
    leads: "customer-service-line",
    campaigns: "focus-3-line",
    contacts: "folder-user-line",
    projects: "community-line",
    inventory: "shape-line",
    teams: "user-community-line",
    settings: "settings-2-line",
    files: "folder-2-line",
    other: "history-line",
};

const ACTION_LABELS = {
    created: "Created",
    updated: "Updated",
    deleted: "Deleted",
    restored: "Restored",
};

function visitSection(section) {
    router.get(
        activityIndex.url({
            query: section === "all" ? {} : { section },
        }),
        {},
        { preserveScroll: true, preserveState: true }
    );
}

function ActivityPage({ logs: logsProp, section = "all", sections: sectionsProp, pagination }) {
    const pending = isPagePending(logsProp) || isPagePending(sectionsProp);
    const logs = logsProp ?? [];
    const sections = sectionsProp ?? [];

    if (pending) {
        return <PageSkeleton title="Activity" variant="activity" />;
    }

    return (
        <Layout>
            <Layout.Header
                metaTitle="Activity"
                breadcrumbs={[{ label: "Activity" }]}
            />

            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar className="flex-wrap gap-3">
                    <h1 className="shrink-0 text-2xl font-bold tracking-tight text-foreground">
                        Activity
                    </h1>
                    <div className="flex flex-wrap gap-1.5">
                        {sections.map((item) => {
                            const active = item.id === section;

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => visitSection(item.id)}
                                    className={cn(
                                        "rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
                                        active
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                </Layout.Toolbar>

                <ScrollArea className="min-h-0 flex-1">
                    <div className="mx-auto w-full max-w-3xl space-y-3 px-6 py-5">
                        {logs.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-16 text-center text-sm text-muted-foreground">
                                No activity in this section yet.
                            </div>
                        ) : (
                            logs.map((log) => <ActivityEntry key={log.id} log={log} />)
                        )}

                        {pagination?.last_page > 1 ? (
                            <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
                                <span>
                                    {pagination.from}–{pagination.to} of {pagination.total}
                                </span>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={pagination.current_page <= 1}
                                        onClick={() =>
                                            router.get(
                                                activityIndex.url({
                                                    query: {
                                                        ...(section !== "all" ? { section } : {}),
                                                        page: pagination.current_page - 1,
                                                    },
                                                }),
                                                {},
                                                { preserveScroll: true }
                                            )
                                        }
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={pagination.current_page >= pagination.last_page}
                                        onClick={() =>
                                            router.get(
                                                activityIndex.url({
                                                    query: {
                                                        ...(section !== "all" ? { section } : {}),
                                                        page: pagination.current_page + 1,
                                                    },
                                                }),
                                                {},
                                                { preserveScroll: true }
                                            )
                                        }
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </ScrollArea>
            </Layout.Content>
        </Layout>
    );
}

function ActivityEntry({ log }) {
    const [open, setOpen] = useState(false);
    const details = Array.isArray(log.details) ? log.details : [];
    const action = ACTION_LABELS[log.action] || log.action;
    const icon = SECTION_ICONS[log.section] || SECTION_ICONS.other;
    const actor = log.user?.display_name || "Someone";

    return (
        <article className="rounded-xl border border-border/80 bg-background px-4 py-3">
            <div className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon name={icon} className="text-base" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">
                        <span className="font-semibold">{actor}</span>{" "}
                        <span className="text-muted-foreground">{action.toLowerCase()}</span>{" "}
                        <span className="font-medium">{log.subject?.label}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {[log.section_label, log.subject?.type, formatRelativeTime(log.created_at)]
                            .filter(Boolean)
                            .join(" · ")}
                        {log.created_at ? (
                            <span className="sr-only">{formatDateTime(log.created_at)}</span>
                        ) : null}
                    </p>

                    {details.length > 0 ? (
                        <div className="mt-2">
                            <button
                                type="button"
                                className="text-xs font-medium text-primary hover:underline"
                                onClick={() => setOpen((current) => !current)}
                            >
                                {open ? "Hide details" : `Details (${details.length})`}
                            </button>
                            {open ? (
                                <dl className="mt-2 space-y-1.5 rounded-md bg-muted/40 px-3 py-2">
                                    {details.map((row) => (
                                        <div key={row.field} className="text-xs">
                                            <dt className="font-medium text-foreground">{row.field}</dt>
                                            <dd className="text-muted-foreground">
                                                {row.from && row.to
                                                    ? `${row.from} → ${row.to}`
                                                    : row.to || row.from}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            </div>
        </article>
    );
}

ActivityPage.layout = (page) => <PortalLayout children={page} />;

export default ActivityPage;

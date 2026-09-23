import { useEffect, useMemo, useRef, useState } from "react";
import { InfiniteScroll, router } from "@inertiajs/react";
import { index as activityIndex } from "@/routes/portal/activity";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { isPagePending, PageSkeleton } from "../../components/page-skeleton";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FilterInput } from "@/components/ui/filter-input";
import {
    ActiveFilters,
    FilterMenu,
    toSelectedList,
} from "@/components/ui/filter-menu";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDateTime, formatRelativeTime, groupByDay } from "@/lib/datetime";
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

const ACTION_META = {
    created: {
        label: "Created",
        icon: "add-circle-line",
        accent: "bg-emerald-500",
        badge: "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        iconWrap:
            "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
    updated: {
        label: "Updated",
        icon: "pencil-line",
        accent: "bg-sky-500",
        badge: "border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        iconWrap: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    },
    deleted: {
        label: "Deleted",
        icon: "delete-bin-line",
        accent: "bg-destructive",
        badge: "border-destructive/40 bg-destructive/10 text-destructive",
        iconWrap: "border-destructive/30 bg-destructive/10 text-destructive",
    },
    restored: {
        label: "Restored",
        icon: "arrow-go-back-line",
        accent: "bg-amber-500",
        badge: "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        iconWrap:
            "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
};

const FALLBACK_ACTION = {
    label: "Changed",
    icon: "history-line",
    accent: "bg-muted-foreground",
    badge: "border-border bg-muted text-muted-foreground",
    iconWrap: "border-border bg-muted text-muted-foreground",
};

function toFilterParam(value) {
    const list = toSelectedList(value);

    return list.length > 0 ? list.join(",") : "";
}

function ActivityPage({
    logs: logsProp,
    filters: filtersProp = {},
    formOptions: formOptionsProp,
}) {
    const pending =
        isPagePending(logsProp) ||
        isPagePending(formOptionsProp) ||
        isPagePending(filtersProp);
    const logs = Array.isArray(logsProp?.data) ? logsProp.data : [];
    const filters = filtersProp ?? {};
    const formOptions = formOptionsProp ?? {};
    const [search, setSearch] = useState(filters.q || "");
    const searchTimeout = useRef(null);
    const dayGroups = useMemo(() => groupByDay(logs), [logs]);

    const appliedFilters = useMemo(
        () => ({
            section: toSelectedList(filters.section),
            action: toSelectedList(filters.action),
            user: toSelectedList(filters.user),
        }),
        [filters.section, filters.action, filters.user],
    );

    useEffect(() => {
        setSearch(filters.q || "");
    }, [filters.q]);

    useEffect(() => {
        return () => {
            if (searchTimeout.current) {
                clearTimeout(searchTimeout.current);
            }
        };
    }, []);

    const filterSections = useMemo(() => {
        const sectionOptions = (formOptions.sections || []).map((item) => ({
            value: item.id,
            label: item.label,
            icon: SECTION_ICONS[item.id] || SECTION_ICONS.other,
        }));

        const actionOptions = (formOptions.actions || []).map((item) => ({
            value: item.value,
            label: item.label,
        }));

        const userOptions = (formOptions.users || []).map((user) => ({
            value: String(user.id),
            label: user.display_name,
            avatar: {
                name: user.display_name,
                src: user.avatar || undefined,
            },
        }));

        return [
            {
                key: "section",
                label: "Section",
                type: "icons",
                options: sectionOptions,
            },
            {
                key: "action",
                label: "Action",
                options: actionOptions,
            },
            ...(userOptions.length > 0
                ? [
                      {
                          key: "user",
                          label: "Actor",
                          type: "people",
                          options: userOptions,
                      },
                  ]
                : []),
        ];
    }, [formOptions.sections, formOptions.actions, formOptions.users]);

    const visitActivity = (next = {}) => {
        const params = {
            q: Object.prototype.hasOwnProperty.call(next, "q") ? next.q : search,
            section: toFilterParam(
                Object.prototype.hasOwnProperty.call(next, "section")
                    ? next.section
                    : appliedFilters.section,
            ),
            action: toFilterParam(
                Object.prototype.hasOwnProperty.call(next, "action")
                    ? next.action
                    : appliedFilters.action,
            ),
            user: toFilterParam(
                Object.prototype.hasOwnProperty.call(next, "user")
                    ? next.user
                    : appliedFilters.user,
            ),
        };

        Object.keys(params).forEach((key) => {
            if (!params[key]) {
                delete params[key];
            }
        });

        router.get(activityIndex.url(), params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ["logs", "filters", "formOptions"],
            reset: ["logs"],
        });
    };

    const handleSearchChange = (event) => {
        const value = event.target.value;
        setSearch(value);

        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }

        searchTimeout.current = setTimeout(() => {
            visitActivity({ q: value });
        }, 300);
    };

    const handleFiltersApply = (next) => {
        visitActivity({
            section: next.section || [],
            action: next.action || [],
            user: next.user || [],
        });
    };

    const handleFiltersClear = () => {
        visitActivity({
            section: [],
            action: [],
            user: [],
            q: "",
        });
        setSearch("");
    };

    const hasFilters =
        Boolean(filters.q) ||
        appliedFilters.section.length > 0 ||
        appliedFilters.action.length > 0 ||
        appliedFilters.user.length > 0;

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
                <Layout.Toolbar className="flex-wrap">
                    <h1 className="shrink-0 text-2xl font-bold tracking-tight text-foreground">
                        Activity
                    </h1>

                    <FilterInput
                        value={search}
                        onChange={handleSearchChange}
                        placeholder="Search activity..."
                        className="w-56"
                    />

                    <FilterMenu
                        sections={filterSections}
                        value={appliedFilters}
                        onApply={handleFiltersApply}
                    />
                </Layout.Toolbar>

                <ActiveFilters
                    sections={filterSections}
                    value={appliedFilters}
                    onChange={handleFiltersApply}
                    onClear={handleFiltersClear}
                    className="shrink-0"
                />

                <ScrollArea className="min-h-0 flex-1">
                    <div className="w-full px-6 py-5">
                        {logs.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-16 text-center text-sm text-muted-foreground">
                                {hasFilters
                                    ? "No activity matches your filters."
                                    : "No activity yet."}
                            </div>
                        ) : (
                            <InfiniteScroll
                                data="logs"
                                manual
                                onlyNext
                                next={({ loading, fetch, hasMore }) => {
                                    if (loading) {
                                        return (
                                            <div className="space-y-3 pt-6 pb-2">
                                                <div className="flex justify-center">
                                                    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-xs">
                                                        <Icon
                                                            name="loader-3-fill"
                                                            className="animate-spin text-sm"
                                                        />
                                                        Loading previous…
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                    {Array.from({ length: 4 }, (_, index) => (
                                                        <ActivityEntrySkeleton key={index} />
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }

                                    if (!hasMore) {
                                        return null;
                                    }

                                    return (
                                        <div className="flex justify-center pt-6 pb-2">
                                            <IconButton
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                icon="refresh-line"
                                                onClick={fetch}
                                                aria-label="Load previous activity"
                                                tooltip="Load previous"
                                            />
                                        </div>
                                    );
                                }}
                            >
                                <div className="space-y-8">
                                    {dayGroups.map((group) => (
                                        <section key={group.key} className="space-y-3">
                                            <div className="sticky top-0 z-10 flex justify-center py-1.5">
                                                <h2 className="inline-flex items-center rounded-full border border-border bg-muted px-3.5 py-1 text-xs font-semibold tracking-wide text-muted-foreground shadow-xs">
                                                    {group.label}
                                                </h2>
                                            </div>
                                            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                                                {group.items.map((log) => (
                                                    <ActivityEntry key={log.id} log={log} />
                                                ))}
                                            </div>
                                        </section>
                                    ))}
                                </div>
                            </InfiniteScroll>
                        )}
                    </div>
                </ScrollArea>
            </Layout.Content>
        </Layout>
    );
}

function ActivityEntrySkeleton() {
    return (
        <article className="relative overflow-hidden rounded-xl border border-border/80 bg-card px-4 py-3.5 shadow-xs">
            <span className="absolute inset-y-0 left-0 w-1 bg-muted" aria-hidden />
            <div className="flex gap-3 pl-1">
                <Skeleton className="size-9 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2.5">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-36 max-w-[50%]" />
                        <Skeleton className="h-5 w-16 rounded-md" />
                    </div>
                    <Skeleton className="h-3.5 w-48 max-w-[70%]" />
                    <div className="flex items-center gap-2 pt-0.5">
                        <Skeleton className="size-5 rounded-full" />
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-16" />
                    </div>
                </div>
            </div>
        </article>
    );
}

function RelativeTime({ value }) {
    if (!value) {
        return <span className="text-xs text-muted-foreground">—</span>;
    }

    return (
        <Tooltip>
            <TooltipTrigger
                delay={200}
                render={
                    <button
                        type="button"
                        className="cursor-default border-0 bg-transparent p-0 text-xs text-muted-foreground tabular-nums"
                    >
                        {formatRelativeTime(value)}
                    </button>
                }
            />
            <TooltipContent>{formatDateTime(value)}</TooltipContent>
        </Tooltip>
    );
}

function ActivityEntry({ log }) {
    const [open, setOpen] = useState(false);
    const details = Array.isArray(log.details) ? log.details : [];
    const action = ACTION_META[log.action] || FALLBACK_ACTION;
    const sectionIcon = SECTION_ICONS[log.section] || SECTION_ICONS.other;
    const actor = log.user?.display_name || "Someone";
    const subject = log.subject?.label || "Untitled";
    const typeLabel = log.subject?.type || null;

    return (
        <article
            className={cn(
                "group relative overflow-hidden rounded-xl border border-border/80 bg-card px-4 py-3.5 shadow-xs",
                "transition-[border-color,box-shadow,background-color] hover:border-border hover:bg-muted/20 hover:shadow-sm",
            )}
        >
            <span
                className={cn("absolute inset-y-0 left-0 w-1", action.accent)}
                aria-hidden
            />

            <div className="flex gap-3 pl-1">
                <span
                    className={cn(
                        "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border",
                        action.iconWrap,
                    )}
                    aria-hidden
                >
                    <Icon name={sectionIcon} className="text-base" />
                </span>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-sm font-semibold text-foreground">
                                    {subject}
                                </h3>
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "rounded-md px-1.5 py-0 text-[11px] font-medium",
                                        action.badge,
                                    )}
                                >
                                    <Icon name={action.icon} className="mr-1 text-[11px]" />
                                    {action.label}
                                </Badge>
                            </div>

                            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                                {log.section_label ? (
                                    <span className="inline-flex items-center gap-1 font-medium text-foreground/70">
                                        <Icon name={sectionIcon} className="text-[11px]" />
                                        {log.section_label}
                                    </span>
                                ) : null}
                                {typeLabel ? (
                                    <>
                                        <span aria-hidden>·</span>
                                        <span>{typeLabel}</span>
                                    </>
                                ) : null}
                            </p>
                        </div>

                        <RelativeTime value={log.created_at} />
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <div className="inline-flex min-w-0 items-center gap-1.5">
                            <Avatar
                                name={actor}
                                className="size-5 shrink-0"
                                textClass="text-[8px]"
                            />
                            <span className="truncate text-xs font-medium text-foreground/80">
                                {actor}
                            </span>
                        </div>

                        {details.length > 0 ? (
                            <button
                                type="button"
                                onClick={() => setOpen((current) => !current)}
                                className={cn(
                                    "ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors",
                                    open
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                )}
                            >
                                <Icon
                                    name={open ? "arrow-up-s-line" : "arrow-down-s-line"}
                                    className="text-sm"
                                />
                                {open ? "Hide" : `${details.length} change${details.length === 1 ? "" : "s"}`}
                            </button>
                        ) : null}
                    </div>

                    {open && details.length > 0 ? (
                        <dl className="mt-3 space-y-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
                            {details.map((row) => (
                                <div
                                    key={row.field}
                                    className="grid gap-1 text-xs sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-start sm:gap-3"
                                >
                                    <dt className="font-medium text-muted-foreground">
                                        {row.field}
                                    </dt>
                                    <dd className="min-w-0 text-foreground">
                                        {row.from && row.to ? (
                                            <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
                                                <span className="max-w-full truncate rounded-md bg-background px-1.5 py-0.5 text-muted-foreground line-through decoration-muted-foreground/50">
                                                    {row.from}
                                                </span>
                                                <Icon
                                                    name="arrow-right-line"
                                                    className="shrink-0 text-muted-foreground"
                                                />
                                                <span className="max-w-full truncate rounded-md bg-background px-1.5 py-0.5 font-medium">
                                                    {row.to}
                                                </span>
                                            </span>
                                        ) : (
                                            <span className="font-medium">
                                                {row.to || row.from}
                                            </span>
                                        )}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    ) : null}
                </div>
            </div>
        </article>
    );
}

ActivityPage.layout = (page) => <PortalLayout children={page} />;

export default ActivityPage;

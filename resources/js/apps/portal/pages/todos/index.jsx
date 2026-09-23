import { useState } from "react";
import { router } from "@inertiajs/react";
import { index as todosIndex } from "@/routes/portal/todos";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { isPagePending, PageSkeleton } from "../../components/page-skeleton";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { PersonalRemindersList } from "./personal-reminders-list";
import { ReminderForm } from "./reminder-form";
import { TodoFeedList } from "./todo-feed-list";

const emptyFeedPagination = {
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: 0,
    from: null,
    to: null,
};

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

function todosQuery({ window: nextWindow, page } = {}) {
    const query = {};

    if (nextWindow && nextWindow !== "week") {
        query.window = nextWindow;
    }

    if (page && page > 1) {
        query.page = page;
    }

    return query;
}

function visitTodos({ window: nextWindow, page } = {}) {
    router.get(
        pathFrom(
            todosIndex.url({
                query: todosQuery({ window: nextWindow, page }),
            })
        ),
        {},
        {
            preserveScroll: true,
            preserveState: true,
            only: ["feed", "feedPagination", "window"],
        }
    );
}

export default function TodoListIndex({
    title = "Todo List",
    description = "Critical follow-ups across leads and bookings, plus your own reminders.",
    breadcrumbs = [{ label: "Todo List" }],
    window: activeWindow = "week",
    windows: windowsProp,
    feed: feedProp,
    feedPagination: feedPaginationProp,
    reminders: remindersProp,
}) {
    const pending =
        isPagePending(feedProp) ||
        isPagePending(remindersProp) ||
        isPagePending(windowsProp);
    const feed = feedProp ?? [];
    const feedPagination = feedPaginationProp ?? emptyFeedPagination;
    const reminders = remindersProp ?? [];
    const windows = windowsProp ?? [
        { id: "overdue", label: "Overdue" },
        { id: "today", label: "Today" },
        { id: "week", label: "This week" },
        { id: "all", label: "All" },
    ];

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);

    if (pending) {
        return <PageSkeleton title={title} variant="activity" />;
    }

    const currentPage = Number(feedPagination.current_page) || 1;
    const lastPage = Math.max(1, Number(feedPagination.last_page) || 1);
    const total = Number(feedPagination.total) || 0;

    const openCreate = () => {
        setEditing(null);
        setFormOpen(true);
    };

    const openEdit = (reminder) => {
        setEditing(reminder);
        setFormOpen(true);
    };

    return (
        <Layout>
            <Layout.Header metaTitle={title} breadcrumbs={breadcrumbs} />
            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar className="flex-wrap gap-3">
                    <div className="mr-auto min-w-0">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            {title}
                        </h1>
                        <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
                            {description}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {windows.map((item) => {
                            const active = item.id === activeWindow;

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => visitTodos({ window: item.id })}
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
                    <div className="grid w-full gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-8 lg:items-start">
                        <section className="min-w-0 space-y-3">
                            <div className="flex items-center justify-between gap-3 px-1">
                                <div>
                                    <h2 className="text-sm font-semibold tracking-tight text-foreground">
                                        Needs attention
                                    </h2>
                                    <p className="text-xs text-muted-foreground">
                                        Lead follow-ups and upcoming installment dues assigned to you.
                                    </p>
                                </div>
                                <span className="text-xs tabular-nums text-muted-foreground">
                                    {total}
                                </span>
                            </div>
                            <TodoFeedList items={feed} />
                            {lastPage > 1 ? (
                                <div className="flex items-center justify-between gap-3 px-1 pt-1">
                                    <p className="text-xs tabular-nums text-muted-foreground">
                                        {feedPagination.from}–{feedPagination.to} of {total}
                                    </p>
                                    <div className="flex shrink-0 gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={currentPage <= 1}
                                            onClick={() =>
                                                visitTodos({
                                                    window: activeWindow,
                                                    page: currentPage - 1,
                                                })
                                            }
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={currentPage >= lastPage}
                                            onClick={() =>
                                                visitTodos({
                                                    window: activeWindow,
                                                    page: currentPage + 1,
                                                })
                                            }
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                        </section>

                        <section className="min-w-0 space-y-3">
                            <div className="flex items-center justify-between gap-3 px-1">
                                <div>
                                    <h2 className="text-sm font-semibold tracking-tight text-foreground">
                                        My reminders
                                    </h2>
                                    <p className="text-xs text-muted-foreground">
                                        Personal notes and deadlines only you can see.
                                    </p>
                                </div>
                                <IconButton
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    icon="add-line"
                                    aria-label="Add reminder"
                                    onClick={openCreate}
                                />
                            </div>
                            <PersonalRemindersList
                                reminders={reminders}
                                window={activeWindow}
                                onEdit={openEdit}
                            />
                        </section>
                    </div>
                </ScrollArea>
            </Layout.Content>

            <ReminderForm
                open={formOpen}
                onClose={() => {
                    setFormOpen(false);
                    setEditing(null);
                }}
                reminder={editing}
                window={activeWindow}
            />
        </Layout>
    );
}

TodoListIndex.layout = (page) => <PortalLayout children={page} />;

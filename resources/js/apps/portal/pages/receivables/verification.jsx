import { router } from "@inertiajs/react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { formatDateTime, formatRelativeTime } from "@/lib/datetime";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { OperationsSubnav, RECEIVABLES_SUBNAV } from "../../components/operations-subnav";
import { isPagePending, PageSkeleton } from "../../components/page-skeleton";

const emptyPagination = {
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
    from: null,
    to: null,
};

export default function VerificationQueue({
    title = "Verification Queue",
    description = "Token bookings awaiting formal verification.",
    breadcrumbs = [
        { label: "Sales" },
        { label: "Receivables" },
        { label: "Verification Queue" },
    ],
    filters: filtersProp,
    bookings: bookingsProp,
    pagination: paginationProp,
}) {
    const pending = isPagePending(bookingsProp) || isPagePending(paginationProp);
    const bookings = bookingsProp ?? [];
    const pagination = paginationProp ?? emptyPagination;
    const mine = Boolean(filtersProp?.mine);
    const currentPage = Number(pagination.current_page) || 1;
    const lastPage = Math.max(1, Number(pagination.last_page) || 1);

    if (pending) {
        return <PageSkeleton title={title} variant="activity" />;
    }

    const visit = (next = {}) => {
        const query = {};

        if (next.mine ?? mine) {
            query.mine = 1;
        }

        if ((next.page ?? currentPage) > 1) {
            query.page = next.page ?? currentPage;
        }

        router.get("/receivables/verification", query, {
            preserveScroll: true,
            preserveState: true,
        });
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
                    <Button
                        type="button"
                        size="sm"
                        variant={mine ? "default" : "outline"}
                        onClick={() => visit({ mine: !mine, page: 1 })}
                    >
                        Assigned to me
                    </Button>
                </Layout.Toolbar>
                <OperationsSubnav items={RECEIVABLES_SUBNAV} />
                <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
                    {bookings.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
                            No token bookings waiting on verification
                            {mine ? " for you" : ""}.
                        </div>
                    ) : (
                        <ul className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs">
                            {bookings.map((row) => (
                                <li
                                    key={row.id}
                                    className="border-b border-border/70 last:border-b-0"
                                >
                                    <button
                                        type="button"
                                        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40"
                                        onClick={() => router.get(row.href)}
                                    >
                                        <span
                                            className={cn(
                                                "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border",
                                                row.docs_ready
                                                    ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                                    : "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                            )}
                                        >
                                            <Icon
                                                name={
                                                    row.docs_ready
                                                        ? "shield-check-line"
                                                        : "file-warning-line"
                                                }
                                                className="text-base"
                                            />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-semibold text-foreground">
                                                    {row.buyer}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    #{row.code}
                                                </span>
                                            </span>
                                            <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                                                {[row.project, row.assignee]
                                                    .filter(Boolean)
                                                    .join(" · ") || "Unassigned"}
                                            </span>
                                            <span className="mt-1 block text-[11px] text-muted-foreground">
                                                {row.docs_ready
                                                    ? `${row.docs_count} doc${row.docs_count === 1 ? "" : "s"} ready`
                                                    : "Docs still needed"}
                                                {row.booked_at
                                                    ? ` · Booked ${formatRelativeTime(row.booked_at)} (${formatDateTime(row.booked_at, "D MMM")})`
                                                    : ""}
                                            </span>
                                        </span>
                                        <Icon
                                            name="arrow-right-s-line"
                                            className="mt-1.5 shrink-0 text-lg text-muted-foreground"
                                        />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    {lastPage > 1 ? (
                        <div className="mt-4 flex items-center justify-between gap-3">
                            <p className="text-xs tabular-nums text-muted-foreground">
                                {pagination.from}–{pagination.to} of {pagination.total}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage <= 1}
                                    onClick={() => visit({ page: currentPage - 1 })}
                                >
                                    Previous
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage >= lastPage}
                                    onClick={() => visit({ page: currentPage + 1 })}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </Layout.Content>
        </Layout>
    );
}

VerificationQueue.layout = (page) => <PortalLayout children={page} />;

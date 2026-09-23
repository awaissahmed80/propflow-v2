import { useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { pay } from "@/actions/App/Http/Controllers/Portal/PaymentInstallmentController";
import { show as showOrder } from "@/actions/App/Http/Controllers/Portal/OrderController";
import { index as installmentsIndex } from "@/routes/portal/payment-plans";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { isPagePending, PageSkeleton } from "../../components/page-skeleton";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { OperationsSubnav, RECEIVABLES_SUBNAV } from "../../components/operations-subnav";

function pathFrom(url) {
    const raw = String(url || "/");

    if (raw.startsWith("//") || raw.startsWith("http://") || raw.startsWith("https://")) {
        try {
            return new URL(raw.startsWith("//") ? `https:${raw}` : raw).pathname || "/";
        } catch {
            return "/";
        }
    }

    return raw.startsWith("/") ? raw : `/${raw}`;
}

function currentMonthValue() {
    const now = new Date();

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function ReceivablesInstallments({
    installments,
    pagination,
    filters = {},
}) {
    const pending = isPagePending(installments);
    const [month, setMonth] = useState(filters.month || "");
    const [from, setFrom] = useState(filters.from || "");
    const [to, setTo] = useState(filters.to || "");

    if (pending) {
        return <PageSkeleton title="Installment Engine" />;
    }

    const rows = installments ?? [];
    const pager = pagination ?? { current_page: 1, last_page: 1 };
    const mode = filters.mode || "upcoming";

    const applyFilters = (next = {}) => {
        const query = {
            month: next.month !== undefined ? next.month : month,
            from: next.from !== undefined ? next.from : from,
            to: next.to !== undefined ? next.to : to,
        };

        Object.keys(query).forEach((key) => {
            if (!query[key]) {
                delete query[key];
            }
        });

        router.get("/receivables/installments", query, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const showUpcoming = () => {
        setMonth("");
        setFrom("");
        setTo("");
        router.get(
            "/receivables/installments",
            {},
            {
                preserveState: true,
                preserveScroll: true,
            },
        );
    };

    return (
        <Layout>
            <Layout.Header
                metaTitle="Installment Engine"
                breadcrumbs={[
                    { label: "Sales" },
                    { label: "Receivables" },
                    { label: "Installment Engine" },
                ]}
            />
            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Installment Engine
                        </h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            Upcoming by default. Filter by month or date range for history.
                        </p>
                    </div>
                </Layout.Toolbar>
                <OperationsSubnav items={RECEIVABLES_SUBNAV} />
                <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
                    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border/80 p-3">
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant={mode === "upcoming" ? "default" : "outline"}
                                onClick={showUpcoming}
                            >
                                Upcoming
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={mode === "history" ? "default" : "outline"}
                                onClick={() => {
                                    const value = month || currentMonthValue();
                                    setMonth(value);
                                    applyFilters({ month: value, from: "", to: "" });
                                }}
                            >
                                History
                            </Button>
                        </div>
                        <Input
                            label="Month"
                            type="month"
                            value={month}
                            onChange={(event) => setMonth(event.target.value)}
                            className="w-40"
                        />
                        <DatePicker
                            label="From"
                            value={from}
                            onChange={(value) => setFrom(value || "")}
                        />
                        <DatePicker
                            label="To"
                            value={to}
                            onChange={(value) => setTo(value || "")}
                        />
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => applyFilters()}
                        >
                            Apply
                        </Button>
                        {mode === "history" ? (
                            <Button type="button" size="sm" variant="ghost" onClick={showUpcoming}>
                                Clear
                            </Button>
                        ) : null}
                    </div>

                    {rows.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-16 text-center text-sm text-muted-foreground">
                            {mode === "upcoming"
                                ? "No upcoming installments."
                                : "No installments in this range."}
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-border/80 bg-background">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-border/70 bg-muted/30 text-xs font-medium text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-2.5 font-medium">Due</th>
                                        <th className="px-4 py-2.5 font-medium">Buyer</th>
                                        <th className="px-4 py-2.5 font-medium">Item</th>
                                        <th className="px-4 py-2.5 font-medium">Amount</th>
                                        <th className="px-4 py-2.5 font-medium">Status</th>
                                        <th className="px-4 py-2.5" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr
                                            key={row.id}
                                            className="border-b border-border/60 last:border-b-0"
                                        >
                                            <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                                {row.due_on}
                                            </td>
                                            <td className="px-4 py-3">{row.buyer || "—"}</td>
                                            <td className="px-4 py-3">
                                                <button
                                                    type="button"
                                                    className="text-left hover:underline"
                                                    onClick={() =>
                                                        row.order &&
                                                        router.visit(
                                                            pathFrom(showOrder.url(row.order.code)),
                                                        )
                                                    }
                                                >
                                                    {row.label}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">{formatMoney(row.amount)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span
                                                        className={cn(
                                                            "font-medium",
                                                            row.status === "paid"
                                                                ? "text-emerald-700 dark:text-emerald-400"
                                                                : "text-muted-foreground",
                                                        )}
                                                    >
                                                        {row.status === "paid" ? "Paid" : "Pending"}
                                                    </span>
                                                    {row.overdue ? (
                                                        <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                                                            Overdue
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {row.status === "pending" &&
                                                row.order?.status !== "cancelled" ? (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            router.post(
                                                                pathFrom(
                                                                    pay.url({
                                                                        order: row.order.code,
                                                                        sequence: row.sequence,
                                                                    }),
                                                                ),
                                                                {},
                                                                {
                                                                    preserveScroll: true,
                                                                    onSuccess: () =>
                                                                        toast.success(
                                                                            "Payment recorded",
                                                                        ),
                                                                    onError: (errors) =>
                                                                        toast.error(
                                                                            Object.values(
                                                                                errors,
                                                                            )[0] ||
                                                                                "Unable to record payment",
                                                                        ),
                                                                },
                                                            )
                                                        }
                                                    >
                                                        Mark paid
                                                    </Button>
                                                ) : null}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {pager.last_page > 1 ? (
                        <div className="mt-4 flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={pager.current_page <= 1}
                                onClick={() =>
                                    router.get(
                                        pathFrom(
                                            installmentsIndex.url({
                                                query: {
                                                    page: pager.current_page - 1,
                                                    ...(filters.month
                                                        ? { month: filters.month }
                                                        : {}),
                                                    ...(filters.from ? { from: filters.from } : {}),
                                                    ...(filters.to ? { to: filters.to } : {}),
                                                },
                                            }),
                                        ),
                                    )
                                }
                            >
                                Previous
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={pager.current_page >= pager.last_page}
                                onClick={() =>
                                    router.get(
                                        pathFrom(
                                            installmentsIndex.url({
                                                query: {
                                                    page: pager.current_page + 1,
                                                    ...(filters.month
                                                        ? { month: filters.month }
                                                        : {}),
                                                    ...(filters.from ? { from: filters.from } : {}),
                                                    ...(filters.to ? { to: filters.to } : {}),
                                                },
                                            }),
                                        ),
                                    )
                                }
                            >
                                Next
                            </Button>
                        </div>
                    ) : null}
                </div>
            </Layout.Content>
        </Layout>
    );
}

ReceivablesInstallments.layout = (page) => <PortalLayout children={page} />;

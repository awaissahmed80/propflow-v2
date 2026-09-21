import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { pay } from "@/actions/App/Http/Controllers/Portal/PaymentInstallmentController";
import { show as showOrder } from "@/actions/App/Http/Controllers/Portal/OrderController";
import { index as plansIndex } from "@/routes/portal/payment-plans";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { isPagePending, PageSkeleton } from "../../components/page-skeleton";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";

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

export default function PaymentPlansIndex({ installments, pagination }) {
    const pending = isPagePending(installments);

    if (pending) {
        return <PageSkeleton title="Payment Plans" />;
    }

    const rows = installments ?? [];
    const pager = pagination ?? { current_page: 1, last_page: 1 };

    return (
        <Layout>
            <Layout.Header metaTitle="Payment Plans" breadcrumbs={[{ label: "Payment Plans" }]} />
            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar>
                    <h1 className="text-xl font-bold tracking-tight text-foreground">Payment Plans</h1>
                </Layout.Toolbar>
                <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
                    {rows.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-16 text-center text-sm text-muted-foreground">
                            No installments yet.
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
                                        <tr key={row.id} className="border-b border-border/60 last:border-b-0">
                                            <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{row.due_on}</td>
                                            <td className="px-4 py-3">{row.buyer || "—"}</td>
                                            <td className="px-4 py-3">
                                                <button
                                                    type="button"
                                                    className="text-left hover:underline"
                                                    onClick={() => row.order && router.visit(pathFrom(showOrder.url(row.order.code)))}
                                                >
                                                    {row.label}
                                                    {row.order?.code ? (
                                                        <span className="ml-2 font-mono text-xs text-muted-foreground">{row.order.code}</span>
                                                    ) : null}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">{formatMoney(row.amount)}</td>
                                            <td className="px-4 py-3">
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
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {row.status === "pending" && row.order?.status !== "cancelled" ? (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            router.post(pathFrom(pay.url({ order: row.order.code, sequence: row.sequence })), {}, {
                                                                preserveScroll: true,
                                                                onSuccess: () => toast.success("Payment recorded"),
                                                                onError: (errors) =>
                                                                    toast.error(Object.values(errors)[0] || "Unable to record payment"),
                                                            })
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
                                    router.get(pathFrom(plansIndex.url({ query: { page: pager.current_page - 1 } })))
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
                                    router.get(pathFrom(plansIndex.url({ query: { page: pager.current_page + 1 } })))
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

PaymentPlansIndex.layout = (page) => <PortalLayout children={page} />;

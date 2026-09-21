import { router } from "@inertiajs/react";
import { show } from "@/actions/App/Http/Controllers/Portal/OrderController";
import { index as ordersIndex } from "@/routes/portal/orders";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { isPagePending, PageSkeleton } from "../../components/page-skeleton";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/datetime";
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

function stageLabel(order) {
    if (order?.status === "cancelled") {
        return "Cancelled";
    }

    const labels = {
        booking: "Booking & KYC",
        plan: "Payment plan",
        tracking: "Installments",
        transfer: "Balloting",
        handover: "Handover",
        delivered: "Delivered",
    };

    return labels[order?.stage] || "Booking & KYC";
}

export default function OrdersIndex({ orders, pagination }) {
    const pending = isPagePending(orders);

    if (pending) {
        return <PageSkeleton title="Orders" />;
    }

    const rows = orders ?? [];
    const pager = pagination ?? { current_page: 1, last_page: 1, total: 0 };

    return (
        <Layout>
            <Layout.Header metaTitle="Orders" breadcrumbs={[{ label: "Orders" }]} />
            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar>
                    <h1 className="text-xl font-bold tracking-tight text-foreground">Orders</h1>
                </Layout.Toolbar>
                <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
                    {rows.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-16 text-center text-sm text-muted-foreground">
                            No bookings yet. Close a lead as won to create one.
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-border/80 bg-background">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-border/70 bg-muted/30 text-xs font-medium text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-2.5 font-medium">Order</th>
                                        <th className="px-4 py-2.5 font-medium">Buyer</th>
                                        <th className="px-4 py-2.5 font-medium">Unit</th>
                                        <th className="px-4 py-2.5 font-medium">Price</th>
                                        <th className="px-4 py-2.5 font-medium">Status</th>
                                        <th className="px-4 py-2.5 font-medium">Booked</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((order) => (
                                        <tr
                                            key={order.id}
                                            className="cursor-pointer border-b border-border/60 last:border-b-0 hover:bg-muted/30"
                                            onClick={() => router.visit(pathFrom(show.url(order.code)))}
                                        >
                                            <td className="px-4 py-3 font-medium text-foreground">{order.code}</td>
                                            <td className="px-4 py-3">{order.contact?.display_name || "—"}</td>
                                            <td className="px-4 py-3">{order.unit?.code || order.unit?.name || "—"}</td>
                                            <td className="px-4 py-3">{formatMoney(order.agreed_price)}</td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={cn(
                                                        "font-medium",
                                                        order.status === "allocated" && "text-emerald-700 dark:text-emerald-400",
                                                        order.status === "delivered" && "text-emerald-700 dark:text-emerald-400",
                                                        order.status === "cancelled" && "text-muted-foreground",
                                                    )}
                                                >
                                                    {stageLabel(order)}
                                                </span>
                                                {order.unpaid_count ? (
                                                    <span className="ml-2 text-xs text-muted-foreground">
                                                        {order.unpaid_count} unpaid
                                                    </span>
                                                ) : null}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">{formatDateTime(order.booked_at)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {pager.last_page > 1 ? (
                        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                            <span>
                                {pager.from}–{pager.to} of {pager.total}
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={pager.current_page <= 1}
                                    onClick={() =>
                                        router.get(pathFrom(ordersIndex.url({ query: { page: pager.current_page - 1 } })))
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
                                        router.get(pathFrom(ordersIndex.url({ query: { page: pager.current_page + 1 } })))
                                    }
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

OrdersIndex.layout = (page) => <PortalLayout children={page} />;

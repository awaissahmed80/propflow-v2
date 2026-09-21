import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { allocate, show } from "@/actions/App/Http/Controllers/Portal/OrderController";
import { index as allocationIndex } from "@/routes/portal/allocation";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { isPagePending, PageSkeleton } from "../../components/page-skeleton";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/currency";

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

export default function AllocationIndex({ orders, pagination }) {
    const pending = isPagePending(orders);

    if (pending) {
        return <PageSkeleton title="Allocation" />;
    }

    const rows = orders ?? [];
    const pager = pagination ?? { current_page: 1, last_page: 1 };

    return (
        <Layout>
            <Layout.Header metaTitle="Allocation" breadcrumbs={[{ label: "Allocation" }]} />
            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-foreground">Allocation</h1>
                        <p className="text-sm text-muted-foreground">Booked units waiting to be handed to the buyer.</p>
                    </div>
                </Layout.Toolbar>
                <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
                    {rows.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-16 text-center text-sm text-muted-foreground">
                            No bookings are waiting for allocation.
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-border/80 bg-background">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-border/70 bg-muted/30 text-xs font-medium text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-2.5 font-medium">Order</th>
                                        <th className="px-4 py-2.5 font-medium">Buyer</th>
                                        <th className="px-4 py-2.5 font-medium">Unit</th>
                                        <th className="px-4 py-2.5 font-medium">Outstanding</th>
                                        <th className="px-4 py-2.5" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((order) => (
                                        <tr key={order.id} className="border-b border-border/60 last:border-b-0">
                                            <td className="px-4 py-3">
                                                <button
                                                    type="button"
                                                    className="font-medium hover:underline"
                                                    onClick={() => router.visit(pathFrom(show.url(order.code)))}
                                                >
                                                    {order.code}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">{order.contact?.display_name || "—"}</td>
                                            <td className="px-4 py-3">{order.unit?.code || order.unit?.name || "—"}</td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {order.unpaid_count
                                                    ? `${order.unpaid_count} unpaid · ${formatMoney(order.agreed_price)}`
                                                    : "Paid"}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={() =>
                                                        router.post(pathFrom(allocate.url(order.code)), {}, {
                                                            preserveScroll: true,
                                                            onSuccess: () => toast.success("Unit allocated"),
                                                            onError: (errors) =>
                                                                toast.error(Object.values(errors)[0] || "Unable to allocate"),
                                                        })
                                                    }
                                                >
                                                    Allocate
                                                </Button>
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
                                    router.get(pathFrom(allocationIndex.url({ query: { page: pager.current_page - 1 } })))
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
                                    router.get(pathFrom(allocationIndex.url({ query: { page: pager.current_page + 1 } })))
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

AllocationIndex.layout = (page) => <PortalLayout children={page} />;

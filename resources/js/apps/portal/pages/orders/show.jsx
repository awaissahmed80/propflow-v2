import { useState } from "react";
import { usePage } from "@inertiajs/react";
import { cancel } from "@/actions/App/Http/Controllers/Portal/OrderController";
import { showBookingForm as bookingForm } from "@/actions/App/Http/Controllers/Portal/DealController";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { isPagePending, PageSkeleton } from "../../components/page-skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pathFrom, post, stepIndex, steps } from "./order-helpers";
import {
    BookingStep,
    HandoverStep,
    LedgerStep,
    PlanStep,
    TransferStep,
} from "./order-steps";

export default function OrderShow({ order, deal }) {
    const pending = isPagePending(order);
    const { errors = {} } = usePage().props;
    const [step, setStep] = useState(stepIndex(deal?.stage));

    if (pending) {
        return <PageSkeleton title="Order" />;
    }

    const current = steps[step];
    const cancelled = order.status === "cancelled";
    const closed = order.status === "completed" || deal?.stage === "closed" || order.status === "cancelled";

    const title = order.contact?.display_name || "Booking";

    return (
        <Layout>
            <Layout.Header
                metaTitle={`${title} · Booking`}
                breadcrumbs={[{ label: "Bookings", href: "/bookings" }, { label: title }]}
            />
            <Layout.Content className="min-h-0 flex-1 overflow-auto">
                <div className="mx-auto w-full max-w-4xl space-y-6 py-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {[order.project?.title, order.unit?.name].filter(Boolean).join(" · ") ||
                                    "No unit linked"}
                                {deal?.ledger?.is_late ? " · Default / late" : ""}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => window.open(pathFrom(bookingForm.url(order.code)), "_blank")}
                            >
                                Booking form
                            </Button>
                            {!cancelled && !closed ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        if (window.confirm("Cancel this booking and release the unit?")) {
                                            post(cancel.url(order.code), {}, "Booking cancelled");
                                        }
                                    }}
                                >
                                    Cancel
                                </Button>
                            ) : null}
                        </div>
                    </div>

                    <ol className="grid gap-2 sm:grid-cols-4">
                        {steps.map((item, index) => (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    onClick={() => setStep(index)}
                                    className={cn(
                                        "w-full rounded-lg border px-3 py-2 text-left text-xs font-medium",
                                        index === step
                                            ? "border-primary bg-primary/10 text-foreground"
                                            : "border-border text-muted-foreground",
                                    )}
                                >
                                    <span className="block text-[10px] uppercase tracking-wide">
                                        Stage {index + 1}
                                    </span>
                                    {item.label}
                                </button>
                            </li>
                        ))}
                    </ol>

                    {current.id === "token" ? <BookingStep order={order} deal={deal} errors={errors} /> : null}
                    {current.id === "booking_kyc" ? <PlanStep order={order} deal={deal} errors={errors} /> : null}
                    {current.id === "active" ? (
                        <>
                            <LedgerStep order={order} deal={deal} errors={errors} />
                            <TransferStep order={order} deal={deal} errors={errors} />
                        </>
                    ) : null}
                    {current.id === "closed" ? (
                        <HandoverStep
                            order={order}
                            deal={deal}
                            errors={errors}
                            delivered={order.status === "completed"}
                        />
                    ) : null}
                </div>
            </Layout.Content>
        </Layout>
    );
}

OrderShow.layout = (page) => <PortalLayout children={page} />;

import { router } from "@inertiajs/react";
import { toast } from "sonner";

const FALLBACK_PAYMENT_METHODS = ["Cash", "Pay order", "Cheque", "Bank transfer"];

export const steps = [
    { id: "token", label: "Token" },
    { id: "booking_kyc", label: "Booking & KYC" },
    { id: "active", label: "Active" },
    { id: "closed", label: "Closed" },
];

export function pathFrom(url) {
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

export function stepIndex(stage) {
    if (stage === "closed" || stage === "completed" || stage === "cancelled") {
        return steps.length - 1;
    }

    const index = steps.findIndex((step) => step.id === stage);

    return index === -1 ? 0 : index;
}

export function paymentMethodOptions(deal) {
    const fromDeal = Array.isArray(deal?.payment_methods) ? deal.payment_methods : [];

    return Array.from(new Set([...fromDeal, ...FALLBACK_PAYMENT_METHODS].filter(Boolean)));
}

export function post(url, data, success) {
    router.post(pathFrom(url), data, {
        preserveScroll: true,
        forceFormData: data instanceof FormData || data?.receipt instanceof File,
        onSuccess: () => toast.success(success),
        onError: (errors) => toast.error(Object.values(errors)[0] || "Unable to update this deal"),
    });
}

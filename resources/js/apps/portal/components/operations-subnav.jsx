import { Link, usePage } from "@inertiajs/react";
import { cn } from "@/lib/utils";

function normalizePath(value) {
    const raw = String(value || "/")
        .split("?")[0]
        .split("#")[0];

    if (raw === "" || raw === "/") {
        return "/";
    }

    if (raw.startsWith("//") || raw.startsWith("http://") || raw.startsWith("https://")) {
        try {
            const pathname = new URL(raw.startsWith("//") ? `https:${raw}` : raw).pathname;

            return pathname === "" ? "/" : pathname;
        } catch {
            return raw;
        }
    }

    return raw.startsWith("/") ? raw : `/${raw}`;
}

/**
 * Horizontal section switcher for Operations hubs (Bookings / Receivables / Commissions).
 */
export function OperationsSubnav({ items = [] }) {
    const { url } = usePage();
    const current = normalizePath(url);

    if (items.length === 0) {
        return null;
    }

    return (
        <div className="border-b border-border/80 bg-background px-6">
            <nav className="flex gap-1 overflow-x-auto py-2">
                {items.map((item) => {
                    const target = normalizePath(item.to);
                    const isActive = typeof item.activeWhen === "function"
                        ? Boolean(item.activeWhen(current))
                        : item.end
                          ? current === target
                          : current === target || current.startsWith(`${target}/`);

                    return (
                        <Link
                            key={item.to}
                            href={item.to}
                            preserveScroll
                            className={cn(
                                "inline-flex shrink-0 items-center rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                                isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                            )}
                        >
                            {item.label}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}

export const RECEIVABLES_SUBNAV = [
    { label: "Installment Engine", to: "/receivables/installments", end: true },
    { label: "Payment Vouchers", to: "/receivables/vouchers", end: true },
    { label: "Verification Queue", to: "/receivables/verification", end: true },
    { label: "Statements of Account", to: "/receivables/statements", end: true },
];

export const COMMISSIONS_SUBNAV = [
    { label: "Agent Commissions", to: "/commissions/agents", end: true },
    { label: "Dealer / Broker Network", to: "/commissions/dealers", end: true },
];

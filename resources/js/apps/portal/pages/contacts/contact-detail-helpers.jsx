import { Icon } from "@/components/ui/icon";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const TABS = [
    { id: "details", label: "Details" },
    { id: "activity", label: "Activity" },
    { id: "tasks", label: "Tasks" },
    { id: "notes", label: "Notes" },
];

export function titleCaseLabel(value) {
    return String(value || "")
        .toLowerCase()
        .split(" ")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

export function phoneDigits(phone) {
    return String(phone || "").replace(/\D+/g, "");
}

export function whatsappUrl(phone) {
    const digits = phoneDigits(phone);

    return digits ? `https://wa.me/${digits}` : null;
}

export function telUrl(phone) {
    const digits = phoneDigits(phone);

    return digits ? `tel:+${digits}` : null;
}

export function mailtoUrl(email) {
    return email ? `mailto:${email}` : null;
}

export function joinName(contact) {
    return [contact?.first_name, contact?.last_name].filter(Boolean).join(" ");
}

export function splitName(fullName) {
    const parts = String(fullName || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 0) {
        return { first_name: null, last_name: null };
    }

    if (parts.length === 1) {
        return { first_name: parts[0], last_name: null };
    }

    return {
        first_name: parts[0],
        last_name: parts.slice(1).join(" "),
    };
}

export function ActionIcon({ href, icon, label, disabled = false }) {
    const className = cn(
        "inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors",
        disabled
            ? "pointer-events-none opacity-40"
            : "hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
    );

    const control =
        href && !disabled ? (
            <a
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noreferrer" : undefined}
                className={className}
                aria-label={label}
            >
                <Icon name={icon} className="text-lg" />
            </a>
        ) : (
            <button type="button" className={className} aria-label={label} disabled>
                <Icon name={icon} className="text-lg" />
            </button>
        );

    return (
        <Tooltip>
            <TooltipTrigger render={control} />
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

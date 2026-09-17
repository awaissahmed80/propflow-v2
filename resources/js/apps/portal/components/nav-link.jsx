import { Link, usePage } from "@inertiajs/react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

function hrefToString(href) {
    if (href == null) {
        return "/";
    }

    if (typeof href === "object") {
        return href.url || href.href || "/";
    }

    return String(href);
}

function normalizePath(value) {
    const raw = hrefToString(value).split("?")[0].split("#")[0];

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

function isHomePath(path) {
    return path === "/" || path === "/dashboard";
}

export const NavLink = ({ href, children, end = false, className, ...rest }) => {
    const { url } = usePage();
    const current = normalizePath(url);
    const target = normalizePath(href);

    const isActive = end
        ? isHomePath(target)
            ? isHomePath(current)
            : current === target
        : current === target || (target !== "/" && current.startsWith(`${target}/`));

    return (
        <Link
            href={href}
            prefetch={false}
            preserveState={false}
            preserveScroll={false}
            {...rest}
            className={cn(
                className,
                isActive ? "bg-card text-primary" : "text-muted-foreground",
            )}
        >
            <span className="flex flex-1 flex-row items-center space-x-3">
                {children}
            </span>
            {isActive ? (
                <Icon name="arrow-right-s-line" className="text-primary" />
            ) : null}
        </Link>
    );
};

import { Link } from "@inertiajs/react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { HeatIcon } from "@/components/ui/heat-icon";
import { Icon } from "@/components/ui/icon";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { StageBadge } from "@/components/ui/stage-badge";
import { cn } from "@/lib/utils";

/**
 * Shared shell for Lead / User / Contact popover cards.
 */
export function EntityCard({
    title,
    subtitle,
    meta,
    avatarName,
    avatarSrc,
    icon,
    label,
    empty = false,
    emptyLabel = "Not set",
    size = "default",
    href,
    hrefLabel = "Open",
    children,
    className,
}) {
    const body = (
        <>
            {avatarName || avatarSrc ? (
                <Avatar
                    name={avatarName || "?"}
                    src={avatarSrc || undefined}
                    size="sm"
                    className="size-8"
                />
            ) : (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon name={icon || "user-line"} className="text-base" />
                </span>
            )}
            <span className="min-w-0 flex-1">
                {label ? (
                    <span className="mb-0.5 block text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                        {label}
                    </span>
                ) : null}
                <span className="block truncate text-sm font-medium text-foreground">
                    {empty ? emptyLabel : title}
                </span>
                {!empty && subtitle ? (
                    <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
                ) : null}
            </span>
            {meta ? <span className="shrink-0">{meta}</span> : null}
        </>
    );

    const triggerClass = cn(
        "flex w-full items-center gap-2.5 rounded-lg border border-border/80 bg-card px-3 text-left shadow-xs transition-colors",
        "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        size === "sm" ? "py-2" : "py-2.5",
        empty && "border-dashed text-muted-foreground",
        className,
    );

    if (empty) {
        return (
            <div className={triggerClass} aria-disabled="true">
                {body}
            </div>
        );
    }

    return (
        <Popover>
            <PopoverTrigger className={triggerClass}>{body}</PopoverTrigger>
            <PopoverContent align="start" className="w-72 gap-0 p-0">
                <div className="flex items-start gap-3 border-b border-border/70 px-3 py-3">
                    {avatarName || avatarSrc ? (
                        <Avatar
                            name={avatarName || "?"}
                            src={avatarSrc || undefined}
                            size="default"
                            className="size-10"
                        />
                    ) : (
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <Icon name={icon || "user-line"} className="text-lg" />
                        </span>
                    )}
                    <div className="min-w-0 flex-1">
                        {label ? (
                            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                                {label}
                            </p>
                        ) : null}
                        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                        {subtitle ? (
                            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                        ) : null}
                    </div>
                </div>
                <div className="space-y-2 px-3 py-3 text-sm">{children}</div>
                {href ? (
                    <div className="border-t border-border/70 px-3 py-2">
                        <Link
                            href={href}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                            {hrefLabel}
                            <Icon name="arrow-right-up-line" />
                        </Link>
                    </div>
                ) : null}
            </PopoverContent>
        </Popover>
    );
}

function DetailRow({ label, value }) {
    if (value == null || value === "") {
        return null;
    }

    return (
        <div className="flex items-start justify-between gap-3">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="max-w-[60%] text-right text-xs font-medium break-words text-foreground">
                {value}
            </span>
        </div>
    );
}

export function LeadCard({ lead, href, size = "default", className }) {
    if (!lead) {
        return (
            <EntityCard
                empty
                emptyLabel="No lead"
                label="Lead"
                icon="customer-service-line"
                size={size}
                className={className}
            />
        );
    }

    const title = lead.contact?.display_name || "Lead";
    const stageTitle = lead.stage?.title || lead.stage?.label;

    return (
        <EntityCard
            label="Lead"
            title={title}
            subtitle={lead.project?.title || stageTitle || undefined}
            avatarName={title}
            icon="customer-service-line"
            size={size}
            href={href}
            hrefLabel="Open lead"
            className={className}
            meta={lead.tag ? <HeatIcon tag={lead.tag} /> : null}
        >
            {lead.stage ? (
                <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">Stage</span>
                    <StageBadge stage={lead.stage} />
                </div>
            ) : null}
            <DetailRow label="Source" value={lead.source} />
            <DetailRow label="Project" value={lead.project?.title} />
        </EntityCard>
    );
}

export function ContactCard({ contact, href, size = "default", className }) {
    if (!contact) {
        return (
            <EntityCard
                empty
                emptyLabel="No contact"
                label="Contact"
                icon="folder-user-line"
                size={size}
                className={className}
            />
        );
    }

    const name = contact.display_name || "Contact";

    return (
        <EntityCard
            label="Contact"
            title={name}
            subtitle={contact.phone_number || contact.email_address || undefined}
            avatarName={name}
            avatarSrc={contact.avatar}
            icon="folder-user-line"
            size={size}
            href={href}
            className={className}
            meta={
                contact.type ? (
                    <Badge variant="outline" className="rounded-sm text-[10px] font-normal capitalize">
                        {String(contact.type).toLowerCase()}
                    </Badge>
                ) : null
            }
        >
            <DetailRow label="Phone" value={contact.phone_number} />
            <DetailRow label="Email" value={contact.email_address} />
            <DetailRow label="Type" value={contact.type} />
        </EntityCard>
    );
}

export function UserCard({ user, label = "User", href, size = "default", className }) {
    if (!user) {
        return (
            <EntityCard
                empty
                emptyLabel="Unassigned"
                label={label}
                icon="user-line"
                size={size}
                className={className}
            />
        );
    }

    const name = user.display_name || "User";

    return (
        <EntityCard
            label={label}
            title={name}
            subtitle={user.title || user.email_address || undefined}
            avatarName={name}
            avatarSrc={user.avatar}
            icon="user-line"
            size={size}
            href={href}
            className={className}
        >
            <DetailRow label="Name" value={name} />
            <DetailRow label="Email" value={user.email_address} />
            <DetailRow label="Title" value={user.title} />
        </EntityCard>
    );
}

import { Avatar, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import { UserCardPopover } from "./user-card";

const SHARED_PREVIEW_LIMIT = 3;

/**
 * @param {string | null | undefined} value
 */
function titleCaseLabel(value) {
    const raw = String(value || "").trim();

    if (!raw) {
        return null;
    }

    return raw
        .toLowerCase()
        .split(/[_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

/**
 * @param {number | null | undefined} value
 */
function clampPercent(value) {
    return Math.min(100, Math.max(0, Number(value) || 0));
}

/**
 * @param {{
 *   label: string,
 *   value: number | null | undefined,
 *   barClassName: string,
 * }} props
 */
export function LeadMetricBar({ label, value, barClassName }) {
    const progress = clampPercent(value);

    return (
        <div className="space-y-1.5">
            {label ? (
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>{label}</span>
                    <span className="tabular-nums">{progress}%</span>
                </div>
            ) : (
                <div className="text-sm tabular-nums text-foreground">{progress}%</div>
            )}
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                    className={cn("h-full rounded-full transition-[width]", barClassName)}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
}

/**
 * Presentational lead card for kanban and other portal surfaces.
 *
 * @param {{
 *   lead: object,
 *   selected?: boolean,
 *   compact?: boolean,
 *   onClick?: (lead: object) => void,
 *   className?: string,
 *   doNothingTitle?: string,
 *   interactive?: boolean,
 * }} props
 */
export function LeadCard({
    lead,
    selected = false,
    compact = false,
    onClick,
    className,
    doNothingTitle = "Do Nothing",
    interactive = true,
}) {
    const { formatMoney } = useCurrency();
    const name = lead?.contact?.display_name || "Untitled lead";
    const contactType = titleCaseLabel(lead?.contact?.type);
    const contactTag = titleCaseLabel(lead?.contact?.tag);
    const category =
        contactType && contactTag
            ? `${contactType} / ${contactTag}`
            : contactType || contactTag || null;
    const source = String(lead?.source || "").trim() || null;
    const nextAction =
        lead?.next_action && lead.next_action !== doNothingTitle
            ? lead.next_action
            : null;
    const sharedUsers = lead?.shared_users || [];
    const sharedPreview = sharedUsers.slice(0, SHARED_PREVIEW_LIMIT);
    const sharedExtra = Math.max(sharedUsers.length - sharedPreview.length, 0);

    const content = (
        <div className={cn("flex flex-col", compact ? "gap-3.5" : "gap-4")}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                    <h3
                        className={cn(
                            "truncate font-bold tracking-tight text-foreground",
                            compact ? "text-sm" : "text-base"
                        )}
                    >
                        {name}
                    </h3>
                    {category ? (
                        <p className="truncate text-xs text-muted-foreground">{category}</p>
                    ) : null}
                    {source ? (
                        <p className="truncate text-xs text-muted-foreground">{source}</p>
                    ) : null}
                </div>
                <div className="max-w-[42%] shrink-0 space-y-1 text-right">
                    {nextAction ? (
                        <p className="truncate text-xs text-muted-foreground">{nextAction}</p>
                    ) : (
                        <p className="text-xs text-muted-foreground/70">—</p>
                    )}
                    <p
                        className={cn(
                            "font-semibold tabular-nums text-foreground",
                            compact ? "text-sm" : "text-sm"
                        )}
                    >
                        {formatMoney(lead?.budget, {
                            compact: true,
                            maximumFractionDigits: 2,
                        })}
                    </p>
                </div>
            </div>

            <div className={cn(compact ? "space-y-2.5" : "space-y-3")}>
                <LeadMetricBar
                    label="Lead Score"
                    value={lead?.score}
                    barClassName="bg-emerald-500"
                />
                <LeadMetricBar
                    label="Engagement"
                    value={lead?.engagement}
                    barClassName="bg-blue-600 dark:bg-blue-500"
                />
            </div>

            <div className="flex items-center justify-between gap-3">
                {lead?.assignee ? (
                    <UserCardPopover
                        user={lead.assignee}
                        className="rounded-full hover:bg-transparent data-popup-open:bg-transparent"
                    >
                        <Avatar
                            name={lead.assignee.display_name}
                            src={lead.assignee.avatar || undefined}
                            size="sm"
                            className="size-7 shrink-0"
                            textClass="text-[9px]"
                        />
                    </UserCardPopover>
                ) : (
                    <Tooltip content="Unassigned">
                        <span
                            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                            aria-label="Unassigned"
                        >
                            <Icon name="user-line" className="text-xs" />
                        </span>
                    </Tooltip>
                )}

                {sharedUsers.length > 0 ? (
                    <div className="flex items-center gap-1.5">
                        <Tooltip
                            content={`Shared with ${sharedUsers
                                .map((user) => user.display_name)
                                .filter(Boolean)
                                .join(", ")}`}
                        >
                            <span
                                className="flex size-6 shrink-0 items-center justify-center text-muted-foreground"
                                aria-label="Shared with"
                            >
                                <Icon name="share-line" className="text-sm" />
                            </span>
                        </Tooltip>
                        <AvatarGroup className="justify-end">
                            {sharedPreview.map((user) => (
                                <UserCardPopover
                                    key={user.id}
                                    user={user}
                                    className="rounded-full hover:bg-transparent data-popup-open:bg-transparent"
                                >
                                    <Avatar
                                        name={user.display_name}
                                        src={user.avatar || undefined}
                                        size="sm"
                                        className="size-7 shrink-0"
                                        textClass="text-[9px]"
                                    />
                                </UserCardPopover>
                            ))}
                            {sharedExtra > 0 ? (
                                <AvatarGroupCount className="size-7 text-[10px]">
                                    +{sharedExtra}
                                </AvatarGroupCount>
                            ) : null}
                        </AvatarGroup>
                    </div>
                ) : (
                    <Tooltip content="Not shared">
                        <span
                            className="flex size-7 shrink-0 items-center justify-center text-muted-foreground/55"
                            aria-label="Not shared"
                        >
                            <Icon name="share-line" className="text-sm" />
                        </span>
                    </Tooltip>
                )}
            </div>
        </div>
    );

    if (!interactive) {
        return (
            <div
                className={cn(
                    "rounded-lg border border-border bg-card p-3.5 shadow-xs",
                    selected && "border-primary/40 ring-2 ring-primary/15",
                    className
                )}
            >
                {content}
            </div>
        );
    }

    return (
        <article
            role="button"
            tabIndex={0}
            onClick={() => onClick?.(lead)}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onClick?.(lead);
                }
            }}
            className={cn(
                "rounded-lg border border-border bg-card p-3.5 shadow-xs transition-[box-shadow,border-color]",
                "hover:border-border/80 hover:shadow-sm",
                selected && "border-primary/40 ring-2 ring-primary/15",
                className
            )}
        >
            {content}
        </article>
    );
}

export default LeadCard;

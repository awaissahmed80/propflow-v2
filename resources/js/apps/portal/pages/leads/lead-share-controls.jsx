import { useEffect, useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { syncShares } from "@/actions/App/Http/Controllers/Portal/LeadController";
import { Avatar, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { CheckboxControl } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { UserCardPopover } from "../../components/user-card";

const PREVIEW_LIMIT = 5;

/**
 * @param {object} props
 * @param {object} props.lead
 * @param {Array<{id: number, display_name: string, avatar?: string|null, title?: string|null}>} props.assignees
 * @param {boolean} [props.disabled]
 */
export function LeadShareButton({ lead, assignees = [], disabled = false }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [saving, setSaving] = useState(false);
    const [selectedIds, setSelectedIds] = useState(() =>
        (lead?.shared_users || []).map((user) => Number(user.id))
    );

    const sharedUsersKey = (lead?.shared_users || [])
        .map((user) => user.id)
        .join(",");

    useEffect(() => {
        setSelectedIds((lead?.shared_users || []).map((user) => Number(user.id)));
    }, [lead?.id, sharedUsersKey]);

    useEffect(() => {
        if (!open) {
            setQuery("");
        }
    }, [open]);

    const excludedIds = useMemo(() => {
        const ids = new Set();

        if (lead?.user_id != null) {
            ids.add(Number(lead.user_id));
        }

        if (lead?.assigned_to != null) {
            ids.add(Number(lead.assigned_to));
        }

        return ids;
    }, [lead?.user_id, lead?.assigned_to]);

    const candidates = useMemo(() => {
        const needle = query.trim().toLowerCase();

        return assignees
            .filter((user) => !excludedIds.has(Number(user.id)))
            .filter((user) => {
                if (!needle) {
                    return true;
                }

                const haystack = `${user.display_name || ""} ${user.title || ""}`.toLowerCase();

                return haystack.includes(needle);
            });
    }, [assignees, excludedIds, query]);

    const persist = (nextIds) => {
        const previous = selectedIds;
        setSelectedIds(nextIds);
        setSaving(true);

        router.put(
            syncShares.url(lead.code),
            { user_ids: nextIds },
            {
                preserveScroll: true,
                onSuccess: () => toast.success("Sharing updated"),
                onError: () => {
                    setSelectedIds(previous);
                    toast.error("Could not update sharing");
                },
                onFinish: () => setSaving(false),
            }
        );
    };

    const toggleUser = (userId) => {
        if (disabled || saving) {
            return;
        }

        const id = Number(userId);
        const next = selectedIds.includes(id)
            ? selectedIds.filter((value) => value !== id)
            : [...selectedIds, id];

        persist(next);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <Tooltip>
                <TooltipTrigger
                    render={
                        <PopoverTrigger
                            disabled={disabled}
                            aria-label="Share lead"
                            className={cn(
                                "inline-flex size-8 items-center justify-center rounded-full transition-colors",
                                "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                                "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-muted disabled:hover:text-muted-foreground",
                                "data-popup-open:bg-primary/15 data-popup-open:text-primary"
                            )}
                        >
                            <Icon name="share-line" className="text-lg" />
                        </PopoverTrigger>
                    }
                />
                <TooltipContent>Share</TooltipContent>
            </Tooltip>
            <PopoverContent align="end" className="w-72 gap-0 p-0">
                <div className="border-b border-border px-3 py-2.5">
                    <div className="text-sm font-medium text-foreground">Share with</div>
                    <div className="mt-2">
                        <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search people…"
                            className="h-8"
                            autoFocus
                        />
                    </div>
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                    {candidates.length === 0 ? (
                        <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                            {assignees.length === 0
                                ? "No workspace members available"
                                : "No matching people"}
                        </div>
                    ) : (
                        candidates.map((user) => {
                            const checked = selectedIds.includes(Number(user.id));

                            return (
                                <button
                                    key={user.id}
                                    type="button"
                                    disabled={disabled || saving}
                                    onClick={() => toggleUser(user.id)}
                                    className={cn(
                                        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                                        "hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
                                    )}
                                >
                                    <CheckboxControl
                                        checked={checked}
                                        disabled={disabled || saving}
                                        tabIndex={-1}
                                        className="pointer-events-none"
                                    />
                                    <Avatar
                                        name={user.display_name}
                                        src={user.avatar || undefined}
                                        size="sm"
                                        className="size-6 shrink-0"
                                        textClass="text-[8px]"
                                    />
                                    <span className="min-w-0 flex-1 truncate text-foreground">
                                        {user.display_name}
                                    </span>
                                </button>
                            );
                        })
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

/**
 * @param {object} props
 * @param {object} props.lead
 */
export function LeadSharedUsers({ lead }) {
    const sharedUsers = lead?.shared_users || [];

    if (sharedUsers.length === 0) {
        return null;
    }

    const preview = sharedUsers.slice(0, PREVIEW_LIMIT);
    const extraCount = Math.max(sharedUsers.length - preview.length, 0);

    return (
        <div className="w-auto shrink-0 space-y-0.5">
            <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Shared with
            </div>
            <AvatarGroup className="items-center">
                {preview.map((user) => (
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
                {extraCount > 0 ? (
                    <AvatarGroupCount className="size-7 text-xs">
                        +{extraCount}
                    </AvatarGroupCount>
                ) : null}
            </AvatarGroup>
        </div>
    );
}

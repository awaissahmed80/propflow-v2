import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function MemberAvatar({ member, size = "default", className }) {
    return (
        <Avatar
            name={member?.display_name || ""}
            src={member?.avatar || undefined}
            size={size}
            className={className}
        />
    );
}

export function TeamCard({ team, onOpen, onEdit, onDelete }) {
    const color = team.color || "#3847d0";
    const previewMembers = (team.members ?? []).slice(0, 5);
    const extraCount = Math.max((team.member_count ?? 0) - previewMembers.length, 0);

    return (
        <article
            className={cn(
                "group relative flex flex-col overflow-hidden rounded-md border border-border bg-card",
                "transition-[transform,box-shadow,border-color] duration-200",
                "hover:-translate-y-0.5 hover:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.14)]",
                "dark:hover:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.5)]"
            )}
        >
            <button
                type="button"
                className="absolute inset-0 z-0"
                aria-label={`Open ${team.title}`}
                onClick={() => onOpen(team)}
            />

            <div className="h-1.5 w-full" style={{ backgroundColor: color }} />

            <div className="relative z-10 flex flex-1 flex-col gap-4 p-5 pointer-events-none">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
                                {team.title}
                            </h2>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {team.description || "No description yet."}
                        </p>
                    </div>

                    <DropdownMenu>
                        <Tooltip content="More actions">
                            <DropdownMenuTrigger
                                className={cn(
                                    "pointer-events-auto inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground",
                                    "opacity-0 transition-opacity hover:bg-muted hover:text-foreground",
                                    "group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
                                )}
                                aria-label={`Actions for ${team.title}`}
                                onClick={(event) => event.stopPropagation()}
                            >
                                <Icon name="more-2-fill" className="text-lg" />
                            </DropdownMenuTrigger>
                        </Tooltip>
                        <DropdownMenuContent align="end" className="min-w-40">
                            <DropdownMenuItem className="gap-2" onClick={() => onOpen(team)}>
                                <Icon name="eye-line" className="text-base" />
                                View team
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2" onClick={() => onEdit(team)}>
                                <Icon name="pencil-line" className="text-base" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                variant="destructive"
                                className="gap-2"
                                onClick={() => onDelete(team)}
                            >
                                <Icon name="delete-bin-line" className="text-base" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2.5">
                    {team.leader ? (
                        <div className="flex items-center gap-3">
                            <MemberAvatar member={team.leader} />
                            <div className="min-w-0">
                                <div className="text-sm font-bold tracking-tight text-muted-foreground">
                                    Team Lead
                                </div>
                                <div className="truncate text-sm font-medium text-foreground">
                                    {team.leader.display_name}
                                </div>
                                <div className="truncate text-xs text-muted-foreground">
                                    {team.leader.title || "—"}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Icon name="user-star-line" className="text-base" />
                            No team lead assigned
                        </div>
                    )}
                </div>

                <div className="mt-auto flex items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2">
                        {previewMembers.length > 0 ? (
                            <AvatarGroup className="justify-start">
                                {previewMembers.map((member) => (
                                    <MemberAvatar key={member.id} member={member} size="sm" />
                                ))}
                            </AvatarGroup>
                        ) : (
                            <span className="text-sm text-muted-foreground">No members yet</span>
                        )}
                        {extraCount > 0 ? (
                            <span className="text-xs text-muted-foreground">+{extraCount}</span>
                        ) : null}
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                        {team.member_count ?? 0} {(team.member_count ?? 0) === 1 ? "member" : "members"}
                    </span>
                </div>
            </div>
        </article>
    );
}

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { MemberAvatar } from "./team-card";

export function TeamDetailSheet({ team, open, onOpenChange, onEdit, onDelete }) {
    if (!team) {
        return null;
    }

    const color = team.color || "#3847d0";

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-full border-0 bg-transparent p-2 sm:max-w-md lg:min-w-[420px]"
            >
                <div className="flex h-full flex-col overflow-hidden rounded-md bg-card">
                    <div className="h-1.5 w-full shrink-0" style={{ backgroundColor: color }} />
                    <SheetHeader className="border-b">
                        <div className="flex items-start justify-between gap-3 pr-8">
                            <div className="min-w-0">
                                <SheetTitle className="truncate">{team.title}</SheetTitle>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                                <IconButton
                                    type="button"
                                    size="sm"
                                    className="rounded-md"
                                    icon="pencil-line"
                                    aria-label="Edit team"
                                    onClick={() => onEdit(team)}
                                />
                                <IconButton
                                    type="button"
                                    size="sm"
                                    className="rounded-md text-destructive hover:text-destructive"
                                    icon="delete-bin-line"
                                    aria-label="Delete team"
                                    onClick={() => onDelete(team)}
                                />
                            </div>
                        </div>
                    </SheetHeader>

                    <ScrollArea className="flex-1">
                        <div className="space-y-6 px-5 py-5">
                            <section className="space-y-2">
                                <h3 className="text-sm font-medium text-muted-foreground">About</h3>
                                <p className="text-sm leading-relaxed text-foreground">
                                    {team.description || "No description provided for this team."}
                                </p>
                            </section>

                            <section className="space-y-3">
                                <h3 className="text-sm font-medium text-muted-foreground">Team Lead</h3>
                                {team.leader ? (
                                    <div className="flex items-center gap-3 rounded-md border border-border px-3 py-3">
                                        <MemberAvatar member={team.leader} />
                                        <div className="min-w-0">
                                            <div className="truncate font-medium">{team.leader.display_name}</div>
                                            <div className="truncate text-sm text-muted-foreground">
                                                {team.leader.title || "—"}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                                        Assign a lead to clarify ownership and routing.
                                    </div>
                                )}
                            </section>

                            <section className="space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="text-sm font-medium text-muted-foreground">Members</h3>
                                    <span className="text-xs text-muted-foreground">
                                        {team.member_count ?? 0}
                                    </span>
                                </div>

                                {(team.members ?? []).length === 0 ? (
                                    <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                                        No members on this team yet.
                                    </div>
                                ) : (
                                    <ul className="space-y-2">
                                        {(team.members ?? []).map((member) => (
                                            <li
                                                key={member.id}
                                                className="flex items-center gap-3 rounded-md border border-border/80 px-3 py-2.5"
                                            >
                                                <MemberAvatar member={member} />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="truncate text-sm font-medium">
                                                            {member.display_name}
                                                        </span>
                                                        {member.is_lead ? (
                                                            <Badge variant="secondary" className="rounded-sm">
                                                                Lead
                                                            </Badge>
                                                        ) : null}
                                                    </div>
                                                    <div className="truncate text-xs text-muted-foreground">
                                                        {member.title || member.email_address || "—"}
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        </div>
                    </ScrollArea>
                </div>
            </SheetContent>
        </Sheet>
    );
}

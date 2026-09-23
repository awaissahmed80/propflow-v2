import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InfoField, StatCard, UserAvatar } from "../../components/user-card";

export function UserDetailPanel({ user, onEdit, onClose }) {
    if (!user) {
        return null;
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
                <div className="flex min-w-0 items-center gap-4">
                    <UserAvatar user={user} className="size-16" textClass="text-lg" />
                    <div className="min-w-0">
                        <h2 className="truncate text-2xl font-bold tracking-tight text-foreground">
                            {user.display_name}
                        </h2>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                            {user.subtitle || user.title || "—"}
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <IconButton
                        type="button"
                        size="sm"
                        className="rounded-md"
                        icon="pencil-line"
                        aria-label={`Edit ${user.display_name}`}
                        onClick={() => onEdit(user)}
                    />
                    <IconButton
                        type="button"
                        size="sm"
                        className="rounded-md"
                        icon="close-line"
                        aria-label="Close details"
                        onClick={onClose}
                    />
                </div>
            </div>

            <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-8 px-6 py-6">
                    <section className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="text-base font-semibold text-foreground">Overview</h3>
                            <button
                                type="button"
                                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                            >
                                All Time
                                <Icon name="arrow-down-s-line" className="text-base" />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <StatCard label="Leads" value={user.stats?.leads ?? 0} />
                            <StatCard label="Teams" value={user.stats?.teams ?? 0} />
                            <StatCard label="Tasks Due" value={user.stats?.tasks_due ?? 0} />
                            <StatCard label="Closed Deals" value={user.stats?.closed_deals ?? 0} />
                        </div>
                    </section>

                    <section className="space-y-5">
                        <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-base font-semibold text-foreground">Employee Info</h3>
                            <Badge
                                className={cn(
                                    "rounded-full border-0 px-2.5 font-semibold uppercase",
                                    user.status === "ACTIVE"
                                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                        : "bg-muted text-muted-foreground"
                                )}
                            >
                                {user.status || "UNKNOWN"}
                            </Badge>
                        </div>

                        <div className="space-y-5">
                            <InfoField label="Email Address">
                                {user.email_address || "—"}
                            </InfoField>
                            <InfoField label="Roles">
                                {user.roles?.length ? user.roles.join(", ") : "—"}
                            </InfoField>
                            <InfoField label="Phone Number">
                                {user.phone_number || "—"}
                            </InfoField>
                            <InfoField label="Managed / Supervised By">
                                {user.manager ? (
                                    <div className="flex items-center gap-3">
                                        <UserAvatar user={user.manager} />
                                        <div className="min-w-0">
                                            <div className="truncate font-medium">
                                                {user.manager.display_name}
                                            </div>
                                            <div className="truncate text-xs font-normal text-muted-foreground">
                                                {user.manager.title || "—"}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    "—"
                                )}
                            </InfoField>
                            <InfoField label="Teams">
                                {user.teams?.length ? (
                                    <div className="space-y-4">
                                        {user.teams.map((team) => (
                                            <div key={team.id} className="space-y-2">
                                                <div>
                                                    <span className="font-medium">{team.title}</span>
                                                </div>
                                                {team.members?.length > 0 ? (
                                                    <AvatarGroup className="justify-start">
                                                        {team.members.slice(0, 6).map((member) => (
                                                            <UserAvatar
                                                                key={member.id}
                                                                user={member}
                                                                size="sm"
                                                            />
                                                        ))}
                                                    </AvatarGroup>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    "—"
                                )}
                            </InfoField>
                        </div>
                    </section>
                </div>
            </ScrollArea>
        </div>
    );
}

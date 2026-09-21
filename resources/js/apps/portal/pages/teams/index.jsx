import { useEffect, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { destroy } from "@/actions/App/Http/Controllers/Portal/TeamController";
import { index } from "@/routes/portal/teams";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { isPagePending, PageSkeleton } from "../../components/page-skeleton";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterInput } from "@/components/ui/filter-input";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import TeamForm from "./team-form";

function MemberAvatar({ member, size = "default", className }) {
    return (
        <Avatar
            name={member?.display_name || ""}
            src={member?.avatar || undefined}
            size={size}
            className={className}
        />
    );
}

function TeamCard({ team, onOpen, onEdit, onDelete }) {
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
                            {team.code ? (
                                <Badge variant="outline" className="rounded-sm font-normal text-muted-foreground">
                                    #{team.code}
                                </Badge>
                            ) : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {team.description || "No description yet."}
                        </p>
                    </div>

                    <DropdownMenu>
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

function TeamDetailSheet({ team, open, onOpenChange, onEdit, onDelete }) {
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
                                {team.code ? (
                                    <div className="mt-1 text-sm text-muted-foreground">#{team.code}</div>
                                ) : null}
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

function TeamsIndex({
    teams: teamsProp,
    filters = { q: "" },
    formOptions = { members: [] },
}) {
    const pending = isPagePending(teamsProp);
    const teams = teamsProp ?? [];
    const [search, setSearch] = useState(filters.q ?? "");
    const [teamFormOpen, setTeamFormOpen] = useState(false);
    const [editingTeam, setEditingTeam] = useState(null);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const searchTimeout = useRef(null);

    useEffect(() => {
        setSearch(filters.q ?? "");
    }, [filters.q]);

    useEffect(() => {
        return () => {
            if (searchTimeout.current) {
                clearTimeout(searchTimeout.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!selectedTeam) {
            return;
        }

        const fresh = teams.find((team) => team.id === selectedTeam.id);
        if (fresh) {
            setSelectedTeam(fresh);
        } else if (detailOpen) {
            setDetailOpen(false);
            setSelectedTeam(null);
        }
    }, [teams, selectedTeam, detailOpen]);

    const visitTeams = (q = "") => {
        router.get(
            index.url(),
            q ? { q } : {},
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["teams", "filters"],
            }
        );
    };

    const handleSearchChange = (event) => {
        const value = event.target.value;
        setSearch(value);

        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }

        searchTimeout.current = setTimeout(() => {
            visitTeams(value.trim());
        }, 300);
    };

    const openCreate = () => {
        setEditingTeam(null);
        setTeamFormOpen(true);
    };

    const openEdit = (team) => {
        setDetailOpen(false);
        setEditingTeam(team);
        setTeamFormOpen(true);
    };

    const openDetail = (team) => {
        setSelectedTeam(team);
        setDetailOpen(true);
    };

    const confirmDelete = async (team) => {
        const confirmed = await confirm(
            `Delete "${team.title}"? Members will be removed from this team. This cannot be undone.`,
            "Delete Team"
        );

        if (!confirmed) {
            return;
        }

        toast.promise(
            new Promise((resolve, reject) => {
                router.delete(destroy.url(team.code), {
                    preserveScroll: true,
                    onSuccess: () => {
                        setDetailOpen(false);
                        setSelectedTeam(null);
                        resolve();
                    },
                    onError: () => reject(new Error("Unable to delete team")),
                });
            }),
            {
                loading: "Deleting team...",
                success: "Team deleted",
                error: "Unable to delete team",
            }
        );
    };

    if (pending) {
        return <PageSkeleton title="Teams" variant="cards" />;
    }

    return (
        <Layout>
            <Layout.Header metaTitle="Teams" breadcrumbs={[{ label: "Teams" }]} />
            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar>
                    <h1 className="shrink-0 text-2xl font-bold tracking-tight text-foreground">Teams</h1>
                    <FilterInput
                        value={search}
                        onChange={handleSearchChange}
                        placeholder="Search teams or leads"
                        className="w-64"
                    />
                    <Button type="button" className="ml-auto shrink-0" onClick={openCreate}>
                        <Icon name="add-line" className="text-base" />
                        Add Team
                    </Button>
                </Layout.Toolbar>

                <ScrollArea className="flex-1">
                    <div className="px-6 py-6">
                        {teams.length === 0 ? (
                            <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-6 text-center">
                                <div className="mb-4 flex size-14 items-center justify-center rounded-md bg-primary/10 text-primary">
                                    <Icon name="user-community-line" className="text-2xl" />
                                </div>
                                <h2 className="text-lg font-semibold tracking-tight">
                                    {filters.q ? "No teams match your search" : "Build your first sales team"}
                                </h2>
                                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                                    {filters.q
                                        ? "Try another name, code, or team lead."
                                        : "Group agents under a lead so campaigns and projects can route work cleanly."}
                                </p>
                                {!filters.q ? (
                                    <Button type="button" className="mt-5" onClick={openCreate}>
                                        <Icon name="add-line" className="text-base" />
                                        Create Team
                                    </Button>
                                ) : null}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {teams.map((team) => (
                                    <TeamCard
                                        key={team.id}
                                        team={team}
                                        onOpen={openDetail}
                                        onEdit={openEdit}
                                        onDelete={confirmDelete}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </Layout.Content>

            <TeamDetailSheet
                team={selectedTeam}
                open={detailOpen}
                onOpenChange={(open) => {
                    setDetailOpen(open);
                    if (!open) {
                        setSelectedTeam(null);
                    }
                }}
                onEdit={openEdit}
                onDelete={confirmDelete}
            />

            <TeamForm
                isOpen={teamFormOpen}
                onClose={() => {
                    setTeamFormOpen(false);
                    setEditingTeam(null);
                }}
                data={editingTeam}
                formOptions={formOptions}
            />
        </Layout>
    );
}

TeamsIndex.layout = (page) => <PortalLayout children={page} />;

export default TeamsIndex;

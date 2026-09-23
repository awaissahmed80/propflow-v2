import { useEffect, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { destroy } from "@/actions/App/Http/Controllers/Portal/TeamController";
import { index } from "@/routes/portal/teams";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { isPagePending, PageSkeleton } from "../../components/page-skeleton";
import { Button } from "@/components/ui/button";
import { FilterInput } from "@/components/ui/filter-input";
import { Icon } from "@/components/ui/icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import TeamForm from "./team-form";
import { TeamCard } from "./team-card";
import { TeamDetailSheet } from "./team-detail-sheet";

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

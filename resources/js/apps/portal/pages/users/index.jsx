import { useEffect, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { destroy } from "@/actions/App/Http/Controllers/Portal/UserController";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { isPagePending, PageSkeleton } from "../../components/page-skeleton";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FilterInput } from "@/components/ui/filter-input";
import { cn } from "@/lib/utils";
import UserForm from "./user-form";
import { index } from "@/routes/portal/users";
import { UserCard } from "../../components/user-card";
import { UserDetailPanel } from "./user-detail-panel";

function readHashCode() {
    return window.location.hash.replace(/^#/, "");
}

function syncBrowserUrl(q, code) {
    const params = new URLSearchParams();

    if (q) {
        params.set("q", q);
    }

    const query = params.toString();
    const next = `/users${query ? `?${query}` : ""}${code ? `#${code}` : ""}`;

    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== next) {
        window.history.replaceState(window.history.state, "", next);
    }
}

function visitUsers({ q = "", code = "", only } = {}) {
    router.get(
        index.url(),
        {
            ...(q ? { q } : {}),
            ...(code ? { user: code } : {}),
        },
        {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            ...(only ? { only } : {}),
            onSuccess: (page) => {
                const nextQ = page.props.filters?.q ?? q ?? "";
                const nextCode = page.props.selectedUser?.code ?? (code || "");
                syncBrowserUrl(nextQ, nextCode);
            },
        }
    );
}

function UsersIndex({
    users: usersProp,
    selectedUser = null,
    filters = { q: "" },
    formOptions = { roles: [], managers: [], departments: [] },
}) {
    const pending = isPagePending(usersProp);
    const users = usersProp ?? [];
    const [search, setSearch] = useState(filters.q ?? "");
    const [userFormOpen, setUserFormOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [panelUser, setPanelUser] = useState(selectedUser);
    const [panelOpen, setPanelOpen] = useState(Boolean(selectedUser));
    const searchTimeout = useRef(null);
    const skipHashListener = useRef(false);
    const panelCloseTimeout = useRef(null);

    useEffect(() => {
        setSearch(filters.q ?? "");
    }, [filters.q]);

    useEffect(() => {
        if (panelCloseTimeout.current) {
            clearTimeout(panelCloseTimeout.current);
            panelCloseTimeout.current = null;
        }

        if (selectedUser) {
            setPanelUser(selectedUser);
            setPanelOpen(true);
            return;
        }

        setPanelOpen(false);
        panelCloseTimeout.current = setTimeout(() => {
            setPanelUser(null);
            panelCloseTimeout.current = null;
        }, 480);
    }, [selectedUser]);

    useEffect(() => {
        const hashCode = readHashCode();

        if (hashCode && selectedUser?.code !== hashCode) {
            visitUsers({ q: filters.q ?? "", code: hashCode });
            return;
        }

        if (!hashCode && selectedUser?.code) {
            syncBrowserUrl(filters.q ?? "", selectedUser.code);
        }
    }, []);

    useEffect(() => {
        const onHashChange = () => {
            if (skipHashListener.current) {
                skipHashListener.current = false;
                return;
            }

            const hashCode = readHashCode();

            if (!hashCode) {
                if (selectedUser) {
                    visitUsers({
                        q: search.trim(),
                        code: "",
                        only: ["users", "selectedUser", "filters"],
                    });
                }
                return;
            }

            if (hashCode === selectedUser?.code) {
                return;
            }

            visitUsers({
                q: search.trim(),
                code: hashCode,
                only: ["users", "selectedUser", "filters"],
            });
        };

        window.addEventListener("hashchange", onHashChange);

        return () => window.removeEventListener("hashchange", onHashChange);
    }, [search, selectedUser?.code]);

    useEffect(() => {
        return () => {
            if (searchTimeout.current) {
                clearTimeout(searchTimeout.current);
            }

            if (panelCloseTimeout.current) {
                clearTimeout(panelCloseTimeout.current);
            }
        };
    }, []);

    const handleSearchChange = (event) => {
        const value = event.target.value;
        setSearch(value);

        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }

        searchTimeout.current = setTimeout(() => {
            visitUsers({
                q: value.trim(),
                code: readHashCode() || selectedUser?.code || "",
                only: ["users", "selectedUser", "filters"],
            });
        }, 300);
    };

    const selectUser = (user) => {
        if (!user?.code || user.code === selectedUser?.code) {
            return;
        }

        skipHashListener.current = true;
        syncBrowserUrl(search.trim(), user.code);

        visitUsers({
            q: search.trim(),
            code: user.code,
            only: ["users", "selectedUser", "filters"],
        });
    };

    const openEdit = (user) => {
        setEditingUser(user);
        setUserFormOpen(true);
    };

    const confirmDelete = async (user) => {
        const confirmed = await confirm(
            `Remove "${user.display_name}" from this workspace? Their Propflow account stays available for other workspaces.`,
            "Remove member"
        );

        if (!confirmed) {
            return;
        }

        toast.promise(
            new Promise((resolve, reject) => {
                router.delete(destroy.url(user.code), {
                    preserveScroll: true,
                    onSuccess: () => {
                        if (selectedUser?.id === user.id) {
                            skipHashListener.current = true;
                            syncBrowserUrl(search.trim(), "");
                        }
                        resolve();
                    },
                    onError: (errors) =>
                        reject(new Error(errors.message || "Unable to delete user")),
                });
            }),
            {
                loading: "Deleting user...",
                success: "User has been deleted.",
                error: (error) => error.message,
            }
        );
    };

    const clearSelection = () => {
        skipHashListener.current = true;
        syncBrowserUrl(search.trim(), "");
        visitUsers({
            q: search.trim(),
            code: "",
            only: ["users", "selectedUser", "filters"],
        });
    };

    if (pending) {
        return <PageSkeleton title="Users" variant="table" />;
    }

    return (
        <Layout>
            <Layout.Header
                metaTitle={selectedUser?.display_name ? `${selectedUser.display_name} · Users` : "Users"}
                breadcrumbs={[{ label: "Users" }]}
            />
            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar>
                    <h1 className="shrink-0 text-2xl font-bold tracking-tight text-foreground">Users</h1>
                    <FilterInput
                        value={search}
                        onChange={handleSearchChange}
                        placeholder="filter by name, keywords..."
                    />
                    <Button
                        type="button"
                        className="ml-auto shrink-0"
                        onClick={() => {
                            setEditingUser(null);
                            setUserFormOpen(true);
                        }}
                    >
                        <Icon name="add-line" className="text-base" />
                        Invite User
                    </Button>
                </Layout.Toolbar>

                <div
                    className="grid min-h-0 flex-1 overflow-hidden transition-[grid-template-columns] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{
                        gridTemplateColumns: panelOpen
                            ? "minmax(0, 1.15fr) minmax(22rem, 0.85fr)"
                            : "minmax(0, 1fr) 0fr",
                    }}
                >
                    <div className="min-h-0 min-w-0 overflow-hidden">
                        <ScrollArea className="h-full">
                            <div className="px-6 py-6">
                                {users.length === 0 ? (
                                    <div className="flex min-h-64 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
                                        {filters.q
                                            ? "No users match your search."
                                            : "No users found for this tenant."}
                                    </div>
                                ) : (
                                    <div
                                        className={cn(
                                            "grid gap-4 transition-[grid-template-columns] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                                            panelOpen
                                                ? "grid-cols-1 sm:grid-cols-2"
                                                : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                                        )}
                                    >
                                        {users.map((user) => (
                                            <UserCard
                                                key={user.code}
                                                user={user}
                                                active={selectedUser?.code === user.code}
                                                onView={selectUser}
                                                onEdit={openEdit}
                                                onDelete={confirmDelete}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    <aside
                        className={cn(
                            "min-h-0 min-w-0 overflow-hidden bg-background transition-[border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                            panelOpen ? "border-l border-border" : "border-l border-transparent"
                        )}
                        aria-hidden={!panelOpen}
                    >
                        <div
                            className={cn(
                                "h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
                                panelOpen ? "translate-x-0" : "-translate-x-full"
                            )}
                        >
                            <UserDetailPanel
                                user={panelUser}
                                onEdit={(user) => {
                                    setEditingUser(user);
                                    setUserFormOpen(true);
                                }}
                                onClose={clearSelection}
                            />
                        </div>
                    </aside>
                </div>
            </Layout.Content>

            <UserForm
                isOpen={userFormOpen}
                onClose={() => {
                    setUserFormOpen(false);
                    setEditingUser(null);
                }}
                data={editingUser}
                formOptions={formOptions}
            />
        </Layout>
    );
}

UsersIndex.layout = (page) => <PortalLayout children={page} />;

export default UsersIndex;

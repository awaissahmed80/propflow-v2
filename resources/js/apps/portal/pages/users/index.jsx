import { useEffect, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { destroy } from "@/actions/App/Http/Controllers/Portal/UserController";
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
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FilterInput } from "@/components/ui/filter-input";
import { cn } from "@/lib/utils";
import UserForm from "./user-form";
import { index } from "@/routes/portal/users";

function UserAvatar({ user, className, size = "default", textClass }) {
    return (
        <Avatar
            name={user?.display_name || user?.email_address || ""}
            src={user?.avatar || undefined}
            size={size}
            className={className}
            textClass={textClass}
        />
    );
}

function StatCard({ label, value }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-border px-4 py-5 text-center">
            <div className="text-2xl font-semibold tracking-tight text-foreground">{value}</div>
            <div className="mt-1 text-sm text-muted-foreground">{label}</div>
        </div>
    );
}

function InfoField({ label, children }) {
    return (
        <div className="space-y-1.5">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-sm font-medium text-foreground">{children}</div>
        </div>
    );
}

function userSubtitle(user) {
    if (user?.title && user?.department) {
        return `${user.title} · ${user.department}`;
    }

    return user?.title || user?.department || user?.email_address || "—";
}

function UserCard({ user, active, onView, onEdit, onDelete }) {
    const tags = (user.roles ?? []).slice(0, 4);
    const canDelete = !user.is_owner;

    return (
        <article
            className={cn(
                "group relative flex items-start gap-3 rounded-md border bg-card p-4 transition-[border-color,box-shadow,transform]",
                "hover:-translate-y-0.5 hover:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.14)] dark:hover:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.5)]",
                active
                    ? "border-primary/40 shadow-[0_16px_48px_-16px_rgba(56,71,208,0.22)]"
                    : "border-border/80 shadow-none"
            )}
        >
            <button
                type="button"
                className="absolute inset-0 z-0 rounded-md"
                aria-label={`View ${user.display_name}`}
                onClick={() => onView(user)}
            />

            <div className="relative z-10 flex w-full items-start gap-3 pointer-events-none">
                <UserAvatar user={user} className="size-12" textClass="text-sm" />
                <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-base font-semibold tracking-tight text-foreground">
                                {user.display_name}
                            </div>
                            <div className="mt-0.5 truncate text-sm text-muted-foreground">
                                {userSubtitle(user)}
                            </div>
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger
                                className={cn(
                                    "pointer-events-auto inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground",
                                    "opacity-0 transition-opacity hover:bg-muted hover:text-foreground",
                                    "group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100",
                                    active && "opacity-100"
                                )}
                                aria-label={`Actions for ${user.display_name}`}
                                onClick={(event) => event.stopPropagation()}
                            >
                                <Icon name="more-2-fill" className="text-lg" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-40">
                                <DropdownMenuItem
                                    className="gap-2"
                                    onClick={() => onView(user)}
                                >
                                    <Icon name="user-line" className="text-base" />
                                    View profile
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="gap-2"
                                    onClick={() => onEdit(user)}
                                >
                                    <Icon name="pencil-line" className="text-base" />
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    variant="destructive"
                                    className="gap-2"
                                    disabled={!canDelete}
                                    onClick={() => {
                                        if (canDelete) {
                                            onDelete(user);
                                        }
                                    }}
                                >
                                    <Icon name="delete-bin-line" className="text-base" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {tags.map((role) => (
                                <span
                                    key={role}
                                    className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary"
                                >
                                    {role}
                                </span>
                            ))}
                            {(user.roles?.length ?? 0) > tags.length ? (
                                <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                                    +{user.roles.length - tags.length}
                                </span>
                            ) : null}
                        </div>
                    ) : (
                        <div className="text-xs text-muted-foreground">No roles assigned</div>
                    )}
                </div>
            </div>
        </article>
    );
}

function UserDetailPanel({ user, onEdit, onClose }) {
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
                            {user.code ? (
                                <span className="ml-auto text-sm text-muted-foreground">
                                    #{user.code}
                                </span>
                            ) : null}
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
                                                    {team.code ? (
                                                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                                                            #{team.code}
                                                        </span>
                                                    ) : null}
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
            `Delete "${user.display_name}"? This removes their access to this organization.`,
            "Delete user"
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
                    <h1 className="shrink-0 text-xl font-bold tracking-tight text-foreground">Users</h1>
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
                        Add New
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

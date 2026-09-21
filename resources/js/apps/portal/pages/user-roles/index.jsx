import { useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { destroy } from "@/actions/App/Http/Controllers/Portal/RoleController";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { isPagePending, PageSkeleton } from "../../components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import RoleForm from "./role-form";

const VISIBLE_PERMISSION_COUNT = 4;

function RolePermissions({ permissions }) {
    const [expanded, setExpanded] = useState(false);

    if (permissions.length === 0) {
        return <span className="text-muted-foreground">No permissions</span>;
    }

    const visiblePermissions = expanded
        ? permissions
        : permissions.slice(0, VISIBLE_PERMISSION_COUNT);
    const hiddenCount = permissions.length - VISIBLE_PERMISSION_COUNT;

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {visiblePermissions.map((permission) => (
                <Badge key={permission.id} variant="secondary">
                    {permission.name}
                </Badge>
            ))}
            {hiddenCount > 0 && (
                <button
                    type="button"
                    className="cursor-pointer text-xs font-medium text-primary hover:underline"
                    onClick={() => setExpanded((current) => !current)}
                >
                    {expanded ? "Show less" : "Show more..."}
                </button>
            )}
        </div>
    );
}

function UserRoles({ roles: rolesProp, permissionGroups: permissionGroupsProp }) {
    const pending = isPagePending(rolesProp);
    const roles = rolesProp ?? [];
    const permissionGroups = permissionGroupsProp ?? [];
    const [roleFormOpen, setRoleFormOpen] = useState(false);
    const [editingRole, setEditingRole] = useState(null);

    const openCreateForm = () => {
        setEditingRole(null);
        setRoleFormOpen(true);
    };

    const openEditForm = (role) => {
        setEditingRole(role);
        setRoleFormOpen(true);
    };

    const closeRoleForm = () => {
        setRoleFormOpen(false);
        setEditingRole(null);
    };

    const confirmRemove = async (role) => {
        const confirmed = await confirm(
            `Are you sure you want to delete "${role.name}"? This action cannot be undone.`,
            "Remove Role"
        );

        if (!confirmed) {
            return;
        }

        toast.promise(
            new Promise((resolve, reject) => {
                router.delete(destroy.url(role.name), {
                    preserveScroll: true,
                    onSuccess: () => resolve(),
                    onError: (errors) =>
                        reject(new Error(errors.message || "Unable to remove role")),
                });
            }),
            {
                loading: "Removing role...",
                success: "Role has been removed.",
                error: (error) => error.message,
            }
        );
    };

    if (pending) {
        return <PageSkeleton title="Roles" variant="table" />;
    }

    return (
        <Layout>
            <Layout.Header
                metaTitle="Roles & Permissions"
                breadcrumbs={[{ label: "Administration" }, { label: "Roles" }]}
            />
            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar>
                    <h1 className="shrink-0 text-xl font-bold tracking-tight text-foreground">
                        Roles & Permissions
                    </h1>
                    <Button type="button" className="ml-auto shrink-0" onClick={openCreateForm}>
                        <Icon name="add-line" className="text-base" />
                        Add Role
                    </Button>
                </Layout.Toolbar>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                    <div className="overflow-hidden rounded-lg border border-border bg-card">
                        <table className="w-full table-fixed text-left text-sm">
                            <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                                <tr>
                                    <th className="w-56 px-4 py-3 font-medium">Role</th>
                                    <th className="w-64 px-4 py-3 font-medium">Description</th>
                                    <th className="px-4 py-3 font-medium">Permissions</th>
                                    <th className="w-28 px-4 py-3 text-right font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {roles.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                                            No roles found for this tenant.
                                        </td>
                                    </tr>
                                )}
                                {roles.map((role) => (
                                    <tr key={role.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                                        <td className="px-4 py-4 align-top font-medium whitespace-nowrap text-foreground">
                                            {role.name}
                                        </td>
                                        <td className="px-4 py-4 align-top text-muted-foreground">
                                            {role.description || "—"}
                                        </td>
                                        <td className="px-4 py-4 align-top">
                                            <RolePermissions permissions={role.permissions} />
                                        </td>
                                        <td className="px-4 py-4 align-top">
                                            <div className="flex justify-end gap-1">
                                                <IconButton
                                                    type="button"
                                                    size="sm"
                                                    className="rounded-full"
                                                    icon="pencil-line"
                                                    aria-label={`Edit ${role.name}`}
                                                    onClick={() => openEditForm(role)}
                                                />
                                                <IconButton
                                                    type="button"
                                                    size="sm"
                                                    className="rounded-full"
                                                    variant="destructive"
                                                    icon="delete-bin-line"
                                                    aria-label={`Delete ${role.name}`}
                                                    onClick={() => confirmRemove(role)}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Layout.Content>

            <RoleForm
                isOpen={roleFormOpen}
                onClose={closeRoleForm}
                data={editingRole}
                permissionGroups={permissionGroups}
            />
        </Layout>
    );
}

UserRoles.layout = (page) => <PortalLayout children={page} />;

export default UserRoles;

import { useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { destroy, update } from "@/actions/App/Http/Controllers/Portal/RoleController";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import RoleForm from "./role-form";

const VISIBLE_PERMISSION_COUNT = 3;

function pathFrom(url) {
    const raw = String(url || "/");

    if (raw.startsWith("//") || raw.startsWith("http://") || raw.startsWith("https://")) {
        try {
            const pathname = new URL(raw.startsWith("//") ? `https:${raw}` : raw).pathname;

            return pathname === "" ? "/" : pathname;
        } catch {
            return "/";
        }
    }

    return raw.startsWith("/") ? raw : `/${raw}`;
}

function permissionSummary(permissions = []) {
    const count = permissions.length;

    if (count === 0) {
        return "No permissions";
    }

    return `${count} ${count === 1 ? "permission" : "permissions"}`;
}

function RolePermissions({ permissions }) {
    const [expanded, setExpanded] = useState(false);

    if (permissions.length === 0) {
        return null;
    }

    const visiblePermissions = expanded
        ? permissions
        : permissions.slice(0, VISIBLE_PERMISSION_COUNT);
    const hiddenCount = permissions.length - VISIBLE_PERMISSION_COUNT;

    return (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {visiblePermissions.map((permission) => (
                <Badge key={permission.id} variant="secondary" className="font-normal">
                    {permission.label || permission.name}
                </Badge>
            ))}
            {hiddenCount > 0 && (
                <button
                    type="button"
                    className="cursor-pointer text-xs font-medium text-primary hover:underline"
                    onClick={() => setExpanded((current) => !current)}
                >
                    {expanded ? "Show less" : `+${hiddenCount} more`}
                </button>
            )}
        </div>
    );
}

function RoleCard({ role, toggling, onEdit, onToggleEnabled, onRemove }) {
    const enabled = role.is_enabled !== false;
    const permissions = role.permissions ?? [];

    return (
        <div
            className={cn(
                "rounded-xl border border-border/70 bg-background px-3 py-3 shadow-xs transition-shadow hover:border-border hover:shadow-sm",
                !enabled && "opacity-60"
            )}
        >
            <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon name="checkbox-multiple-line" className="text-base" />
                </span>

                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <button
                                type="button"
                                className="block w-full truncate text-left text-base font-bold tracking-tight text-foreground"
                                onClick={() => onEdit(role)}
                            >
                                {role.name}
                            </button>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                                {role.description?.trim() || permissionSummary(permissions)}
                            </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                            <IconButton
                                type="button"
                                size="sm"
                                variant="ghost"
                                icon="pencil-line"
                                aria-label={`Edit ${role.name}`}
                                onClick={() => onEdit(role)}
                            />
                            {role.is_system ? (
                                <Switch
                                    checked={enabled}
                                    disabled={toggling}
                                    aria-label={`${enabled ? "Disable" : "Enable"} ${role.name}`}
                                    onCheckedChange={(next) => onToggleEnabled(role, Boolean(next))}
                                />
                            ) : (
                                <IconButton
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    icon="delete-bin-line"
                                    aria-label={`Delete ${role.name}`}
                                    className="text-muted-foreground hover:text-destructive"
                                    onClick={() => onRemove(role)}
                                />
                            )}
                        </div>
                    </div>

                    <RolePermissions permissions={permissions} />
                </div>
            </div>
        </div>
    );
}

export default function RolesPanel({ roles = [], permissionGroups = [] }) {
    const [roleFormOpen, setRoleFormOpen] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [togglingId, setTogglingId] = useState(null);

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

    const toggleRoleEnabled = (role, nextEnabled) => {
        if (togglingId !== null || !role.is_system) {
            return;
        }

        if (!nextEnabled) {
            const enabledCount = roles.filter((item) => item.is_enabled !== false).length;

            if (enabledCount <= 1) {
                toast.error("At least one enabled role is required.");
                return;
            }
        }

        setTogglingId(role.id);
        router.put(
            pathFrom(update.url(role.name)),
            {
                toggle_only: true,
                is_enabled: nextEnabled,
            },
            {
                preserveScroll: true,
                onSuccess: () => toast.success(nextEnabled ? "Role enabled" : "Role disabled"),
                onError: (errors) =>
                    toast.error(errors.role || errors.message || "Unable to update role"),
                onFinish: () => setTogglingId(null),
            }
        );
    };

    const confirmRemove = async (role) => {
        if (role.is_system) {
            return;
        }

        const confirmed = await confirm(
            `Are you sure you want to delete "${role.name}"? This action cannot be undone.`,
            "Remove Role"
        );

        if (!confirmed) {
            return;
        }

        toast.promise(
            new Promise((resolve, reject) => {
                router.delete(pathFrom(destroy.url(role.name)), {
                    preserveScroll: true,
                    onSuccess: () => resolve(),
                    onError: (errors) =>
                        reject(new Error(errors.role || errors.message || "Unable to remove role")),
                });
            }),
            {
                loading: "Removing role...",
                success: "Role has been removed.",
                error: (error) => error.message,
            }
        );
    };

    return (
        <section className="space-y-4">
            <div>
                <h3 className="text-base font-bold tracking-tight text-foreground">Roles</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                    Manage access for your team. Turn roles off when unused; remove only custom ones.
                </p>
            </div>

            <div className="space-y-2">
                {roles.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">
                        No roles yet. Add the first one below.
                    </div>
                ) : (
                    roles.map((role) => (
                        <RoleCard
                            key={role.id}
                            role={role}
                            toggling={togglingId === role.id}
                            onEdit={openEditForm}
                            onToggleEnabled={toggleRoleEnabled}
                            onRemove={confirmRemove}
                        />
                    ))
                )}

                <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-transparent px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/30 hover:text-foreground"
                    onClick={openCreateForm}
                >
                    <Icon name="add-line" className="text-base" />
                    Add role
                </button>
            </div>

            <RoleForm
                isOpen={roleFormOpen}
                onClose={closeRoleForm}
                data={editingRole}
                permissionGroups={permissionGroups}
            />
        </section>
    );
}

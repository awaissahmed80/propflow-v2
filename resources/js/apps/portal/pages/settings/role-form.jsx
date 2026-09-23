import { useEffect, useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { store, update } from "@/actions/App/Http/Controllers/Portal/RoleController";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
    hiddenPermissionNames,
    initialOpenPermissionGroups,
    nextPermissionSelection,
    permissionGroupSummary,
    pruneHiddenPermissions,
    visibleGroupPermissions,
} from "./role-permission-helpers";

export default function RoleForm({ isOpen, onClose, data = null, permissionGroups = [] }) {
    const [processing, setProcessing] = useState(false);
    const [selection, setSelection] = useState([]);
    const [openGroups, setOpenGroups] = useState([]);
    const [serverErrors, setServerErrors] = useState({});
    const { handleSubmit, register, reset } = useForm({
        defaultValues: {
            name: "",
            description: "",
        },
    });

    const isEditing = Boolean(data?.id);
    const hiddenNames = useMemo(
        () => hiddenPermissionNames(selection, permissionGroups),
        [selection, permissionGroups]
    );

    const handleClose = () => {
        reset({
            name: "",
            description: "",
        });
        setSelection([]);
        setOpenGroups([]);
        setServerErrors({});
        onClose(false);
    };

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setServerErrors({});

        if (data) {
            const nextSelection = pruneHiddenPermissions(
                (data.permissions ?? []).map((permission) => permission.name),
                permissionGroups
            );
            const nextHidden = hiddenPermissionNames(nextSelection, permissionGroups);

            reset({
                name: data.name ?? "",
                description: data.description ?? "",
            });
            setSelection(nextSelection);
            setOpenGroups(initialOpenPermissionGroups(permissionGroups, nextSelection, nextHidden));
            return;
        }

        reset({
            name: "",
            description: "",
        });
        setSelection([]);
        setOpenGroups(initialOpenPermissionGroups(permissionGroups, [], new Set()));
    }, [isOpen, data, permissionGroups, reset]);

    const handlePermissionChange = (permissionName, checked, groupType, groupIndex) => {
        setSelection(
            nextPermissionSelection({
                selection,
                permissionName,
                checked,
                groupType,
                groupIndex,
                permissionGroups,
            })
        );
    };

    const onSubmit = (formData) => {
        setProcessing(true);
        setServerErrors({});

        const payload = {
            ...formData,
            permissions: pruneHiddenPermissions(selection, permissionGroups),
        };

        const visit = isEditing
            ? {
                  method: "put",
                  url: update.url(data.name),
                  successMessage: "Role updated successfully",
                  errorMessage: "Unable to update role",
              }
            : {
                  method: "post",
                  url: store.url(),
                  successMessage: "Role created successfully",
                  errorMessage: "Unable to create role",
              };

        router[visit.method](visit.url, payload, {
            preserveScroll: true,
            preserveState: "errors",
            onSuccess: () => {
                toast.success(visit.successMessage);
                handleClose();
            },
            onError: (errors) => {
                setServerErrors(errors);
                toast.error(errors.name || errors.message || visit.errorMessage);
            },
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <Drawer
            title={isEditing ? "Edit Role" : "Add Role"}
            isOpen={isOpen}
            onClose={(open) => {
                if (!open) {
                    handleClose();
                }
            }}
            actions={
                <Button type="submit" form="role-form" size="sm" loading={processing}>
                    Submit
                </Button>
            }
        >
            <form id="role-form" className="flex flex-col space-y-5 px-5" onSubmit={handleSubmit(onSubmit)}>
                <Input
                    label="Role Name"
                    required
                    autoComplete="off"
                    error={serverErrors.name}
                    {...register("name", { required: true })}
                />

                <div>
                    <Label className="mb-1 text-label font-medium text-muted-foreground">
                        Description
                    </Label>
                    <Textarea
                        rows={3}
                        className="min-h-20 resize-y"
                        aria-invalid={Boolean(serverErrors.description)}
                        {...register("description")}
                    />
                    {serverErrors.description && (
                        <p className="mt-1 text-sm text-destructive">{serverErrors.description}</p>
                    )}
                </div>

                <div className="mt-4 font-bold text-muted-foreground">Select Permissions</div>

                <Accordion
                    multiple
                    value={openGroups}
                    onValueChange={(value) => setOpenGroups(value ?? [])}
                    className="rounded-lg border border-border/70"
                >
                    {permissionGroups.map((resource, groupIndex) => {
                        const visiblePermissions = visibleGroupPermissions(resource, hiddenNames);

                        if (visiblePermissions.length === 0) {
                            return null;
                        }

                        const summary = permissionGroupSummary(resource, selection, hiddenNames);

                        return (
                            <AccordionItem
                                key={resource.group}
                                value={resource.group}
                                className="border-border/70 px-3"
                            >
                                <AccordionTrigger className="py-3 hover:no-underline">
                                    <span className="flex min-w-0 flex-1 flex-col gap-0.5 pr-3 text-left">
                                        <span className="text-sm font-semibold text-foreground">
                                            {resource.group}
                                        </span>
                                        <span className="text-xs font-normal text-muted-foreground">
                                            {summary}
                                        </span>
                                    </span>
                                </AccordionTrigger>
                                <AccordionContent className="pb-3 [&_p:not(:last-child)]:mb-0">
                                    {visiblePermissions.map((permission) => {
                                        const checked = selection.includes(permission.name);

                                        return (
                                            <div key={permission.name} className="mt-1 text-sm">
                                                <label className="my-3 flex cursor-pointer flex-row items-start space-x-3">
                                                    <Switch
                                                        className="mt-0.5"
                                                        checked={checked}
                                                        onCheckedChange={(isChecked) =>
                                                            handlePermissionChange(
                                                                permission.name,
                                                                Boolean(isChecked),
                                                                resource.type ?? "checkbox",
                                                                groupIndex
                                                            )
                                                        }
                                                    />
                                                    <span
                                                        className={cn(
                                                            "select-none leading-snug",
                                                            checked
                                                                ? "text-foreground"
                                                                : "text-muted-foreground/70"
                                                        )}
                                                    >
                                                        {permission.label}
                                                    </span>
                                                </label>
                                            </div>
                                        );
                                    })}
                                </AccordionContent>
                            </AccordionItem>
                        );
                    })}
                </Accordion>
            </form>
        </Drawer>
    );
}

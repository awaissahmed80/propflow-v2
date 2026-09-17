import { useEffect, useState } from "react";
import { router } from "@inertiajs/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { store, update } from "@/actions/App/Http/Controllers/Portal/RoleController";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export default function RoleForm({ isOpen, onClose, data = null, permissionGroups = [] }) {
    const [processing, setProcessing] = useState(false);
    const [selection, setSelection] = useState([]);
    const [serverErrors, setServerErrors] = useState({});
    const { handleSubmit, register, reset } = useForm({
        defaultValues: {
            name: "",
            description: "",
        },
    });

    const isEditing = Boolean(data?.id);

    const handleClose = () => {
        reset({
            name: "",
            description: "",
        });
        setSelection([]);
        setServerErrors({});
        onClose(false);
    };

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setServerErrors({});

        if (data) {
            reset({
                name: data.name ?? "",
                description: data.description ?? "",
            });
            setSelection((data.permissions ?? []).map((permission) => permission.name));
            return;
        }

        reset({
            name: "",
            description: "",
        });
        setSelection([]);
    }, [isOpen, data, reset]);

    const handlePermissionChange = (permissionName, checked, groupType, groupIndex) => {
        let nextSelection = [...selection];

        if (nextSelection.includes(permissionName) && !checked) {
            nextSelection = nextSelection.filter((name) => name !== permissionName);
        } else if (checked) {
            if (groupType === "radio") {
                const groupPermissionNames = permissionGroups[groupIndex]?.permissions?.map(
                    (permission) => permission.name
                ) ?? [];

                nextSelection = [
                    ...nextSelection.filter((name) => !groupPermissionNames.includes(name)),
                    permissionName,
                ];
            } else if (!nextSelection.includes(permissionName)) {
                nextSelection.push(permissionName);
            }
        }

        setSelection(nextSelection);
    };

    const onSubmit = (formData) => {
        setProcessing(true);
        setServerErrors({});

        const payload = {
            ...formData,
            permissions: selection,
        };

        const visit = isEditing
            ? {
                  method: "put",
                  url: update.url(data.id),
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

                {permissionGroups.map((resource, groupIndex) => (
                    <div key={resource.group} className="mb-5 rounded-md">
                        <div className="mb-2 text-md font-semibold">{resource.group}</div>
                        <div>
                            {resource.permissions.map((permission) => {
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
                        </div>
                    </div>
                ))}
            </form>
        </Drawer>
    );
}

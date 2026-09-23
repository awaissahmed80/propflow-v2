import { useEffect, useId, useMemo, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { store, update } from "@/actions/App/Http/Controllers/Portal/UserController";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { SelectBox } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const emptyValues = {
    first_name: "",
    last_name: "",
    title: "",
    department: "",
    manager_id: "",
    email_address: "",
    phone_number: "",
    password: "",
    password_confirmation: "",
    roles: [],
};

function FormRow({ label, required = false, children, className }) {
    return (
        <div
            className={cn(
                "grid gap-2 border-b border-border py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-start sm:gap-6",
                className
            )}
        >
            <div className="pt-2 text-sm font-medium text-foreground">
                {label}
                {required ? <span className="text-destructive"> *</span> : null}
            </div>
            <div className="min-w-0 space-y-2">{children}</div>
        </div>
    );
}

function ProfileAvatarPicker({
    name,
    value,
    previewUrl,
    onChange,
    sizeClass = "size-20",
    className,
}) {
    const inputId = useId();
    const inputRef = useRef(null);
    const [localPreview, setLocalPreview] = useState(null);

    useEffect(() => {
        if (!(value instanceof File)) {
            setLocalPreview(null);
            return;
        }

        const objectUrl = URL.createObjectURL(value);
        setLocalPreview(objectUrl);

        return () => URL.revokeObjectURL(objectUrl);
    }, [value]);

    const displayUrl = localPreview || previewUrl || null;

    return (
        <div className={cn("relative shrink-0", className)}>
            <label
                htmlFor={inputId}
                className={cn(
                    "group relative block cursor-pointer overflow-hidden rounded-full ring-4 ring-background",
                    sizeClass
                )}
            >
                {displayUrl ? (
                    <img
                        src={displayUrl}
                        alt={name || "Profile photo"}
                        className="size-full object-cover"
                    />
                ) : (
                    <Avatar
                        name={name}
                        className="size-full"
                        textClass="text-xl"
                    />
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                    <Icon name="camera-line" className="text-xl text-white" />
                </span>
            </label>
            <input
                ref={inputRef}
                id={inputId}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                onChange={(event) => {
                    onChange?.(event.target.files?.[0] ?? null);
                }}
            />
        </div>
    );
}

export default function UserForm({
    isOpen,
    onClose,
    data = null,
    formOptions = { roles: [], managers: [], departments: [] },
}) {
    const [processing, setProcessing] = useState(false);
    const [avatarFile, setAvatarFile] = useState(null);
    const [removeAvatar, setRemoveAvatar] = useState(false);
    const [updatePassword, setUpdatePassword] = useState(false);
    const [serverErrors, setServerErrors] = useState({});
    const [photoPreview, setPhotoPreview] = useState(null);
    const {
        handleSubmit,
        register,
        reset,
        control,
        watch,
        setValue,
        formState: { errors },
    } = useForm({
        defaultValues: emptyValues,
        mode: "onSubmit",
        reValidateMode: "onChange",
    });

    const isEditing = Boolean(data?.id);
    const showPasswordFields = isEditing && updatePassword;
    const firstName = watch("first_name");
    const lastName = watch("last_name");
    const emailAddress = watch("email_address");
    const previewName =
        [firstName, lastName].filter(Boolean).join(" ") ||
        data?.display_name ||
        "New user";
    const previewEmail = emailAddress || data?.email_address || "Add an email address";
    const avatarPreviewUrl = removeAvatar ? null : photoPreview || data?.avatar || null;

    const fieldError = (name) => serverErrors[name] || errors[name]?.message;

    const managerOptions = useMemo(
        () =>
            (formOptions.managers ?? [])
                .filter((manager) => !isEditing || manager.id !== data?.id)
                .map((manager) => ({
                    value: String(manager.id),
                    label: manager.display_name,
                    description: manager.title || undefined,
                    avatar: {
                        name: manager.display_name,
                        src: manager.avatar || undefined,
                    },
                })),
        [formOptions.managers, isEditing, data?.id]
    );

    const roleOptions = useMemo(
        () =>
            (formOptions.roles ?? []).map((role) =>
                typeof role === "string" ? role : { value: role, label: role }
            ),
        [formOptions.roles]
    );

    const handleAvatarChange = (file) => {
        setAvatarFile(file);
        setRemoveAvatar(file === null && Boolean(data?.avatar));
    };

    const handleClose = () => {
        reset(emptyValues);
        setAvatarFile(null);
        setRemoveAvatar(false);
        setUpdatePassword(false);
        setServerErrors({});
        setPhotoPreview(null);
        onClose(false);
    };

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setServerErrors({});
        setAvatarFile(null);
        setRemoveAvatar(false);
        setUpdatePassword(false);
        setPhotoPreview(null);

        if (data) {
            reset({
                first_name: data.first_name ?? "",
                last_name: data.last_name ?? "",
                title: data.title ?? "",
                department: data.department ?? "",
                manager_id: data.manager_id ? String(data.manager_id) : "",
                email_address: data.email_address ?? "",
                phone_number: data.phone_number ?? "",
                password: "",
                password_confirmation: "",
                roles: data.roles ?? [],
            });
            return;
        }

        reset(emptyValues);
    }, [isOpen, data, reset]);

    useEffect(() => {
        if (!(avatarFile instanceof File)) {
            setPhotoPreview(null);
            return;
        }

        const objectUrl = URL.createObjectURL(avatarFile);
        setPhotoPreview(objectUrl);

        return () => URL.revokeObjectURL(objectUrl);
    }, [avatarFile]);

    const onInvalid = (validationErrors) => {
        const firstError = Object.values(validationErrors).find(
            (error) => error?.message
        )?.message;

        if (firstError) {
            toast.error(firstError);
        }
    };

    const onSubmit = (formData) => {
        setProcessing(true);
        setServerErrors({});

        const payload = isEditing
            ? {
                  first_name: formData.first_name.trim(),
                  last_name: formData.last_name.trim(),
                  title: formData.title.trim(),
                  department: formData.department || null,
                  manager_id: formData.manager_id || null,
                  email_address: formData.email_address.trim(),
                  phone_number: formData.phone_number || null,
                  roles: formData.roles ?? [],
                  remove_avatar: removeAvatar,
              }
            : {
                  title: formData.title.trim(),
                  department: formData.department || null,
                  manager_id: formData.manager_id || null,
                  email_address: formData.email_address.trim(),
                  phone_number: formData.phone_number || null,
                  roles: formData.roles ?? [],
              };

        if (showPasswordFields) {
            payload.password = formData.password || null;
            payload.password_confirmation = formData.password_confirmation || null;
        }

        if (avatarFile instanceof File) {
            payload.avatar = avatarFile;
        }

        if (isEditing) {
            router.post(
                update.url(data.code),
                { ...payload, _method: "put" },
                {
                    forceFormData: true,
                    preserveScroll: true,
                    preserveState: "errors",
                    onSuccess: () => {
                        toast.success("User updated successfully");
                        handleClose();
                    },
                    onError: (submitErrors) => {
                        setServerErrors(submitErrors);
                        toast.error(
                            submitErrors.email_address ||
                                submitErrors.message ||
                                "Unable to update user"
                        );
                    },
                    onFinish: () => setProcessing(false),
                }
            );
            return;
        }

        router.post(store.url(), payload, {
            forceFormData: true,
            preserveScroll: true,
            preserveState: "errors",
            onSuccess: () => {
                toast.success(
                    "Invitation sent. Existing accounts are added to this workspace automatically."
                );
                handleClose();
            },
            onError: (submitErrors) => {
                setServerErrors(submitErrors);
                toast.error(
                    submitErrors.email_address ||
                        submitErrors.message ||
                        "Unable to send invitation"
                );
            },
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) {
                    handleClose();
                }
            }}
        >
            <DialogContent
                showCloseButton
                className={cn(
                    "grid gap-0 overflow-hidden rounded-md p-0 sm:max-w-2xl",
                    "max-h-[min(92vh,48rem)] grid-rows-[auto_minmax(0,1fr)_auto]"
                )}
            >
                <div className="shrink-0 border-b border-border">
                    <DialogHeader className="sr-only">
                        <DialogTitle>{isEditing ? "Edit user" : "Invite user"}</DialogTitle>
                        <DialogDescription>
                            {isEditing
                                ? "Update this user’s profile and access."
                                : "Invite someone to this workspace by email. They won’t be active until they accept."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="relative">
                        <div className="h-14 bg-muted" />

                        <div className="relative px-6 pb-4">
                            {isEditing ? (
                                <ProfileAvatarPicker
                                    name={previewName}
                                    value={avatarFile}
                                    previewUrl={avatarPreviewUrl}
                                    onChange={handleAvatarChange}
                                    sizeClass="size-20"
                                    className="-mt-8"
                                />
                            ) : (
                                <div className="-mt-8 flex size-20 items-center justify-center rounded-full bg-primary/10 ring-4 ring-background">
                                    <Icon name="mail-send-line" className="text-2xl text-primary" />
                                </div>
                            )}

                            <div className="mt-3 space-y-0.5">
                                <div className="truncate text-xl font-semibold tracking-tight text-foreground">
                                    {isEditing ? previewName : "Invite user"}
                                </div>
                                <div className="truncate text-sm text-muted-foreground">
                                    {isEditing
                                        ? previewEmail
                                        : previewEmail !== "Add an email address"
                                          ? previewEmail
                                          : "Send an invite by email"}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <form
                    id="user-form"
                    className="min-h-0 overflow-y-auto px-6"
                    onSubmit={handleSubmit(onSubmit, onInvalid)}
                    noValidate
                >
                    {isEditing ? (
                        <FormRow label="Name" required>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <Input
                                    required
                                    placeholder="First name"
                                    autoComplete="given-name"
                                    error={fieldError("first_name")}
                                    {...register("first_name", {
                                        required: "First name is required.",
                                        validate: (value) =>
                                            value.trim().length > 0 || "First name is required.",
                                    })}
                                />
                                <Input
                                    required
                                    placeholder="Last name"
                                    autoComplete="family-name"
                                    error={fieldError("last_name")}
                                    {...register("last_name", {
                                        required: "Last name is required.",
                                        validate: (value) =>
                                            value.trim().length > 0 || "Last name is required.",
                                    })}
                                />
                            </div>
                        </FormRow>
                    ) : null}

                    <FormRow label="Email address" required>
                        <Input
                            required
                            type="email"
                            autoComplete="email"
                            placeholder="name@company.com"
                            startElement={
                                <Icon name="mail-line" className="text-sm text-muted-foreground" />
                            }
                            error={fieldError("email_address")}
                            {...register("email_address", {
                                required: "Email address is required.",
                                pattern: {
                                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                    message: "Enter a valid email address.",
                                },
                            })}
                        />
                        {!isEditing ? (
                            <p className="text-xs text-muted-foreground">
                                We’ll email an invite link. They won’t appear as an active member
                                until they accept.
                            </p>
                        ) : null}
                    </FormRow>

                    {isEditing ? (
                        <FormRow label="Password">
                            <Checkbox
                                checked={updatePassword}
                                onCheckedChange={(checked) => {
                                    const enabled = Boolean(checked);
                                    setUpdatePassword(enabled);

                                    if (!enabled) {
                                        setValue("password", "");
                                        setValue("password_confirmation", "");
                                    }
                                }}
                            >
                                Update password
                            </Checkbox>
                        </FormRow>
                    ) : null}

                    {showPasswordFields ? (
                        <FormRow
                            label={isEditing ? "New password" : "Password"}
                            required
                        >
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <Input.Password
                                    required
                                    autoComplete="new-password"
                                    placeholder="Password"
                                    error={fieldError("password")}
                                    {...register("password", {
                                        required: showPasswordFields
                                            ? "Password is required."
                                            : false,
                                    })}
                                />
                                <Input.Password
                                    autoComplete="new-password"
                                    placeholder="Confirm password"
                                    error={fieldError("password_confirmation")}
                                    {...register("password_confirmation", {
                                        validate: (value, values) => {
                                            if (!showPasswordFields) {
                                                return true;
                                            }

                                            return (
                                                value === values.password ||
                                                "Passwords do not match."
                                            );
                                        },
                                    })}
                                />
                            </div>
                        </FormRow>
                    ) : null}

                    <div className="grid grid-cols-1 gap-4 border-b border-border py-4 sm:grid-cols-2 sm:gap-6">
                        <div className="min-w-0 space-y-2">
                            <div className="text-sm font-medium text-foreground">
                                Job title
                                <span className="text-destructive"> *</span>
                            </div>
                            <Input
                                required
                                placeholder="e.g. Sales Executive"
                                error={fieldError("title")}
                                {...register("title", {
                                    required: "Job title is required.",
                                    validate: (value) =>
                                        value.trim().length > 0 || "Job title is required.",
                                })}
                            />
                        </div>
                        <div className="min-w-0 space-y-2">
                            <div className="text-sm font-medium text-foreground">
                                Phone
                                {isEditing ? <span className="text-destructive"> *</span> : null}
                            </div>
                            <Controller
                                name="phone_number"
                                control={control}
                                rules={{
                                    required: isEditing ? "Phone number is required." : false,
                                }}
                                render={({ field }) => (
                                    <PhoneInput
                                        label={null}
                                        required={isEditing}
                                        value={field.value}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                        error={fieldError("phone_number")}
                                    />
                                )}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 border-b border-border py-4 sm:grid-cols-2 sm:gap-6">
                        <div className="min-w-0 space-y-2">
                            <div className="text-sm font-medium text-foreground">Department</div>
                            <Controller
                                name="department"
                                control={control}
                                render={({ field }) => (
                                    <SelectBox
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        options={formOptions.departments ?? []}
                                        placeholder="Select department..."
                                        error={fieldError("department")}
                                    />
                                )}
                            />
                        </div>
                        <div className="min-w-0 space-y-2">
                            <div className="text-sm font-medium text-foreground">Manager</div>
                            <Controller
                                name="manager_id"
                                control={control}
                                render={({ field }) => (
                                    <SelectBox
                                        clearable
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        options={managerOptions}
                                        placeholder="Select manager..."
                                        error={fieldError("manager_id")}
                                    />
                                )}
                            />
                        </div>
                    </div>

                    <div className="space-y-2 border-b-0 py-4">
                        <div className="text-sm font-medium text-foreground">Roles</div>
                        <Controller
                            name="roles"
                            control={control}
                            render={({ field }) => {
                                const selected = Array.isArray(field.value)
                                    ? field.value.map(String)
                                    : [];

                                const toggleRole = (roleValue) => {
                                    if (selected.includes(roleValue)) {
                                        field.onChange(
                                            selected.filter((item) => item !== roleValue)
                                        );
                                        return;
                                    }

                                    field.onChange([...selected, roleValue]);
                                };

                                if (roleOptions.length === 0) {
                                    return (
                                        <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                                            No roles available yet.
                                        </div>
                                    );
                                }

                                return (
                                    <div className="space-y-2">
                                        <div
                                            className={cn(
                                                "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3",
                                                fieldError("roles") &&
                                                    "rounded-md ring-1 ring-destructive/30"
                                            )}
                                        >
                                            {roleOptions.map((role) => {
                                                const value =
                                                    typeof role === "string"
                                                        ? role
                                                        : String(role.value);
                                                const label =
                                                    typeof role === "string"
                                                        ? role
                                                        : role.label;
                                                const checked = selected.includes(value);

                                                return (
                                                    <button
                                                        key={value}
                                                        type="button"
                                                        onClick={() => toggleRole(value)}
                                                        className={cn(
                                                            "flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-left text-sm transition-colors",
                                                            checked
                                                                ? "border-primary/40 bg-primary/5 text-foreground"
                                                                : "border-border bg-transparent text-foreground hover:bg-muted/50"
                                                        )}
                                                    >
                                                        <span
                                                            className={cn(
                                                                "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                                                                checked
                                                                    ? "border-primary bg-primary text-primary-foreground"
                                                                    : "border-input"
                                                            )}
                                                        >
                                                            {checked ? (
                                                                <Icon
                                                                    name="check-line"
                                                                    className="text-[10px] leading-none"
                                                                />
                                                            ) : null}
                                                        </span>
                                                        <span className="min-w-0 truncate font-medium">
                                                            {label}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {fieldError("roles") ? (
                                            <div className="text-[13px] text-destructive">
                                                {fieldError("roles")}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-muted-foreground">
                                                Select one or more roles for this user.
                                            </p>
                                        )}
                                    </div>
                                );
                            }}
                        />
                    </div>
                </form>

                <DialogFooter className="shrink-0 border-t border-border bg-popover px-6 py-4 sm:justify-end">
                    <div className="flex w-full items-center justify-end gap-2">
                        <Button type="button" variant="outline" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button type="submit" form="user-form" loading={processing}>
                            {isEditing ? "Save changes" : "Send invite"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

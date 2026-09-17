import { useEffect, useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { store, update } from "@/actions/App/Http/Controllers/Portal/TeamController";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { InlineSelect } from "@/components/ui/inline-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const DEFAULT_TEAM_COLOR = "#3847d0";
const COLOR_PATTERN = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

const MEMBER_ROLE_OPTIONS = [
    { value: "lead", label: "Lead" },
    { value: "member", label: "Member" },
];

const emptyValues = {
    title: "",
    description: "",
    color: DEFAULT_TEAM_COLOR,
    leader_id: "",
    member_ids: [],
};

export default function TeamForm({
    isOpen,
    onClose,
    data = null,
    formOptions = { members: [] },
}) {
    const [processing, setProcessing] = useState(false);
    const [serverErrors, setServerErrors] = useState({});
    const [memberQuery, setMemberQuery] = useState("");
    const {
        handleSubmit,
        register,
        reset,
        control,
        watch,
        setValue,
        getValues,
        clearErrors,
        setError,
        formState: { errors },
    } = useForm({
        defaultValues: emptyValues,
        mode: "onSubmit",
        reValidateMode: "onChange",
    });

    const isEditing = Boolean(data?.id);
    const selectedColor = watch("color") || DEFAULT_TEAM_COLOR;
    const leaderId = watch("leader_id");
    const memberIds = watch("member_ids") ?? [];

    const fieldError = (name) => serverErrors[name] || errors[name]?.message;

    const availableMembers = useMemo(
        () => formOptions.members ?? [],
        [formOptions.members]
    );

    const selectedMembers = useMemo(
        () =>
            memberIds
                .map((id) => availableMembers.find((member) => String(member.id) === String(id)))
                .filter(Boolean),
        [memberIds, availableMembers]
    );

    const memberSuggestions = useMemo(() => {
        const needle = memberQuery.trim().toLowerCase();
        const selected = new Set(memberIds.map(String));

        return availableMembers
            .filter((member) => !selected.has(String(member.id)))
            .filter((member) => {
                if (!needle) {
                    return true;
                }

                return [
                    member.display_name,
                    member.title,
                    member.email_address,
                ]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(needle));
            })
            .slice(0, 6);
    }, [availableMembers, memberIds, memberQuery]);

    const handleClose = () => {
        reset(emptyValues);
        setServerErrors({});
        setMemberQuery("");
        onClose(false);
    };

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setServerErrors({});
        setMemberQuery("");

        if (data) {
            reset({
                title: data.title ?? "",
                description: data.description ?? "",
                color: data.color || DEFAULT_TEAM_COLOR,
                leader_id: data.leader?.id ? String(data.leader.id) : "",
                member_ids: (data.members ?? []).map((member) => String(member.id)),
            });
            return;
        }

        reset(emptyValues);
    }, [isOpen, data, reset]);

    useEffect(() => {
        if (!leaderId) {
            return;
        }

        const current = getValues("member_ids") ?? [];
        if (!current.includes(leaderId)) {
            setValue("member_ids", [...current, leaderId], { shouldValidate: true });
        }

        clearErrors(["leader_id", "member_ids"]);
        setServerErrors((current) => {
            if (!current.leader_id && !current.member_ids) {
                return current;
            }

            const next = { ...current };
            delete next.leader_id;
            delete next.member_ids;

            return next;
        });
    }, [leaderId, getValues, setValue, clearErrors]);

    const addMember = (memberId) => {
        const id = String(memberId);
        const current = getValues("member_ids") ?? [];

        if (!current.includes(id)) {
            setValue("member_ids", [...current, id], { shouldValidate: true });
        }

        if (!getValues("leader_id")) {
            setValue("leader_id", id, { shouldValidate: true });
        }

        clearErrors(["leader_id", "member_ids"]);
        setServerErrors((current) => {
            if (!current.leader_id && !current.member_ids) {
                return current;
            }

            const next = { ...current };
            delete next.leader_id;
            delete next.member_ids;

            return next;
        });
        setMemberQuery("");
    };

    const removeMember = (memberId) => {
        const id = String(memberId);

        if (String(getValues("leader_id")) === id) {
            setError("leader_id", {
                type: "manual",
                message: "Assign another lead before removing this person.",
            });
            return;
        }

        const current = getValues("member_ids") ?? [];
        setValue(
            "member_ids",
            current.filter((item) => item !== id),
            { shouldValidate: true }
        );
    };

    const setMemberRole = (memberId, role) => {
        const id = String(memberId);

        if (role === "lead") {
            setValue("leader_id", id, { shouldValidate: true });
            const current = getValues("member_ids") ?? [];
            if (!current.includes(id)) {
                setValue("member_ids", [...current, id], { shouldValidate: true });
            }
            clearErrors("leader_id");
            return;
        }

        if (String(getValues("leader_id")) === id) {
            setError("leader_id", {
                type: "manual",
                message: "A team must have at least one lead. Assign someone else as lead first.",
            });
        }
    };

    const onInvalid = (validationErrors) => {
        const firstError =
            validationErrors.title?.message ||
            validationErrors.description?.message ||
            validationErrors.color?.message ||
            validationErrors.leader_id?.message ||
            validationErrors.member_ids?.message;

        if (firstError) {
            toast.error(firstError);
        }
    };

    const onSubmit = (formData) => {
        setProcessing(true);
        setServerErrors({});

        const payload = {
            title: formData.title.trim(),
            description: formData.description?.trim() || null,
            color: formData.color || DEFAULT_TEAM_COLOR,
            leader_id: formData.leader_id,
            member_ids: formData.member_ids ?? [],
        };

        if (isEditing) {
            router.put(update.url(data.id), payload, {
                preserveScroll: true,
                preserveState: "errors",
                onSuccess: () => {
                    toast.success("Team updated successfully");
                    handleClose();
                },
                onError: (submitErrors) => {
                    setServerErrors(submitErrors);
                    toast.error(
                        submitErrors.title ||
                            submitErrors.leader_id ||
                            submitErrors.message ||
                            "Unable to update team"
                    );
                },
                onFinish: () => setProcessing(false),
            });
            return;
        }

        router.post(store.url(), payload, {
            preserveScroll: true,
            preserveState: "errors",
            onSuccess: () => {
                toast.success("Team created successfully");
                handleClose();
            },
            onError: (submitErrors) => {
                setServerErrors(submitErrors);
                toast.error(
                    submitErrors.title ||
                        submitErrors.leader_id ||
                        submitErrors.message ||
                        "Unable to create team"
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
                    "gap-0 overflow-hidden rounded-md p-0 sm:max-w-xl",
                    "max-h-[min(90vh,44rem)] grid-rows-[auto_minmax(0,1fr)_auto]"
                )}
            >
                <DialogHeader className="gap-3 border-b border-border px-6 py-5 text-left">
                    <div className="flex items-start gap-3 pr-8">
                        <div
                            className="flex size-11 shrink-0 items-center justify-center rounded-md text-primary-foreground"
                            style={{ backgroundColor: selectedColor }}
                        >
                            <Icon name="user-community-line" className="text-xl" />
                        </div>
                        <div className="min-w-0 space-y-1">
                            <DialogTitle className="text-lg font-semibold tracking-tight">
                                {isEditing ? "Edit team" : "Create a new team"}
                            </DialogTitle>
                            <DialogDescription>
                                {isEditing
                                    ? "Update this team’s name, appearance, lead, and members."
                                    : "Group agents under a lead so work can be routed and tracked clearly."}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form
                    id="team-form"
                    className="min-h-0 overflow-y-auto px-6 py-5"
                    onSubmit={handleSubmit(onSubmit, onInvalid)}
                    noValidate
                >
                    <div className="flex flex-col gap-5">
                        <Input
                            label="Team name"
                            required
                            placeholder="e.g. Sales North"
                            error={fieldError("title")}
                            {...register("title", {
                                required: "Team name is required.",
                                maxLength: {
                                    value: 150,
                                    message: "Team name must be 150 characters or less.",
                                },
                                validate: (value) =>
                                    value.trim().length > 0 || "Team name is required.",
                            })}
                        />

                        <div className="space-y-0.5">
                            <Label className="mb-1 flex flex-row items-center text-label font-medium text-muted-foreground">
                                Description
                            </Label>
                            <Textarea
                                placeholder="What this team owns or focuses on"
                                className="min-h-20 rounded-md dark:bg-input/30"
                                aria-invalid={Boolean(fieldError("description")) || undefined}
                                {...register("description", {
                                    maxLength: {
                                        value: 1000,
                                        message: "Description must be 1000 characters or less.",
                                    },
                                })}
                            />
                            {fieldError("description") ? (
                                <div className="text-[13px] text-destructive">
                                    {fieldError("description")}
                                </div>
                            ) : null}
                        </div>

                        <Controller
                            name="color"
                            control={control}
                            rules={{
                                required: "Appearance color is required.",
                                pattern: {
                                    value: COLOR_PATTERN,
                                    message: "Enter a valid hex color (e.g. #3847d0).",
                                },
                            }}
                            render={({ field }) => (
                                <div className="space-y-0.5">
                                    <ColorPicker
                                        label="Appearance"
                                        required
                                        value={field.value || DEFAULT_TEAM_COLOR}
                                        onChange={(value) => {
                                            field.onChange(value);
                                            clearErrors("color");
                                        }}
                                        placeholder="Select color..."
                                    />
                                    {fieldError("color") ? (
                                        <div className="text-[13px] text-destructive">
                                            {fieldError("color")}
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        />

                        <Controller
                            name="leader_id"
                            control={control}
                            rules={{
                                required: "A team must have at least one lead.",
                            }}
                            render={() => null}
                        />

                        <Controller
                            name="member_ids"
                            control={control}
                            rules={{
                                validate: (value) =>
                                    (Array.isArray(value) && value.length > 0) ||
                                    "Add at least one team member.",
                            }}
                            render={() => null}
                        />

                        <div className="space-y-3">
                            <Label className="mb-1 flex flex-row items-center text-label font-medium text-muted-foreground">
                                Members
                                <span className="text-sm text-destructive">*</span>
                            </Label>

                            <div className="relative">
                                <Input
                                    value={memberQuery}
                                    onChange={(event) => setMemberQuery(event.target.value)}
                                    placeholder="Add members by name or email"
                                    autoComplete="off"
                                    startElement={
                                        <Icon name="search-line" className="text-sm text-muted-foreground" />
                                    }
                                />

                                {memberQuery.trim() && memberSuggestions.length > 0 ? (
                                    <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-20 overflow-hidden rounded-md border border-border bg-popover shadow-md">
                                        <ul className="max-h-48 overflow-y-auto py-1">
                                            {memberSuggestions.map((member) => (
                                                <li key={member.id}>
                                                    <button
                                                        type="button"
                                                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent"
                                                        onClick={() => addMember(member.id)}
                                                    >
                                                        <Avatar
                                                            name={member.display_name}
                                                            src={member.avatar || undefined}
                                                            size="sm"
                                                        />
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block truncate text-sm font-medium">
                                                                {member.display_name}
                                                            </span>
                                                            <span className="block truncate text-xs text-muted-foreground">
                                                                {member.title || "Team member"}
                                                            </span>
                                                        </span>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}

                                {memberQuery.trim() && memberSuggestions.length === 0 ? (
                                    <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-20 rounded-md border border-border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md">
                                        No matching people found.
                                    </div>
                                ) : null}
                            </div>

                            {fieldError("member_ids") ? (
                                <div className="text-[13px] text-destructive">
                                    {fieldError("member_ids")}
                                </div>
                            ) : null}
                            {fieldError("leader_id") ? (
                                <div className="text-[13px] text-destructive">
                                    {fieldError("leader_id")}
                                </div>
                            ) : null}

                            {selectedMembers.length === 0 ? (
                                <div
                                    className={cn(
                                        "rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground",
                                        fieldError("member_ids") || fieldError("leader_id")
                                            ? "border-destructive/50"
                                            : "border-border"
                                    )}
                                >
                                    Search and add people to this team.
                                </div>
                            ) : (
                                <ul className="divide-y divide-border rounded-md border border-border">
                                    {selectedMembers.map((member) => {
                                        const isLead = String(leaderId) === String(member.id);

                                        return (
                                            <li
                                                key={member.id}
                                                className="flex items-center gap-3 px-3 py-2.5"
                                            >
                                                <Avatar
                                                    name={member.display_name}
                                                    src={member.avatar || undefined}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="truncate text-sm font-medium">
                                                            {member.display_name}
                                                        </span>
                                                        {isLead ? (
                                                            <Badge variant="secondary" className="rounded-sm">
                                                                Lead
                                                            </Badge>
                                                        ) : null}
                                                    </div>
                                                    <div className="truncate text-xs text-muted-foreground">
                                                        {member.email_address || member.title || "Team member"}
                                                    </div>
                                                </div>

                                                <InlineSelect
                                                    value={isLead ? "lead" : "member"}
                                                    onValueChange={(role) =>
                                                        setMemberRole(member.id, role)
                                                    }
                                                    options={
                                                        isLead
                                                            ? [
                                                                  { value: "lead", label: "Lead" },
                                                                  {
                                                                      value: "member",
                                                                      label: "Member",
                                                                      disabled: true,
                                                                  },
                                                              ]
                                                            : MEMBER_ROLE_OPTIONS
                                                    }
                                                    className="shrink-0"
                                                />

                                                <button
                                                    type="button"
                                                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                                                    aria-label={`Remove ${member.display_name}`}
                                                    onClick={() => removeMember(member.id)}
                                                >
                                                    <Icon name="close-line" className="text-base" />
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                </form>

                <DialogFooter className="border-t border-border px-6 py-4 sm:justify-between">
                    <Button
                        type="button"
                        variant="ghost"
                        className="justify-start px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                        onClick={() => {
                            reset(emptyValues);
                            setMemberQuery("");
                            setServerErrors({});
                        }}
                    >
                        Reset to default
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button type="submit" form="team-form" loading={processing}>
                            {isEditing ? "Save changes" : "Create team"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

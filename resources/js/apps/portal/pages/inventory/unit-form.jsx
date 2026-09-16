import { useEffect, useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { store, update } from "@/actions/App/Http/Controllers/Portal/UnitController";
import { store as storeBlock } from "@/actions/App/Http/Controllers/Portal/ProjectBlockController";
import { Button } from "@/components/ui/button";
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
import {
    InputGroup,
    InputGroupAddon,
    InputGroupNumberInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { ComboBox } from "@/components/ui/combo-box";
import { MetaComboBox } from "@/components/ui/meta-combo-box";
import { SelectBox } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMeta } from "@/hooks/use-meta";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
    { value: "AVAILABLE", label: "Available" },
    { value: "RESERVED", label: "Reserved" },
    { value: "TOKEN", label: "Token" },
    { value: "HOLD", label: "On Hold" },
    { value: "SOLD", label: "Sold" },
    { value: "INACTIVE", label: "Inactive" },
];

const emptyValues = {
    project_id: "",
    block: "",
    name: "",
    type: "",
    sector: "",
    price: null,
    size: null,
    area_type: "",
    status: "AVAILABLE",
    description: "",
};

function getCookie(name) {
    const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
    return match ? decodeURIComponent(match[2]) : null;
}

function jsonHeaders() {
    const headers = {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
    };
    const xsrfToken = getCookie("XSRF-TOKEN");
    if (xsrfToken) {
        headers["X-XSRF-TOKEN"] = xsrfToken;
    }
    return headers;
}

export default function UnitForm({
    isOpen,
    onClose,
    data = null,
    projects = [],
    blocks = [],
    onBlockCreated,
}) {
    const isEditing = Boolean(data?.id);
    const meta = useMeta();
    const [processing, setProcessing] = useState(false);
    const [serverErrors, setServerErrors] = useState({});
    const [localBlocks, setLocalBlocks] = useState(blocks);

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

    const projectId = watch("project_id");

    const projectOptions = useMemo(
        () =>
            projects.map((project) => ({
                value: String(project.id),
                label: project.title,
            })),
        [projects]
    );

    const blockOptions = useMemo(() => {
        return localBlocks
            .filter(
                (block) =>
                    !projectId || String(block.project_id) === String(projectId)
            )
            .map((block) => block.title)
            .filter(Boolean);
    }, [localBlocks, projectId]);

    const fieldError = (name) => serverErrors[name] || errors[name]?.message;

    const handleClose = () => {
        reset(emptyValues);
        setServerErrors({});
        onClose(false);
    };

    useEffect(() => {
        setLocalBlocks(blocks);
    }, [blocks]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setServerErrors({});

        if (data) {
            reset({
                project_id: data.project_id ? String(data.project_id) : "",
                block: data.block?.title ?? "",
                name: data.name ?? "",
                type: data.type ?? "",
                sector: data.sector ?? "",
                price: data.price ?? null,
                size: data.size ?? null,
                area_type: data.area_type ?? "",
                status: data.status ?? "AVAILABLE",
                description: data.description ?? "",
            });
        } else {
            reset(emptyValues);
        }
    }, [isOpen, data, reset]);

    useEffect(() => {
        if (!projectId) {
            return;
        }

        const currentBlock = String(watch("block") || "").trim();

        if (!currentBlock) {
            return;
        }

        const belongsToProject = localBlocks.some(
            (block) =>
                String(block.project_id) === String(projectId) &&
                String(block.title).toLowerCase() === currentBlock.toLowerCase()
        );

        const existsElsewhere = localBlocks.some(
            (block) =>
                String(block.title).toLowerCase() === currentBlock.toLowerCase() &&
                String(block.project_id) !== String(projectId)
        );

        if (!belongsToProject && existsElsewhere) {
            setValue("block", "");
        }
    }, [projectId, localBlocks, setValue, watch]);

    const resolveBlockId = async (title, selectedProjectId) => {
        const trimmed = String(title || "").trim();

        if (!trimmed) {
            return null;
        }

        const existing = localBlocks.find(
            (block) =>
                String(block.project_id) === String(selectedProjectId) &&
                String(block.title).toLowerCase() === trimmed.toLowerCase()
        );

        if (existing) {
            return existing.id;
        }

        const response = await fetch(storeBlock.url(), {
            method: "POST",
            headers: jsonHeaders(),
            credentials: "same-origin",
            body: JSON.stringify({
                project_id: Number(selectedProjectId),
                title: trimmed,
            }),
        });

        const body = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                body?.message ||
                    body?.errors?.title?.[0] ||
                    "Unable to create block"
            );
        }

        const block = body.data;
        setLocalBlocks((current) => [...current, block]);
        onBlockCreated?.(block);

        return block.id;
    };

    const onSubmit = async (values) => {
        setProcessing(true);
        setServerErrors({});

        try {
            const project_block_id = await resolveBlockId(
                values.block,
                values.project_id
            );

            const payload = {
                project_id: Number(values.project_id),
                project_block_id,
                name: values.name || null,
                type: values.type || null,
                sector: values.sector || null,
                price:
                    values.price === "" || values.price == null
                        ? null
                        : Number(values.price),
                size:
                    values.size === "" || values.size == null
                        ? null
                        : Number(values.size),
                area_type: values.area_type || null,
                status: values.status || "AVAILABLE",
                description: values.description || null,
                quantity: 1,
            };

            const visit = {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(isEditing ? "Unit updated" : "Unit created");
                    handleClose();
                },
                onError: (errs) => {
                    setServerErrors(errs || {});
                    toast.error("Please fix the highlighted fields");
                },
                onFinish: () => setProcessing(false),
            };

            if (isEditing) {
                router.put(update.url(data.id), payload, visit);
            } else {
                router.post(store.url(), payload, visit);
            }
        } catch (error) {
            setProcessing(false);
            toast.error(error.message || "Unable to save unit");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
                <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
                    <DialogTitle className="flex items-center gap-2">
                        <Icon name="shape-line" className="text-xl" />
                        {isEditing ? "Edit unit" : "Add unit"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? `Update details for ${data?.code || "this unit"}.`
                            : "Create a sellable inventory unit. Code is assigned automatically."}
                    </DialogDescription>
                </DialogHeader>

                <form
                    className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
                    onSubmit={handleSubmit(onSubmit)}
                >
                    <div className="space-y-4">
                        {isEditing && data?.code ? (
                            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                                <span className="text-muted-foreground">Code </span>
                                <span className="font-medium text-foreground">{data.code}</span>
                            </div>
                        ) : null}

                        <Controller
                            name="project_id"
                            control={control}
                            rules={{ required: "Project is required." }}
                            render={({ field }) => (
                                <SelectBox
                                    label="Project"
                                    required
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    options={projectOptions}
                                    placeholder="Select project..."
                                    error={fieldError("project_id")}
                                />
                            )}
                        />

                        <div className="space-y-2">
                            <Controller
                                name="block"
                                control={control}
                                render={({ field }) => (
                                    <ComboBox
                                        label="Block"
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        options={blockOptions}
                                        placeholder="Type or select block..."
                                        disabled={!projectId}
                                        clearable
                                        error={
                                            fieldError("block") ||
                                            fieldError("project_block_id")
                                        }
                                    />
                                )}
                            />
                            <p className="text-xs text-muted-foreground">
                                Optional. Type a new name to create a block for this project.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Input
                                label="Name / number"
                                placeholder="e.g. 1201 or Plot 45"
                                error={fieldError("name")}
                                {...register("name")}
                            />
                            <Controller
                                name="type"
                                control={control}
                                render={({ field }) => (
                                    <MetaComboBox
                                        label="Type"
                                        metaType="UNIT"
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        placeholder="Apartment, Plot..."
                                        error={fieldError("type")}
                                    />
                                )}
                            />
                        </div>

                        <Input
                            label="Place / location"
                            placeholder="Floor, sector, street, wing..."
                            error={fieldError("sector")}
                            {...register("sector")}
                        />

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Controller
                                name="size"
                                control={control}
                                render={({ field }) => (
                                    <div className="space-y-0.5">
                                        <Label className="mb-0.5 text-base font-medium text-muted-foreground">
                                            Size
                                        </Label>
                                        <InputGroup
                                            className={cn(
                                                fieldError("size") && "border-destructive"
                                            )}
                                        >
                                            <InputGroupNumberInput
                                                value={field.value}
                                                onChange={field.onChange}
                                                allowDecimal
                                                min={0}
                                                placeholder="0"
                                            />
                                            <InputGroupAddon align="inline-end">
                                                <Controller
                                                    name="area_type"
                                                    control={control}
                                                    render={({ field: areaField }) => (
                                                        <SelectBox
                                                            variant="group"
                                                            value={areaField.value}
                                                            onValueChange={areaField.onChange}
                                                            options={meta.AREA ?? []}
                                                            placeholder="Unit"
                                                            error={fieldError("area_type")}
                                                        />
                                                    )}
                                                />
                                            </InputGroupAddon>
                                        </InputGroup>
                                        {fieldError("size") || fieldError("area_type") ? (
                                            <p className="text-sm text-destructive">
                                                {fieldError("size") || fieldError("area_type")}
                                            </p>
                                        ) : null}
                                    </div>
                                )}
                            />

                            <Controller
                                name="price"
                                control={control}
                                render={({ field }) => (
                                    <div className="space-y-0.5">
                                        <Label className="mb-0.5 text-base font-medium text-muted-foreground">
                                            Price
                                        </Label>
                                        <InputGroup
                                            className={cn(
                                                fieldError("price") && "border-destructive"
                                            )}
                                        >
                                            <InputGroupAddon>PKR</InputGroupAddon>
                                            <InputGroupNumberInput
                                                value={field.value}
                                                onChange={field.onChange}
                                                allowDecimal
                                                min={0}
                                                placeholder="0"
                                            />
                                        </InputGroup>
                                        {fieldError("price") ? (
                                            <p className="text-sm text-destructive">
                                                {fieldError("price")}
                                            </p>
                                        ) : null}
                                    </div>
                                )}
                            />
                        </div>

                        <Controller
                            name="status"
                            control={control}
                            rules={{ required: "Status is required." }}
                            render={({ field }) => (
                                <SelectBox
                                    label="Status"
                                    required
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    options={STATUS_OPTIONS}
                                    placeholder="Select status..."
                                    error={fieldError("status")}
                                />
                            )}
                        />

                        <Textarea
                            label="Description"
                            placeholder="Optional notes..."
                            rows={3}
                            error={fieldError("description")}
                            {...register("description")}
                        />
                    </div>
                </form>

                <DialogFooter className="shrink-0 border-t border-border bg-popover px-6 py-4 sm:justify-end">
                    <Button type="button" variant="outline" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        loading={processing}
                        onClick={handleSubmit(onSubmit)}
                    >
                        {isEditing ? "Save changes" : "Create unit"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

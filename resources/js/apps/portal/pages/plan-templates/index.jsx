import { useMemo, useState } from "react";
import { router, useForm } from "@inertiajs/react";
import { toast } from "sonner";
import {
    destroy as destroyTemplate,
    store as storeTemplate,
    update as updateTemplate,
} from "@/actions/App/Http/Controllers/Portal/PaymentPlanTemplateController";
import { index as planTemplatesIndex } from "@/routes/portal/plan-templates";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { isPagePending, PageSkeleton } from "../../components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { FilterInput } from "@/components/ui/filter-input";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { SelectBox } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

function emptyForm() {
    return {
        title: "",
        project_id: "",
        frequency: "monthly",
        installment_count: 12,
        balloon_every: null,
        down_payment_percent: 10,
        handover_percent: 10,
        late_fee_basis: "monthly",
        late_fee_rate: 1,
        is_enabled: true,
    };
}

function optionalNumber(value) {
    if (value === "" || value == null) {
        return null;
    }

    return value;
}

function TemplateFormDialog({ open, template, formOptions, onOpenChange }) {
    const editing = Boolean(template?.id);
    const form = useForm({
        ...emptyForm(),
        ...(template
            ? {
                  title: template.title || "",
                  project_id: template.project_id ? String(template.project_id) : "",
                  frequency: template.frequency || "monthly",
                  installment_count: template.installment_count ?? 12,
                  balloon_every: template.balloon_every ?? null,
                  down_payment_percent: template.down_payment_percent ?? 10,
                  handover_percent: template.handover_percent ?? 10,
                  late_fee_basis: template.late_fee_basis || "",
                  late_fee_rate: template.late_fee_rate ?? null,
                  is_enabled: template.is_enabled !== false,
              }
            : {}),
    });

    const projectOptions = useMemo(
        () =>
            (formOptions.projects || []).map((project) => ({
                value: String(project.id),
                label: project.title,
            })),
        [formOptions.projects],
    );

    const handleClose = () => {
        form.reset(emptyForm());
        onOpenChange(false);
    };

    const submit = (event) => {
        event.preventDefault();
        const payload = {
            ...form.data,
            project_id: form.data.project_id || null,
            balloon_every: optionalNumber(form.data.balloon_every),
            late_fee_basis: form.data.late_fee_basis || null,
            late_fee_rate: optionalNumber(form.data.late_fee_rate),
        };

        const options = {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(editing ? "Template updated" : "Template created");
                handleClose();
            },
            onError: () => toast.error("Unable to save template"),
        };

        if (editing) {
            form.transform(() => payload).put(updateTemplate.url(template.id), options);
        } else {
            form.transform(() => payload).post(storeTemplate.url(), options);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    handleClose();
                }
            }}
        >
            <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
                <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
                    <DialogTitle>
                        {editing ? "Edit template" : "New template"}
                    </DialogTitle>
                    <DialogDescription>
                        {editing
                            ? "Update this reusable payment schedule."
                            : "Create a reusable schedule for booking payment plans."}
                    </DialogDescription>
                </DialogHeader>

                <form
                    id="plan-template-form"
                    className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5"
                    onSubmit={submit}
                >
                    <div className="space-y-1.5">
                        <Label htmlFor="title">Title</Label>
                        <Input
                            id="title"
                            value={form.data.title}
                            onChange={(event) => form.setData("title", event.target.value)}
                            error={form.errors.title}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label>Frequency</Label>
                            <SelectBox
                                value={form.data.frequency}
                                onValueChange={(value) => form.setData("frequency", value)}
                                options={formOptions.frequencies || []}
                            />
                        </div>
                        <NumberInput
                            id="installment_count"
                            label="Installments"
                            min={1}
                            max={120}
                            value={form.data.installment_count}
                            onChange={(value) => form.setData("installment_count", value)}
                            error={form.errors.installment_count}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberInput
                            id="down_payment_percent"
                            label="Down payment %"
                            min={0}
                            max={100}
                            step={0.01}
                            allowDecimal
                            value={form.data.down_payment_percent}
                            onChange={(value) => form.setData("down_payment_percent", value)}
                            error={form.errors.down_payment_percent}
                        />
                        <NumberInput
                            id="handover_percent"
                            label="Handover %"
                            min={0}
                            max={100}
                            step={0.01}
                            allowDecimal
                            value={form.data.handover_percent}
                            onChange={(value) => form.setData("handover_percent", value)}
                            error={form.errors.handover_percent}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberInput
                            id="balloon_every"
                            label="Balloon every (optional)"
                            min={2}
                            max={24}
                            value={form.data.balloon_every}
                            onChange={(value) => form.setData("balloon_every", value)}
                            error={form.errors.balloon_every}
                        />
                        <SelectBox
                            label="Late fee basis"
                            value={form.data.late_fee_basis}
                            onValueChange={(value) => form.setData("late_fee_basis", value)}
                            options={formOptions.late_fee_bases || []}
                            placeholder="None"
                            clearable
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberInput
                            id="late_fee_rate"
                            label="Late fee rate %"
                            min={0}
                            max={100}
                            step={0.0001}
                            allowDecimal
                            value={form.data.late_fee_rate}
                            onChange={(value) => form.setData("late_fee_rate", value)}
                            error={form.errors.late_fee_rate}
                        />
                        <SelectBox
                            label="Project (optional)"
                            value={form.data.project_id}
                            onValueChange={(value) => form.setData("project_id", value)}
                            options={projectOptions}
                            placeholder="All projects"
                            clearable
                        />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                        <div>
                            <p className="text-sm font-medium text-foreground">Enabled</p>
                            <p className="text-xs text-muted-foreground">
                                Available when building booking plans
                            </p>
                        </div>
                        <Switch
                            checked={form.data.is_enabled}
                            onCheckedChange={(checked) => form.setData("is_enabled", checked)}
                        />
                    </div>
                </form>

                <DialogFooter className="shrink-0 border-t border-border bg-popover px-6 py-4">
                    <Button type="button" variant="outline" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="plan-template-form"
                        loading={form.processing}
                    >
                        {editing ? "Save changes" : "Create template"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function PlanTemplatesIndex({ templates = [], filters = {}, formOptions = {} }) {
    const pending = isPagePending(templates);
    const [query, setQuery] = useState(filters.q || "");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);

    if (pending) {
        return <PageSkeleton title="Plan Templates" variant="table" />;
    }

    const openCreate = () => {
        setEditing(null);
        setDialogOpen(true);
    };

    const openEdit = (template) => {
        setEditing(template);
        setDialogOpen(true);
    };

    const remove = (template) => {
        if (template.is_system) {
            toast.error("System templates cannot be deleted");
            return;
        }

        if (!window.confirm(`Delete “${template.title}”?`)) {
            return;
        }

        router.delete(destroyTemplate.url(template.id), {
            preserveScroll: true,
            onSuccess: () => toast.success("Template deleted"),
            onError: () => toast.error("Unable to delete template"),
        });
    };

    return (
        <Layout>
            <Layout.Header
                metaTitle="Plan Templates"
                breadcrumbs={[{ label: "Sales" }, { label: "Plan Templates" }]}
            />
            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar className="justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Plan Templates
                        </h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            Reusable schedules for booking payment plans.
                        </p>
                    </div>
                    <Button type="button" onClick={openCreate}>
                        <Icon name="add-line" />
                        New template
                    </Button>
                </Layout.Toolbar>
                <div className="flex items-center gap-3 border-b border-border/80 px-6 py-3">
                    <FilterInput
                        value={query}
                        onChange={setQuery}
                        onSubmit={(value) =>
                            router.get(
                                planTemplatesIndex.url({ query: { q: value || undefined } }),
                                {},
                                {
                                    preserveState: true,
                                    replace: true,
                                },
                            )
                        }
                        placeholder="Search templates…"
                        className="max-w-sm"
                    />
                </div>
                <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
                    {templates.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-16 text-center text-sm text-muted-foreground">
                            No plan templates yet. Create one to use on bookings.
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-border/80 bg-background">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-border/70 bg-muted/30 text-xs font-medium text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-2.5 font-medium">Template</th>
                                        <th className="px-4 py-2.5 font-medium">Project</th>
                                        <th className="px-4 py-2.5 font-medium">Schedule</th>
                                        <th className="px-4 py-2.5 font-medium">Down / Handover</th>
                                        <th className="px-4 py-2.5 font-medium">Status</th>
                                        <th className="px-4 py-2.5 font-medium" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {templates.map((template) => (
                                        <tr
                                            key={template.id}
                                            className="border-b border-border/60 last:border-b-0 hover:bg-muted/30"
                                        >
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-foreground">
                                                    {template.title}
                                                </div>
                                                {template.is_system ? (
                                                    <span className="text-xs text-muted-foreground">
                                                        System
                                                    </span>
                                                ) : null}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {template.project?.title || "All projects"}
                                            </td>
                                            <td className="px-4 py-3 capitalize text-muted-foreground">
                                                {template.frequency} · {template.installment_count}
                                                {template.balloon_every
                                                    ? ` · balloon /${template.balloon_every}`
                                                    : ""}
                                            </td>
                                            <td className="px-4 py-3 tabular-nums text-muted-foreground">
                                                {template.down_payment_percent}% /{" "}
                                                {template.handover_percent}%
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        template.is_enabled
                                                            ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                                                            : "text-muted-foreground",
                                                    )}
                                                >
                                                    {template.is_enabled ? "Enabled" : "Disabled"}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="inline-flex gap-1">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => openEdit(template)}
                                                    >
                                                        Edit
                                                    </Button>
                                                    {!template.is_system ? (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-destructive"
                                                            onClick={() => remove(template)}
                                                        >
                                                            Delete
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </Layout.Content>

            {dialogOpen ? (
                <TemplateFormDialog
                    key={editing?.id || "create"}
                    open={dialogOpen}
                    template={editing}
                    formOptions={formOptions}
                    onOpenChange={setDialogOpen}
                />
            ) : null}
        </Layout>
    );
}

PlanTemplatesIndex.layout = (page) => <PortalLayout children={page} />;

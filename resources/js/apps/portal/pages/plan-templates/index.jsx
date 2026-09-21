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
import { SelectBox } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

function emptyForm() {
    return {
        title: "",
        project_id: "",
        frequency: "monthly",
        installment_count: "12",
        balloon_every: "",
        down_payment_percent: "10",
        handover_percent: "10",
        late_fee_basis: "monthly",
        late_fee_rate: "1",
        is_enabled: true,
    };
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
                  installment_count: String(template.installment_count ?? 12),
                  balloon_every:
                      template.balloon_every != null ? String(template.balloon_every) : "",
                  down_payment_percent: String(template.down_payment_percent ?? 10),
                  handover_percent: String(template.handover_percent ?? 10),
                  late_fee_basis: template.late_fee_basis || "",
                  late_fee_rate:
                      template.late_fee_rate != null ? String(template.late_fee_rate) : "",
                  is_enabled: template.is_enabled !== false,
              }
            : {}),
    });

    const projectOptions = useMemo(
        () => [
            { value: "", label: "All projects" },
            ...(formOptions.projects || []).map((project) => ({
                value: String(project.id),
                label: project.title,
            })),
        ],
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
            balloon_every: form.data.balloon_every || null,
            late_fee_basis: form.data.late_fee_basis || null,
            late_fee_rate: form.data.late_fee_rate || null,
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
                    <div className="space-y-1.5">
                        <Label>Project (optional)</Label>
                        <SelectBox
                            value={form.data.project_id}
                            onValueChange={(value) => form.setData("project_id", value)}
                            options={projectOptions}
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
                        <div className="space-y-1.5">
                            <Label htmlFor="installment_count">Installments</Label>
                            <Input
                                id="installment_count"
                                type="number"
                                min="1"
                                value={form.data.installment_count}
                                onChange={(event) =>
                                    form.setData("installment_count", event.target.value)
                                }
                                error={form.errors.installment_count}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="down_payment_percent">Down payment %</Label>
                            <Input
                                id="down_payment_percent"
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={form.data.down_payment_percent}
                                onChange={(event) =>
                                    form.setData("down_payment_percent", event.target.value)
                                }
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="handover_percent">Handover %</Label>
                            <Input
                                id="handover_percent"
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={form.data.handover_percent}
                                onChange={(event) =>
                                    form.setData("handover_percent", event.target.value)
                                }
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="balloon_every">Balloon every (optional)</Label>
                            <Input
                                id="balloon_every"
                                type="number"
                                min="2"
                                value={form.data.balloon_every}
                                onChange={(event) =>
                                    form.setData("balloon_every", event.target.value)
                                }
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Late fee basis</Label>
                            <SelectBox
                                value={form.data.late_fee_basis}
                                onValueChange={(value) =>
                                    form.setData("late_fee_basis", value)
                                }
                                options={[
                                    { value: "", label: "None" },
                                    ...(formOptions.late_fee_bases || []),
                                ]}
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="late_fee_rate">Late fee rate %</Label>
                        <Input
                            id="late_fee_rate"
                            type="number"
                            min="0"
                            step="0.0001"
                            value={form.data.late_fee_rate}
                            onChange={(event) =>
                                form.setData("late_fee_rate", event.target.value)
                            }
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
                breadcrumbs={[{ label: "Operations" }, { label: "Plan Templates" }]}
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

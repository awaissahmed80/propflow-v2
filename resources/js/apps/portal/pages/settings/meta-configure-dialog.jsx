import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SelectBox } from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ToggleRow } from "./integration-card";
import { defaultLeadSettings } from "./integrations-helpers";

export function MetaConfigureDialog({
    open,
    onOpenChange,
    integration,
    stages = [],
    assignees = [],
    processing,
    onSave,
}) {
    const [form, setForm] = useState(() => defaultLeadSettings(integration, stages));

    useEffect(() => {
        if (!open) {
            return;
        }

        setForm(defaultLeadSettings(integration, stages));
    }, [open, integration, stages]);

    if (!integration) {
        return null;
    }

    const syncOptions = [
        { value: "realtime", label: "Real-time" },
        { value: "hourly", label: "Hourly" },
        { value: "daily", label: "Daily" },
    ];

    const ownerOptions = [
        { value: "round_robin", label: "Auto-assign (round robin)" },
        ...assignees.map((user) => ({
            value: String(user.id),
            label: user.display_name,
        })),
    ];

    const stageOptions = stages.map((stage) => ({
        value: String(stage.id),
        label: stage.title,
    }));

    const pageOptions = (integration.pages || []).map((page) => ({
        value: String(page.id),
        label: page.instagram?.username
            ? `${page.name} · @${page.instagram.username}`
            : page.name,
    }));

    const updateField = (key, value) => {
        setForm((current) => ({ ...current, [key]: value }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
                <DialogHeader className="border-b border-border px-6 py-4">
                    <div className="flex items-start gap-3 pr-6">
                        <span
                            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                            style={{ backgroundColor: integration.brand_color || "#0866FF" }}
                        >
                            <Icon name={integration.icon || "meta-fill"} className="text-lg" />
                        </span>
                        <div className="min-w-0">
                            <DialogTitle>Configure Meta</DialogTitle>
                            <DialogDescription className="mt-0.5">
                                Lead Ads, Messenger & Instagram
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4 px-6 py-5">
                    {integration.last_error ? (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                            {integration.last_error}
                        </div>
                    ) : null}

                    {pageOptions.length > 1 ? (
                        <SelectBox
                            label="Primary Facebook Page"
                            value={form.page_id}
                            onValueChange={(value) => updateField("page_id", value)}
                            options={pageOptions}
                            placeholder="Select page"
                        />
                    ) : null}

                    <SelectBox
                        label="Sync frequency"
                        value={form.sync_frequency}
                        onValueChange={(value) => updateField("sync_frequency", value)}
                        options={syncOptions}
                        placeholder="Select"
                    />

                    <SelectBox
                        label="Default owner for new leads"
                        value={form.default_owner}
                        onValueChange={(value) => updateField("default_owner", value)}
                        options={ownerOptions}
                        placeholder="Select"
                    />

                    <SelectBox
                        label="Default pipeline stage"
                        value={form.default_lead_stage_id}
                        onValueChange={(value) => updateField("default_lead_stage_id", value)}
                        options={stageOptions}
                        placeholder="Select"
                    />

                    <div className="rounded-lg border border-border/70 px-4">
                        <ToggleRow
                            title="Notify On New Leads"
                            description="Send a Slack/email alert when a lead syncs in"
                            checked={form.notify_on_new_leads}
                            disabled={processing}
                            onCheckedChange={(checked) =>
                                updateField("notify_on_new_leads", Boolean(checked))
                            }
                        />
                        <ToggleRow
                            title="Deduplicate By Email"
                            description="Skip creating a lead if the email already exists"
                            checked={form.deduplicate_by_email}
                            disabled={processing}
                            onCheckedChange={(checked) =>
                                updateField("deduplicate_by_email", Boolean(checked))
                            }
                        />
                        <ToggleRow
                            title="Auto-Tag Source"
                            description="Tag every synced lead with this integration's name"
                            checked={form.auto_tag_source}
                            disabled={processing}
                            last
                            onCheckedChange={(checked) =>
                                updateField("auto_tag_source", Boolean(checked))
                            }
                        />
                    </div>
                </div>

                <DialogFooter className="border-t border-border bg-popover px-6 py-4">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={processing}
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        loading={processing}
                        disabled={!form.default_lead_stage_id}
                        onClick={() => onSave(form)}
                    >
                        Save changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

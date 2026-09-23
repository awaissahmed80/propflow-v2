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
import { defaultWhatsAppLeadSettings } from "./integrations-helpers";

export function WhatsAppConfigureDialog({
    open,
    onOpenChange,
    integration,
    stages = [],
    assignees = [],
    processing,
    onSave,
}) {
    const [form, setForm] = useState(() => defaultWhatsAppLeadSettings(integration, stages));

    useEffect(() => {
        if (!open) {
            return;
        }

        setForm(defaultWhatsAppLeadSettings(integration, stages));
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

    const phoneOptions = (integration.phones || []).map((phone) => ({
        value: String(phone.id),
        label: phone.verified_name
            ? `${phone.display_phone_number} · ${phone.verified_name}`
            : phone.display_phone_number,
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
                            style={{ backgroundColor: integration.brand_color || "#25D366" }}
                        >
                            <Icon name={integration.icon || "whatsapp-fill"} className="text-lg" />
                        </span>
                        <div className="min-w-0">
                            <DialogTitle>Configure WhatsApp</DialogTitle>
                            <DialogDescription className="mt-0.5">
                                Campaign intake from WhatsApp messages
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4 px-6 py-5">
                    <p className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                        {integration.billing_disclaimer ||
                            "Propflow connects your WhatsApp Business account. Message and conversation charges are billed by Meta to your business account."}
                    </p>

                    {integration.last_error ? (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                            {integration.last_error}
                        </div>
                    ) : null}

                    {phoneOptions.length > 0 ? (
                        <SelectBox
                            label="Primary WhatsApp number"
                            value={form.phone_number_id}
                            onValueChange={(value) => updateField("phone_number_id", value)}
                            options={phoneOptions}
                            placeholder="Select number"
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
                            description="Send an alert when a WhatsApp lead syncs in"
                            checked={form.notify_on_new_leads}
                            disabled={processing}
                            onCheckedChange={(checked) =>
                                updateField("notify_on_new_leads", Boolean(checked))
                            }
                        />
                        <ToggleRow
                            title="Deduplicate By Phone"
                            description="Append to an open campaign lead when the same number messages again"
                            checked={form.deduplicate_by_phone}
                            disabled={processing}
                            onCheckedChange={(checked) =>
                                updateField("deduplicate_by_phone", Boolean(checked))
                            }
                        />
                        <ToggleRow
                            title="Auto-Tag Source"
                            description="Tag every synced lead as WhatsApp"
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

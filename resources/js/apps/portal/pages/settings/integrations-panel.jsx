import { useEffect, useMemo, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import { toast } from "sonner";
import {
    disconnect as disconnectMeta,
    redirect as connectMeta,
    update as updateMeta,
} from "@/actions/App/Http/Controllers/Portal/MetaIntegrationController";
import {
    disconnect as disconnectWhatsApp,
    redirect as connectWhatsApp,
    update as updateWhatsApp,
} from "@/actions/App/Http/Controllers/Portal/WhatsAppIntegrationController";
import { IntegrationCard } from "./integration-card";
import { pathFrom } from "./integrations-helpers";
import { MetaConfigureDialog } from "./meta-configure-dialog";
import { WhatsAppConfigureDialog } from "./whatsapp-configure-dialog";

export default function IntegrationsPanel({
    integrations = [],
    stages = [],
    assignees = [],
}) {
    const page = usePage();
    const [processing, setProcessing] = useState(false);
    const [configureOpen, setConfigureOpen] = useState(false);
    const [activeProvider, setActiveProvider] = useState("meta");

    const items = useMemo(() => integrations, [integrations]);
    const meta = items.find((item) => item.provider === "meta");
    const whatsapp = items.find((item) => item.provider === "whatsapp");
    const active = items.find((item) => item.provider === activeProvider) || meta;

    useEffect(() => {
        const success = page.props?.flash?.success;
        const error = page.props?.flash?.error;

        if (typeof success === "string" && success) {
            toast.success(success);
        }

        if (typeof error === "string" && error) {
            toast.error(error);
        }

        if (page.props?.flash?.open_meta_config && meta?.status === "connected") {
            setActiveProvider("meta");
            setConfigureOpen(true);
        }

        if (page.props?.flash?.open_whatsapp_config && whatsapp?.status === "connected") {
            setActiveProvider("whatsapp");
            setConfigureOpen(true);
        }
    }, [
        page.props?.flash?.success,
        page.props?.flash?.error,
        page.props?.flash?.open_meta_config,
        page.props?.flash?.open_whatsapp_config,
        meta?.status,
        whatsapp?.status,
    ]);

    const startConnect = (integration) => {
        if (integration.provider === "meta") {
            window.location.href = pathFrom(connectMeta.url());
            return;
        }

        if (integration.provider === "whatsapp") {
            window.location.href = pathFrom(connectWhatsApp.url());
        }
    };

    const openConfigure = (integration) => {
        setActiveProvider(integration.provider);
        setConfigureOpen(true);
    };

    const handleDisconnect = async (integration) => {
        if (integration.provider === "meta") {
            const confirmed = await confirm(
                "Disconnect Meta Lead Ads? Incoming lead webhooks will stop until you reconnect.",
                "Disconnect Meta"
            );

            if (!confirmed) {
                return;
            }

            setProcessing(true);
            router.delete(pathFrom(disconnectMeta.url()), {
                preserveScroll: true,
                onSuccess: () => toast.success("Meta disconnected"),
                onError: (errors) => toast.error(errors.message || "Unable to disconnect"),
                onFinish: () => setProcessing(false),
            });
            return;
        }

        if (integration.provider === "whatsapp") {
            const confirmed = await confirm(
                "Disconnect WhatsApp Business? Incoming campaign messages will stop until you reconnect.",
                "Disconnect WhatsApp"
            );

            if (!confirmed) {
                return;
            }

            setProcessing(true);
            router.delete(pathFrom(disconnectWhatsApp.url()), {
                preserveScroll: true,
                onSuccess: () => toast.success("WhatsApp disconnected"),
                onError: (errors) => toast.error(errors.message || "Unable to disconnect"),
                onFinish: () => setProcessing(false),
            });
        }
    };

    const handleSaveMetaConfig = (form) => {
        setProcessing(true);
        router.put(
            pathFrom(updateMeta.url()),
            {
                sync_frequency: form.sync_frequency,
                default_owner: form.default_owner,
                default_lead_stage_id: Number(form.default_lead_stage_id),
                notify_on_new_leads: form.notify_on_new_leads,
                deduplicate_by_email: form.deduplicate_by_email,
                auto_tag_source: form.auto_tag_source,
                page_id: form.page_id || null,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success("Meta Lead Ads settings saved");
                    setConfigureOpen(false);
                },
                onError: (errors) =>
                    toast.error(
                        errors.default_lead_stage_id ||
                            errors.default_owner ||
                            errors.page_id ||
                            errors.message ||
                            "Unable to save settings"
                    ),
                onFinish: () => setProcessing(false),
            }
        );
    };

    const handleSaveWhatsAppConfig = (form) => {
        setProcessing(true);
        router.put(
            pathFrom(updateWhatsApp.url()),
            {
                sync_frequency: form.sync_frequency,
                default_owner: form.default_owner,
                default_lead_stage_id: Number(form.default_lead_stage_id),
                notify_on_new_leads: form.notify_on_new_leads,
                deduplicate_by_phone: form.deduplicate_by_phone,
                auto_tag_source: form.auto_tag_source,
                phone_number_id: form.phone_number_id || null,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success("WhatsApp settings saved");
                    setConfigureOpen(false);
                },
                onError: (errors) =>
                    toast.error(
                        errors.default_lead_stage_id ||
                            errors.default_owner ||
                            errors.phone_number_id ||
                            errors.message ||
                            "Unable to save settings"
                    ),
                onFinish: () => setProcessing(false),
            }
        );
    };

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                    Integrations
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                    Connect lead sources and sync your CRM automatically.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map((integration) => (
                    <IntegrationCard
                        key={integration.provider}
                        integration={integration}
                        onConnect={startConnect}
                        onConfigure={openConfigure}
                        onDisconnect={handleDisconnect}
                    />
                ))}
            </div>

            {activeProvider === "whatsapp" ? (
                <WhatsAppConfigureDialog
                    open={configureOpen}
                    onOpenChange={setConfigureOpen}
                    integration={active}
                    stages={stages}
                    assignees={assignees}
                    processing={processing}
                    onSave={handleSaveWhatsAppConfig}
                />
            ) : (
                <MetaConfigureDialog
                    open={configureOpen}
                    onOpenChange={setConfigureOpen}
                    integration={active}
                    stages={stages}
                    assignees={assignees}
                    processing={processing}
                    onSave={handleSaveMetaConfig}
                />
            )}
        </div>
    );
}

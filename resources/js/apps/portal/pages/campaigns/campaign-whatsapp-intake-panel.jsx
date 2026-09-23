import { AccordionContent, AccordionItem } from '@/components/ui/accordion';
import { ToolPanel, ToolTrigger } from './campaign-details-shared';

export function CampaignWhatsAppIntakePanel({ campaign }) {
    return (
        <AccordionItem value="whatsapp-intake" className="border-border/70">
            <ToolTrigger icon="whatsapp-fill" label="WhatsApp intake" />
            <AccordionContent className="pt-0 pb-0 [&_p:not(:last-child)]:mb-0">
                <ToolPanel>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        Leads arrive from WhatsApp Cloud API webhooks. Messaging
                        charges are billed by Meta to your WhatsApp Business
                        account.
                    </p>
                    <dl className="space-y-3 rounded-lg border border-border/70 bg-muted/10 p-3">
                        <div>
                            <dt className="text-xs text-muted-foreground">
                                WhatsApp number
                            </dt>
                            <dd className="text-sm font-medium text-foreground">
                                {campaign.source_config?.phone_name
                                    ? `${campaign.source_config.phone_number || campaign.source_config.phone_number_id} · ${campaign.source_config.phone_name}`
                                    : campaign.source_config?.phone_number ||
                                      campaign.source_config?.phone_number_id ||
                                      '—'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">
                                WABA ID
                            </dt>
                            <dd className="text-sm font-medium text-foreground">
                                {campaign.source_config?.waba_id || '—'}
                            </dd>
                        </div>
                    </dl>
                </ToolPanel>
            </AccordionContent>
        </AccordionItem>
    );
}

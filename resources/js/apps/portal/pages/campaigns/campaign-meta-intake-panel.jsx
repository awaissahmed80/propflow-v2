import { AccordionContent, AccordionItem } from '@/components/ui/accordion';
import { ToolPanel, ToolTrigger } from './campaign-details-shared';

export function CampaignMetaIntakePanel({ campaign }) {
    return (
        <AccordionItem value="meta-intake" className="border-border/70">
            <ToolTrigger icon="meta-fill" label="Meta intake" />
            <AccordionContent className="pt-0 pb-0 [&_p:not(:last-child)]:mb-0">
                <ToolPanel>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        Leads arrive from Meta Lead Ads webhooks. No Propflow
                        form, embed snippet, or landing page is used for this
                        campaign.
                    </p>
                    <dl className="space-y-3 rounded-lg border border-border/70 bg-muted/10 p-3">
                        <div>
                            <dt className="text-xs text-muted-foreground">
                                Facebook Page
                            </dt>
                            <dd className="text-sm font-medium text-foreground">
                                {campaign.source_config?.page_name ||
                                    campaign.source_config?.page_id ||
                                    '—'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">
                                Lead form
                            </dt>
                            <dd className="text-sm font-medium text-foreground">
                                {campaign.source_config?.form_name ||
                                    campaign.source_config?.form_id ||
                                    'All forms on this Page'}
                            </dd>
                        </div>
                    </dl>
                </ToolPanel>
            </AccordionContent>
        </AccordionItem>
    );
}

import { AccordionContent, AccordionItem } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { SelectBox } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    FieldGrid,
    FieldLabel,
    MoneyField,
    PanelActions,
    ToolPanel,
    ToolTrigger,
} from './campaign-details-shared';

export function CampaignSettingsPanel({
    campaignMeta,
    setCampaignMeta,
    statusOptions,
    projectOptions,
    purposeOptions,
    channelOptions,
    currencySymbol,
    processing,
    onSave,
}) {
    return (
        <AccordionItem value="settings" className="border-border/70">
            <ToolTrigger icon="settings-3-line" label="Settings" />
            <AccordionContent className="pt-0 pb-0 [&_p:not(:last-child)]:mb-0">
                <ToolPanel>
                    <Input
                        label="Title"
                        value={campaignMeta.title}
                        onChange={(event) =>
                            setCampaignMeta((current) => ({
                                ...current,
                                title: event.target.value,
                            }))
                        }
                    />
                    <FieldGrid>
                        <SelectBox
                            label="Status"
                            value={campaignMeta.status}
                            onValueChange={(value) =>
                                setCampaignMeta((current) => ({
                                    ...current,
                                    status: value,
                                }))
                            }
                            options={statusOptions}
                            placeholder="Select"
                        />
                        <SelectBox
                            label="Project"
                            value={campaignMeta.project_id}
                            onValueChange={(value) =>
                                setCampaignMeta((current) => ({
                                    ...current,
                                    project_id: value ?? '',
                                }))
                            }
                            options={projectOptions}
                            placeholder="Optional"
                            clearable
                        />
                        <SelectBox
                            label="Purpose"
                            value={campaignMeta.purpose}
                            onValueChange={(value) =>
                                setCampaignMeta((current) => ({
                                    ...current,
                                    purpose: value,
                                }))
                            }
                            options={purposeOptions}
                            placeholder="Select"
                        />
                        <SelectBox
                            label="Channel"
                            value={campaignMeta.channel}
                            onValueChange={(value) =>
                                setCampaignMeta((current) => ({
                                    ...current,
                                    channel: value,
                                }))
                            }
                            options={channelOptions}
                            placeholder="Select"
                        />
                        <MoneyField
                            label="Budget"
                            value={campaignMeta.budget}
                            onChange={(value) =>
                                setCampaignMeta((current) => ({
                                    ...current,
                                    budget: value,
                                }))
                            }
                            currencySymbol={currencySymbol}
                        />
                        <MoneyField
                            label="Target CPL"
                            value={campaignMeta.target_cpl}
                            onChange={(value) =>
                                setCampaignMeta((current) => ({
                                    ...current,
                                    target_cpl: value,
                                }))
                            }
                            currencySymbol={currencySymbol}
                        />
                    </FieldGrid>
                    <div className="space-y-0.5">
                        <FieldLabel>Description</FieldLabel>
                        <Textarea
                            rows={3}
                            value={campaignMeta.description}
                            onChange={(event) =>
                                setCampaignMeta((current) => ({
                                    ...current,
                                    description: event.target.value,
                                }))
                            }
                        />
                    </div>
                    <PanelActions processing={processing} onSave={onSave} />
                </ToolPanel>
            </AccordionContent>
        </AccordionItem>
    );
}

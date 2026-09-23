import { AccordionContent, AccordionItem } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { SelectBox } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    FieldGrid,
    FieldLabel,
    PanelActions,
    ToolPanel,
    ToolTrigger,
} from './campaign-details-shared';

export function CampaignFormPanel({
    form,
    formState,
    setFormState,
    formStatusOptions,
    stageOptions,
    assigneeOptions,
    toggleField,
    processing,
    onSave,
}) {
    return (
        <AccordionItem value="form" className="border-border/70">
            <ToolTrigger icon="file-list-3-line" label="Form" />
            <AccordionContent className="pt-0 pb-0 [&_p:not(:last-child)]:mb-0">
                <ToolPanel>
                    {!form ? (
                        <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-5 text-center text-sm text-muted-foreground">
                            No form attached to this campaign yet.
                        </p>
                    ) : (
                        <>
                            <FieldGrid>
                                <Input
                                    label="Form name"
                                    value={formState.name}
                                    onChange={(event) =>
                                        setFormState((current) => ({
                                            ...current,
                                            name: event.target.value,
                                        }))
                                    }
                                />
                                <SelectBox
                                    label="Status"
                                    value={formState.status}
                                    onValueChange={(value) =>
                                        setFormState((current) => ({
                                            ...current,
                                            status: value,
                                        }))
                                    }
                                    options={formStatusOptions}
                                    placeholder="Select"
                                />
                            </FieldGrid>
                            <div className="space-y-1 rounded-lg border border-border/70 bg-muted/10 p-3">
                                <FieldLabel>Fields</FieldLabel>
                                <div className="divide-y divide-border/60">
                                    {formState.fields.map((field) => (
                                        <div
                                            key={field.key}
                                            className="flex items-center justify-between gap-2 py-2.5 first:pt-1 last:pb-0"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-foreground">
                                                    {field.label}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {field.key}
                                                    {field.required
                                                        ? ' · required'
                                                        : ''}
                                                </p>
                                            </div>
                                            <Checkbox
                                                checked={Boolean(field.enabled)}
                                                onCheckedChange={(checked) =>
                                                    toggleField(
                                                        field.key,
                                                        checked,
                                                    )
                                                }
                                            >
                                                Enabled
                                            </Checkbox>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <FieldGrid>
                                <Input
                                    label="Source label"
                                    value={formState.settings.source}
                                    onChange={(event) =>
                                        setFormState((current) => ({
                                            ...current,
                                            settings: {
                                                ...current.settings,
                                                source: event.target.value,
                                            },
                                        }))
                                    }
                                />
                                <Input
                                    label="Submit button"
                                    value={formState.settings.button_label}
                                    onChange={(event) =>
                                        setFormState((current) => ({
                                            ...current,
                                            settings: {
                                                ...current.settings,
                                                button_label:
                                                    event.target.value,
                                            },
                                        }))
                                    }
                                />
                                <SelectBox
                                    label="Default stage"
                                    value={formState.settings.lead_stage_id}
                                    onValueChange={(value) =>
                                        setFormState((current) => ({
                                            ...current,
                                            settings: {
                                                ...current.settings,
                                                lead_stage_id: value ?? '',
                                            },
                                        }))
                                    }
                                    options={stageOptions}
                                    placeholder="Select"
                                    clearable
                                />
                                <SelectBox
                                    label="Default assignee"
                                    value={formState.settings.assigned_to}
                                    onValueChange={(value) =>
                                        setFormState((current) => ({
                                            ...current,
                                            settings: {
                                                ...current.settings,
                                                assigned_to: value ?? '',
                                            },
                                        }))
                                    }
                                    options={assigneeOptions}
                                    placeholder="Optional"
                                    clearable
                                />
                            </FieldGrid>
                            <div className="space-y-0.5">
                                <FieldLabel>Thank-you message</FieldLabel>
                                <Textarea
                                    rows={2}
                                    value={formState.settings.thank_you_message}
                                    onChange={(event) =>
                                        setFormState((current) => ({
                                            ...current,
                                            settings: {
                                                ...current.settings,
                                                thank_you_message:
                                                    event.target.value,
                                            },
                                        }))
                                    }
                                />
                            </div>
                            <PanelActions
                                processing={processing}
                                onSave={onSave}
                                label="Save form"
                            />
                        </>
                    )}
                </ToolPanel>
            </AccordionContent>
        </AccordionItem>
    );
}

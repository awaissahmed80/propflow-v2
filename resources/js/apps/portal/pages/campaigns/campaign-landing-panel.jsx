import { AccordionContent, AccordionItem } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    copyText,
    FieldGrid,
    FieldLabel,
    PanelActions,
    ToolPanel,
    ToolTrigger,
} from './campaign-details-shared';

export function CampaignLandingPanel({
    landing,
    setLanding,
    landingUrl,
    processing,
    onSave,
}) {
    return (
        <AccordionItem value="landing" className="border-border/70">
            <ToolTrigger icon="global-line" label="Landing Page" />
            <AccordionContent className="pt-0 pb-0 [&_p:not(:last-child)]:mb-0">
                <ToolPanel>
                    {landingUrl ? (
                        <div className="space-y-0.5">
                            <FieldLabel>Landing URL</FieldLabel>
                            <div className="flex gap-2">
                                <Input readOnly value={landingUrl} />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0"
                                    onClick={() =>
                                        copyText(
                                            landingUrl,
                                            'Landing URL copied',
                                        )
                                    }
                                >
                                    Copy
                                </Button>
                            </div>
                        </div>
                    ) : null}
                    <Input
                        label="Headline"
                        value={landing.headline}
                        onChange={(event) =>
                            setLanding((current) => ({
                                ...current,
                                headline: event.target.value,
                            }))
                        }
                    />
                    <Input
                        label="Subheadline"
                        value={landing.subheadline}
                        onChange={(event) =>
                            setLanding((current) => ({
                                ...current,
                                subheadline: event.target.value,
                            }))
                        }
                    />
                    <div className="space-y-0.5">
                        <FieldLabel>Body</FieldLabel>
                        <Textarea
                            rows={3}
                            value={landing.body}
                            onChange={(event) =>
                                setLanding((current) => ({
                                    ...current,
                                    body: event.target.value,
                                }))
                            }
                        />
                    </div>
                    <div className="space-y-0.5">
                        <FieldLabel>Highlights (one per line)</FieldLabel>
                        <Textarea
                            rows={3}
                            value={landing.highlights}
                            onChange={(event) =>
                                setLanding((current) => ({
                                    ...current,
                                    highlights: event.target.value,
                                }))
                            }
                        />
                    </div>
                    <FieldGrid>
                        <Input
                            label="CTA label"
                            value={landing.cta_label}
                            onChange={(event) =>
                                setLanding((current) => ({
                                    ...current,
                                    cta_label: event.target.value,
                                }))
                            }
                        />
                        <Input
                            label="Redirect URL"
                            value={landing.redirect_url}
                            onChange={(event) =>
                                setLanding((current) => ({
                                    ...current,
                                    redirect_url: event.target.value,
                                }))
                            }
                        />
                    </FieldGrid>
                    <div className="space-y-0.5">
                        <FieldLabel>Thank-you message</FieldLabel>
                        <Textarea
                            rows={2}
                            value={landing.thank_you_message}
                            onChange={(event) =>
                                setLanding((current) => ({
                                    ...current,
                                    thank_you_message: event.target.value,
                                }))
                            }
                        />
                    </div>
                    <PanelActions
                        processing={processing}
                        onSave={onSave}
                        label="Save landing"
                    />
                </ToolPanel>
            </AccordionContent>
        </AccordionItem>
    );
}

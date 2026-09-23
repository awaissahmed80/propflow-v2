import { AccordionContent, AccordionItem } from '@/components/ui/accordion';
import { IconButton } from '@/components/ui/icon-button';
import { copyText, ToolPanel, ToolTrigger } from './campaign-details-shared';

export function CampaignEmbedPanel({ snippet }) {
    return (
        <AccordionItem value="embed" className="border-border/70">
            <ToolTrigger icon="code-s-slash-line" label="Embed Code" />
            <AccordionContent className="pt-0 pb-0 [&_p:not(:last-child)]:mb-0">
                <ToolPanel>
                    <div className="relative rounded-lg border border-border/70 bg-muted/30 p-3">
                        <IconButton
                            type="button"
                            size="sm"
                            variant="ghost"
                            icon="file-copy-line"
                            aria-label="Copy embed code"
                            className="absolute top-2 right-2"
                            onClick={() =>
                                copyText(snippet, 'Embed snippet copied')
                            }
                        />
                        <pre className="max-h-48 overflow-auto pr-8 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
                            {snippet || 'No embed snippet available yet.'}
                        </pre>
                    </div>
                    <div className="space-y-2">
                        <p className="text-xs font-medium text-foreground">
                            Follow the steps below to embed the PropFlow
                            campaign form on your website or landing page.
                        </p>
                        <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">
                            <li>Copy the embed code above.</li>
                            <li>
                                Paste the code in the HTML of your website or
                                landing page.
                            </li>
                            <li>
                                Reload the page in a browser — the form should
                                now appear in place of the{' '}
                                <code className="rounded bg-muted px-1">
                                    #propflow-form
                                </code>{' '}
                                div.
                            </li>
                        </ol>
                    </div>
                </ToolPanel>
            </AccordionContent>
        </AccordionItem>
    );
}

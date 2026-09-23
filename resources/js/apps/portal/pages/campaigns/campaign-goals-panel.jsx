import { AccordionContent, AccordionItem } from '@/components/ui/accordion';
import {
    GoalRow,
    PanelActions,
    ToolPanel,
    ToolTrigger,
} from './campaign-details-shared';

export function CampaignGoalsPanel({
    goalRows,
    updateGoal,
    processing,
    onSave,
}) {
    return (
        <AccordionItem value="goals" className="border-border/70">
            <ToolTrigger icon="flag-line" label="Goals" />
            <AccordionContent className="pt-0 pb-0 [&_p:not(:last-child)]:mb-0">
                <ToolPanel>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        Enable a metric and set its target. Goal types are
                        managed in Settings → Campaigns.
                    </p>
                    {goalRows.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-5 text-center text-sm text-muted-foreground">
                            No goal types configured yet.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {goalRows.map((goal) => (
                                <GoalRow
                                    key={goal.key}
                                    label={goal.label}
                                    color={goal.color}
                                    enabled={goal.enabled}
                                    target={goal.target}
                                    onEnabledChange={(enabled) =>
                                        updateGoal(goal.key, { enabled })
                                    }
                                    onTargetChange={(target) =>
                                        updateGoal(goal.key, { target })
                                    }
                                />
                            ))}
                        </div>
                    )}
                    <PanelActions
                        processing={processing}
                        onSave={onSave}
                        label="Save goals"
                    />
                </ToolPanel>
            </AccordionContent>
        </AccordionItem>
    );
}

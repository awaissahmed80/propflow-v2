<?php

namespace App\Services;

use App\Models\Lead;
use App\Models\LeadActionType;
use App\Models\LeadStage;
use App\Models\Task;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

class LeadScoreCalculator
{
    /**
     * Compute and optionally persist win-probability score (0–100).
     */
    public function apply(Lead $lead, bool $save = true): int
    {
        $score = $this->score($lead);

        $lead->forceFill(['score' => $score]);

        if ($save) {
            $lead->saveQuietly();
        }

        return $score;
    }

    /**
     * Win probability 0–100 from stage, heat, engagement, follow-up, and commercial fit.
     */
    public function score(Lead $lead): int
    {
        if ($lead->isArchived()) {
            return 5;
        }

        $stageLabel = $this->stageLabel($lead);

        if ($stageLabel === 'closed_lost') {
            return 5;
        }

        if ($stageLabel === 'closed_won' || $lead->hasActiveDeal()) {
            return 98;
        }

        $weighted = (0.35 * $this->stageScore($lead))
            + (0.20 * $this->heatScore($lead))
            + (0.25 * $this->engagement($lead))
            + (0.10 * $this->followUpScore($lead))
            + (0.10 * $this->commercialScore($lead));

        return (int) max(0, min(100, round($weighted)));
    }

    /**
     * Live engagement 0–100 from recent activity (not persisted).
     */
    public function engagement(Lead $lead): int
    {
        $recency = $this->recencyScore($lead);
        $volume = $this->activityVolumeScore($lead);
        $intent = $this->intentScore($lead);

        $value = (0.45 * $recency) + (0.35 * $volume) + (0.20 * $intent);

        return (int) max(0, min(100, round($value)));
    }

    protected function stageScore(Lead $lead): float
    {
        $label = $this->stageLabel($lead);

        return match ($label) {
            'new' => 15.0,
            'contacted' => 30.0,
            'qualified' => 50.0,
            'site_visit' => 70.0,
            'negotiation' => 85.0,
            'closed_won' => 100.0,
            'closed_lost' => 0.0,
            default => $this->stageScoreFromPriority($lead),
        };
    }

    protected function stageScoreFromPriority(Lead $lead): float
    {
        $priority = $lead->relationLoaded('stage')
            ? $lead->stage?->priority
            : LeadStage::query()->whereKey($lead->lead_stage_id)->value('priority');

        if ($priority === null) {
            return 25.0;
        }

        // Map typical 1–5 open-funnel priorities into 15–85.
        return max(10.0, min(90.0, ((int) $priority / 5) * 85.0));
    }

    protected function heatScore(Lead $lead): float
    {
        return match ($lead->tag) {
            Lead::TAG_VERY_HOT => 100.0,
            Lead::TAG_HOT => 80.0,
            Lead::TAG_MODERATE => 50.0,
            Lead::TAG_COLD => 25.0,
            Lead::TAG_VERY_COLD => 5.0,
            default => 40.0,
        };
    }

    protected function followUpScore(Lead $lead): float
    {
        $nextAction = (string) ($lead->next_action ?? '');
        $doNothing = $nextAction === '' || LeadActionType::isDoNothing($nextAction);

        if ($doNothing) {
            return 20.0;
        }

        if ($lead->due_date === null) {
            return 45.0;
        }

        $due = $lead->due_date instanceof CarbonInterface
            ? $lead->due_date
            : Carbon::parse($lead->due_date);

        if ($due->lt(now()->startOfDay())) {
            return 10.0;
        }

        if ($due->lte(now()->endOfDay())) {
            return 70.0;
        }

        if ($due->lte(now()->addDays(7)->endOfDay())) {
            return 85.0;
        }

        return 60.0;
    }

    protected function commercialScore(Lead $lead): float
    {
        $budget = $lead->budget !== null ? (float) $lead->budget : 0.0;

        if ($budget <= 0) {
            return $lead->project_id || $lead->unit_id ? 35.0 : 15.0;
        }

        $score = 55.0;

        if ($lead->project_id) {
            $score += 15.0;
        }

        if ($lead->unit_id) {
            $score += 15.0;

            $unitPrice = $lead->relationLoaded('unit')
                ? ($lead->unit?->price !== null ? (float) $lead->unit->price : null)
                : null;

            if ($unitPrice !== null && $unitPrice > 0) {
                $ratio = $budget / $unitPrice;

                if ($ratio >= 0.85 && $ratio <= 1.25) {
                    $score += 15.0;
                } elseif ($ratio >= 0.5) {
                    $score += 8.0;
                }
            }
        }

        return min(100.0, $score);
    }

    protected function recencyScore(Lead $lead): float
    {
        $at = $this->lastEngagementAt($lead);

        if ($at === null) {
            $created = $lead->created_at instanceof CarbonInterface
                ? $lead->created_at
                : ($lead->created_at ? Carbon::parse($lead->created_at) : null);

            if ($created === null) {
                return 10.0;
            }

            $ageDays = max(0, $created->diffInDays(now()));

            return match (true) {
                $ageDays <= 1 => 40.0,
                $ageDays <= 7 => 25.0,
                default => 10.0,
            };
        }

        $days = max(0, $at->diffInDays(now()));

        return match (true) {
            $days === 0 => 100.0,
            $days <= 2 => 85.0,
            $days <= 7 => 65.0,
            $days <= 14 => 40.0,
            $days <= 30 => 25.0,
            default => 10.0,
        };
    }

    protected function activityVolumeScore(Lead $lead): float
    {
        $count = $this->completedActionCount($lead, days: 30);

        return match (true) {
            $count >= 8 => 100.0,
            $count >= 5 => 80.0,
            $count >= 3 => 60.0,
            $count >= 1 => 40.0,
            default => 10.0,
        };
    }

    protected function intentScore(Lead $lead): float
    {
        $highIntent = ['Site Visit', 'Meeting', 'Arrange Site Visit', 'Arrange Meeting'];
        $next = (string) ($lead->next_action ?? '');

        if (in_array($next, $highIntent, true)) {
            return 90.0;
        }

        if ($this->hasRecentHighIntentAction($lead, $highIntent)) {
            return 75.0;
        }

        return 35.0;
    }

    /**
     * @param  list<string>  $actions
     */
    protected function hasRecentHighIntentAction(Lead $lead, array $actions): bool
    {
        if ($lead->relationLoaded('tasks')) {
            $cutoff = now()->subDays(30);

            return $lead->tasks->contains(function (Task $task) use ($actions, $cutoff): bool {
                return $task->type === Task::TYPE_ACTION
                    && $task->status === Task::STATUS_COMPLETED
                    && in_array($task->action, $actions, true)
                    && $task->created_at !== null
                    && $task->created_at->gte($cutoff);
            });
        }

        return $lead->tasks()
            ->where('type', Task::TYPE_ACTION)
            ->where('status', Task::STATUS_COMPLETED)
            ->whereIn('action', $actions)
            ->where('created_at', '>=', now()->subDays(30))
            ->exists();
    }

    protected function completedActionCount(Lead $lead, int $days): int
    {
        if ($lead->relationLoaded('tasks')) {
            $cutoff = now()->subDays($days);

            return $lead->tasks
                ->filter(function (Task $task) use ($cutoff): bool {
                    return $task->type === Task::TYPE_ACTION
                        && $task->status === Task::STATUS_COMPLETED
                        && $task->created_at !== null
                        && $task->created_at->gte($cutoff);
                })
                ->count();
        }

        if (array_key_exists('recent_action_tasks_count', $lead->getAttributes())) {
            return (int) $lead->getAttribute('recent_action_tasks_count');
        }

        return (int) $lead->tasks()
            ->where('type', Task::TYPE_ACTION)
            ->where('status', Task::STATUS_COMPLETED)
            ->where('created_at', '>=', now()->subDays($days))
            ->count();
    }

    protected function lastEngagementAt(Lead $lead): ?CarbonInterface
    {
        $candidates = [];

        if ($lead->contacted_at !== null) {
            $candidates[] = $lead->contacted_at instanceof CarbonInterface
                ? $lead->contacted_at
                : Carbon::parse($lead->contacted_at);
        }

        if ($lead->relationLoaded('tasks')) {
            $latestAction = $lead->tasks
                ->filter(fn (Task $task): bool => $task->type === Task::TYPE_ACTION
                    && $task->status === Task::STATUS_COMPLETED
                    && $task->created_at !== null)
                ->sortByDesc(fn (Task $task) => $task->created_at?->getTimestamp() ?? 0)
                ->first();

            if ($latestAction?->created_at) {
                $candidates[] = $latestAction->created_at;
            }
        }

        if ($candidates === []) {
            return null;
        }

        return collect($candidates)
            ->sortByDesc(fn (CarbonInterface $at): int => $at->getTimestamp())
            ->first();
    }

    protected function stageLabel(Lead $lead): ?string
    {
        if ($lead->relationLoaded('stage')) {
            return $lead->stage?->label;
        }

        if ($lead->lead_stage_id === null) {
            return null;
        }

        return LeadStage::query()->whereKey($lead->lead_stage_id)->value('label');
    }
}

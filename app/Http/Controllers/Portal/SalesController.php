<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\User;
use App\Support\AssetManager;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class SalesController extends Controller
{
    public function __construct(
        protected AssetManager $assets,
    ) {}

    public function overview(Request $request): Response
    {
        $period = $this->resolvePeriod($request);
        $start = $period['start'];
        $end = $period['end'];

        $wonStageIds = LeadStage::query()
            ->where('label', 'closed_won')
            ->pluck('id');

        $metrics = $this->metrics(
            $start,
            $end,
            $period['previous_start'],
            $period['previous_end'],
            $wonStageIds,
        );

        return Inertia::render('sales/overview', [
            'title' => 'Sales Overview',
            'breadcrumbs' => [
                ['label' => 'Sales'],
                ['label' => 'Overview'],
            ],
            'period' => $period['key'],
            'periodLabel' => $period['label'],
            'from' => $period['from'],
            'to' => $period['to'],
            'metrics' => $metrics,
            'leadsByDay' => $this->leadsByDay($start, $end),
            'channels' => $this->channelBreakdown($start, $end),
            'funnel' => $this->conversionFunnel($wonStageIds),
            'agents' => $this->agentPerformance($start, $end, $wonStageIds),
        ]);
    }

    /**
     * @return array{
     *     key: string,
     *     label: string,
     *     from: string,
     *     to: string,
     *     start: CarbonInterface,
     *     end: CarbonInterface,
     *     previous_start: CarbonInterface,
     *     previous_end: CarbonInterface
     * }
     */
    protected function resolvePeriod(Request $request): array
    {
        $key = $request->string('period')->trim()->toString();

        if (! in_array($key, ['today', 'week', 'month', 'custom'], true)) {
            $key = 'month';
        }

        $now = Carbon::now();

        if ($key === 'today') {
            $start = $now->copy()->startOfDay();
            $end = $now->copy()->endOfDay();
            $label = 'Today';
        } elseif ($key === 'week') {
            $start = $now->copy()->startOfWeek();
            $end = $now->copy()->endOfDay();
            $label = 'This week';
        } elseif ($key === 'custom') {
            $from = $this->parseDate($request->string('from')->toString())
                ?? $now->copy()->startOfMonth();
            $to = $this->parseDate($request->string('to')->toString())
                ?? $now->copy()->startOfDay();

            if ($from->gt($to)) {
                [$from, $to] = [$to, $from];
            }

            if ($from->diffInDays($to) > 366) {
                $from = $to->copy()->subDays(366);
            }

            $start = $from->copy()->startOfDay();
            $end = $to->copy()->endOfDay();
            $label = $start->toDateString() === $end->toDateString()
                ? $start->format('M j, Y')
                : $start->format('M j, Y').' – '.$end->format('M j, Y');
            $key = 'custom';
        } else {
            $key = 'month';
            $start = $now->copy()->startOfMonth();
            $end = $now->copy()->endOfDay();
            $label = 'This month';
        }

        $dayCount = max(1, (int) $start->diffInDays($end) + 1);
        $previousEnd = $start->copy()->subSecond();
        $previousStart = $previousEnd->copy()->subDays($dayCount - 1)->startOfDay();

        return [
            'key' => $key,
            'label' => $label,
            'from' => $start->toDateString(),
            'to' => Carbon::parse($end)->toDateString(),
            'start' => $start,
            'end' => $end,
            'previous_start' => $previousStart,
            'previous_end' => $previousEnd,
        ];
    }

    protected function parseDate(string $value): ?Carbon
    {
        $value = trim($value);

        if ($value === '') {
            return null;
        }

        try {
            return Carbon::createFromFormat('Y-m-d', $value)->startOfDay();
        } catch (\Throwable) {
            try {
                return Carbon::parse($value)->startOfDay();
            } catch (\Throwable) {
                return null;
            }
        }
    }

    /**
     * @param  Collection<int, int|string>  $wonStageIds
     * @return array{
     *     total_leads: int,
     *     total_leads_delta: float|null,
     *     conversion_rate: float,
     *     conversion_rate_delta: float|null,
     *     avg_velocity_days: float|null,
     *     avg_velocity_delta: float|null,
     *     pipeline_value: float,
     *     pipeline_value_delta: float|null
     * }
     */
    protected function metrics(
        CarbonInterface $start,
        CarbonInterface $end,
        CarbonInterface $previousStart,
        CarbonInterface $previousEnd,
        Collection $wonStageIds,
    ): array {
        $currentTotal = $this->leadsCreatedBetween($start, $end);
        $previousTotal = $this->leadsCreatedBetween($previousStart, $previousEnd);

        $currentWon = $this->leadsWonBetween($start, $end, $wonStageIds);
        $previousWon = $this->leadsWonBetween($previousStart, $previousEnd, $wonStageIds);

        $currentRate = $currentTotal > 0 ? round(($currentWon / $currentTotal) * 100, 1) : 0.0;
        $previousRate = $previousTotal > 0 ? round(($previousWon / $previousTotal) * 100, 1) : 0.0;

        $currentVelocity = $this->averageVelocityDays($start, $end, $wonStageIds);
        $previousVelocity = $this->averageVelocityDays($previousStart, $previousEnd, $wonStageIds);

        $pipelineValue = (float) Lead::query()->active()->sum('budget');
        $previousPipelineValue = (float) Lead::query()
            ->active()
            ->where('created_at', '<=', $previousEnd)
            ->sum('budget');

        return [
            'total_leads' => $currentTotal,
            'total_leads_delta' => $this->percentDelta($currentTotal, $previousTotal),
            'conversion_rate' => $currentRate,
            'conversion_rate_delta' => $previousTotal > 0 || $previousWon > 0
                ? round($currentRate - $previousRate, 1)
                : null,
            'avg_velocity_days' => $currentVelocity,
            'avg_velocity_delta' => $currentVelocity !== null && $previousVelocity !== null
                ? round($previousVelocity - $currentVelocity, 1)
                : null,
            'pipeline_value' => $pipelineValue,
            'pipeline_value_delta' => $this->percentDelta($pipelineValue, $previousPipelineValue),
        ];
    }

    protected function leadsCreatedBetween(CarbonInterface $start, CarbonInterface $end): int
    {
        return Lead::query()
            ->whereBetween('created_at', [$start, $end])
            ->count();
    }

    /**
     * @param  Collection<int, int|string>  $wonStageIds
     */
    protected function leadsWonBetween(CarbonInterface $start, CarbonInterface $end, Collection $wonStageIds): int
    {
        if ($wonStageIds->isEmpty()) {
            return 0;
        }

        return Lead::query()
            ->whereIn('lead_stage_id', $wonStageIds)
            ->whereBetween('updated_at', [$start, $end])
            ->count();
    }

    /**
     * @param  Collection<int, int|string>  $wonStageIds
     */
    protected function averageVelocityDays(CarbonInterface $start, CarbonInterface $end, Collection $wonStageIds): ?float
    {
        if ($wonStageIds->isEmpty()) {
            return null;
        }

        $leads = Lead::query()
            ->whereIn('lead_stage_id', $wonStageIds)
            ->whereBetween('updated_at', [$start, $end])
            ->get(['created_at', 'updated_at']);

        if ($leads->isEmpty()) {
            return null;
        }

        $avg = $leads->avg(function (Lead $lead): float {
            return max(0, $lead->created_at->diffInSeconds($lead->updated_at) / 86400);
        });

        return round((float) $avg, 1);
    }

    protected function percentDelta(float|int $current, float|int $previous): ?float
    {
        if ((float) $previous === 0.0) {
            return null;
        }

        return round((((float) $current - (float) $previous) / (float) $previous) * 100, 1);
    }

    /**
     * @return list<array{date: string, label: string, count: int}>
     */
    protected function leadsByDay(CarbonInterface $start, CarbonInterface $end): array
    {
        $counts = Lead::query()
            ->whereBetween('created_at', [$start, $end])
            ->get(['created_at'])
            ->groupBy(fn (Lead $lead): string => $lead->created_at->toDateString())
            ->map->count();

        $days = [];
        $cursor = Carbon::parse($start)->startOfDay();
        $endDay = Carbon::parse($end)->endOfDay();

        while ($cursor->lte($endDay)) {
            $key = $cursor->toDateString();
            $days[] = [
                'date' => $key,
                'label' => $cursor->format('M j'),
                'count' => (int) ($counts[$key] ?? 0),
            ];
            $cursor->addDay();
        }

        return $days;
    }

    /**
     * @return list<array{source: string, count: int, percent: float, color: string}>
     */
    protected function channelBreakdown(CarbonInterface $start, CarbonInterface $end): array
    {
        $rows = Lead::query()
            ->whereBetween('created_at', [$start, $end])
            ->selectRaw("COALESCE(NULLIF(TRIM(source), ''), 'Unspecified') as source_label, COUNT(*) as aggregate")
            ->groupBy('source_label')
            ->orderByDesc('aggregate')
            ->limit(6)
            ->get();

        $total = max(1, (int) $rows->sum('aggregate'));
        $palette = [
            'var(--color-chart-1)',
            'var(--color-chart-2)',
            'var(--color-chart-3)',
            'var(--color-chart-4)',
            'var(--color-chart-5)',
            'var(--color-primary)',
        ];

        return $rows
            ->values()
            ->map(fn ($row, int $index): array => [
                'source' => (string) $row->source_label,
                'count' => (int) $row->aggregate,
                'percent' => round(((int) $row->aggregate / $total) * 100, 1),
                'color' => $palette[$index % count($palette)],
            ])
            ->all();
    }

    /**
     * @param  Collection<int, int|string>  $wonStageIds
     * @return list<array{label: string, title: string, color: ?string, count: int, is_won: bool}>
     */
    protected function conversionFunnel(Collection $wonStageIds): array
    {
        $counts = Lead::query()
            ->active()
            ->selectRaw('lead_stage_id, COUNT(*) as aggregate')
            ->groupBy('lead_stage_id')
            ->pluck('aggregate', 'lead_stage_id');

        return LeadStage::query()
            ->enabled()
            ->where('label', '!=', 'closed_lost')
            ->orderBy('priority')
            ->get(['id', 'label', 'title', 'color'])
            ->map(fn (LeadStage $stage): array => [
                'label' => $stage->label,
                'title' => $stage->title ?: ucfirst(str_replace('_', ' ', (string) $stage->label)),
                'color' => $stage->color,
                'count' => (int) ($counts[$stage->id] ?? 0),
                'is_won' => $wonStageIds->contains($stage->id),
            ])
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, int|string>  $wonStageIds
     * @return list<array{id: int, display_name: string, avatar: ?string, leads: int, won: int}>
     */
    protected function agentPerformance(CarbonInterface $start, CarbonInterface $end, Collection $wonStageIds): array
    {
        $leadCounts = Lead::query()
            ->whereNotNull('assigned_to')
            ->whereBetween('created_at', [$start, $end])
            ->selectRaw('assigned_to, COUNT(*) as aggregate')
            ->groupBy('assigned_to')
            ->pluck('aggregate', 'assigned_to');

        if ($leadCounts->isEmpty()) {
            return [];
        }

        $wonCounts = $wonStageIds->isEmpty()
            ? collect()
            : Lead::query()
                ->whereNotNull('assigned_to')
                ->whereIn('lead_stage_id', $wonStageIds)
                ->whereBetween('updated_at', [$start, $end])
                ->selectRaw('assigned_to, COUNT(*) as aggregate')
                ->groupBy('assigned_to')
                ->pluck('aggregate', 'assigned_to');

        $userIds = $leadCounts->keys()->map(fn ($id): int => (int) $id)->all();
        $users = User::query()
            ->whereIn('id', $userIds)
            ->get(['id', 'display_name', 'first_name', 'last_name'])
            ->keyBy('id');
        $avatars = $this->assets->urlsFor(User::class, $userIds, AssetManager::LINKAGE_AVATAR);

        return $leadCounts
            ->sortDesc()
            ->take(8)
            ->map(function ($count, $userId) use ($users, $avatars, $wonCounts): ?array {
                $user = $users->get((int) $userId);

                if ($user === null) {
                    return null;
                }

                return [
                    'id' => $user->id,
                    'display_name' => $user->display_name
                        ?: trim($user->first_name.' '.$user->last_name)
                        ?: 'Agent',
                    'avatar' => $avatars->get($user->id),
                    'leads' => (int) $count,
                    'won' => (int) ($wonCounts[$userId] ?? 0),
                ];
            })
            ->filter()
            ->values()
            ->all();
    }
}

<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Resources\Portal\LeadResource;
use App\Models\Contact;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Project;
use App\Models\Unit;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request): Response
    {
        $now = Carbon::now();
        $weekStart = $now->copy()->startOfWeek();
        $dueUntil = $now->copy()->addDays(7)->endOfDay();

        $leadsTotal = Lead::query()->active()->count();
        $leadsThisWeek = Lead::query()->active()->where('created_at', '>=', $weekStart)->count();
        $hotLeads = Lead::query()
            ->active()
            ->whereIn('tag', [Lead::TAG_VERY_HOT, Lead::TAG_HOT])
            ->count();
        $contactsTotal = Contact::query()->count();
        $clientsTotal = Contact::query()->where('type', Contact::TYPE_CLIENT)->count();
        $pipelineBudget = (float) Lead::query()->active()->sum('budget');
        $availableUnits = Unit::query()->where('status', Unit::STATUS_AVAILABLE)->count();
        $unitsTotal = Unit::query()->count();
        $activeProjects = Project::query()->where('status', 'active')->count();
        $projectsTotal = Project::query()->count();
        $dueSoonCount = Lead::query()
            ->active()
            ->whereNotNull('due_date')
            ->whereBetween('due_date', [$now->copy()->startOfDay(), $dueUntil])
            ->count();
        $overdueCount = Lead::query()
            ->active()
            ->whereNotNull('due_date')
            ->where('due_date', '<', $now->copy()->startOfDay())
            ->whereNotIn('next_action', [Lead::NEXT_ACTION_DO_NOTHING])
            ->count();

        return Inertia::render('dashboard/index', [
            'stats' => [
                'leads_total' => $leadsTotal,
                'leads_this_week' => $leadsThisWeek,
                'hot_leads' => $hotLeads,
                'contacts_total' => $contactsTotal,
                'clients_total' => $clientsTotal,
                'pipeline_budget' => $pipelineBudget,
                'available_units' => $availableUnits,
                'units_total' => $unitsTotal,
                'active_projects' => $activeProjects,
                'projects_total' => $projectsTotal,
                'due_soon' => $dueSoonCount,
                'overdue' => $overdueCount,
            ],
            'pipeline' => Inertia::defer(fn (): array => $this->pipelineByStage(), 'widgets'),
            'heat' => Inertia::defer(fn (): array => $this->heatDistribution(), 'widgets'),
            'inventory' => Inertia::defer(fn (): array => $this->inventoryByStatus(), 'widgets'),
            'leadSources' => Inertia::defer(fn (): array => $this->leadSources(), 'widgets'),
            'projects' => Inertia::defer(fn (): array => $this->projectProgress(), 'widgets'),
            'dueSoon' => Inertia::defer(fn (): array => $this->dueSoonLeads($now, $dueUntil), 'widgets'),
            'recentLeads' => Inertia::defer(fn (): array => $this->recentLeads(), 'widgets'),
        ]);
    }

    /**
     * @return list<array{label: string, title: string, color: ?string, count: int, budget: float}>
     */
    protected function pipelineByStage(): array
    {
        $counts = Lead::query()
            ->active()
            ->selectRaw('lead_stage_id, COUNT(*) as aggregate, COALESCE(SUM(budget), 0) as budget_sum')
            ->groupBy('lead_stage_id')
            ->get()
            ->keyBy('lead_stage_id');

        return LeadStage::query()
            ->orderBy('priority')
            ->get(['id', 'label', 'title', 'color'])
            ->map(function (LeadStage $stage) use ($counts): array {
                $row = $counts->get($stage->id);

                return [
                    'label' => $stage->label,
                    'title' => $stage->title ?: ucfirst((string) $stage->label),
                    'color' => $stage->color,
                    'count' => (int) ($row?->aggregate ?? 0),
                    'budget' => (float) ($row?->budget_sum ?? 0),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return list<array{tag: string, count: int}>
     */
    protected function heatDistribution(): array
    {
        $counts = Lead::query()
            ->active()
            ->selectRaw('tag, COUNT(*) as aggregate')
            ->groupBy('tag')
            ->pluck('aggregate', 'tag');

        return collect(Lead::tags())
            ->map(fn (string $tag): array => [
                'tag' => $tag,
                'count' => (int) ($counts[$tag] ?? 0),
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<array{status: string, count: int}>
     */
    protected function inventoryByStatus(): array
    {
        $counts = Unit::query()
            ->selectRaw('status, COUNT(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        return collect(Unit::statuses())
            ->map(fn (string $status): array => [
                'status' => $status,
                'count' => (int) ($counts[$status] ?? 0),
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<array{source: string, count: int}>
     */
    protected function leadSources(): array
    {
        return Lead::query()
            ->active()
            ->selectRaw("COALESCE(NULLIF(TRIM(source), ''), 'Unspecified') as source_label, COUNT(*) as aggregate")
            ->groupBy('source_label')
            ->orderByDesc('aggregate')
            ->limit(6)
            ->get()
            ->map(fn ($row): array => [
                'source' => (string) $row->source_label,
                'count' => (int) $row->aggregate,
            ])
            ->all();
    }

    /**
     * @return list<array{id: int, title: string, code: string, status: string, progress: int, units_count: int}>
     */
    protected function projectProgress(): array
    {
        return Project::query()
            ->withCount('units')
            ->orderByDesc('updated_at')
            ->limit(5)
            ->get(['id', 'title', 'code', 'status', 'progress'])
            ->map(fn (Project $project): array => [
                'id' => $project->id,
                'title' => $project->title,
                'code' => $project->code,
                'status' => (string) $project->status,
                'progress' => (int) ($project->progress ?? 0),
                'units_count' => (int) $project->units_count,
            ])
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    protected function dueSoonLeads(Carbon $now, Carbon $dueUntil): array
    {
        $leads = Lead::query()
            ->active()
            ->with(['contact:id,first_name,last_name,phone_number,email_address', 'stage:id,label,title,color', 'project:id,title,code'])
            ->whereNotNull('due_date')
            ->where(function ($query) use ($now, $dueUntil): void {
                $query->whereBetween('due_date', [$now->copy()->startOfDay(), $dueUntil])
                    ->orWhere('due_date', '<', $now->copy()->startOfDay());
            })
            ->where(function ($query): void {
                $query->whereNull('next_action')
                    ->orWhere('next_action', '!=', Lead::NEXT_ACTION_DO_NOTHING);
            })
            ->orderBy('due_date')
            ->limit(8)
            ->get();

        return $this->mapLeads($leads);
    }

    /**
     * @return list<array<string, mixed>>
     */
    protected function recentLeads(): array
    {
        $leads = Lead::query()
            ->active()
            ->with(['contact:id,first_name,last_name,phone_number,email_address', 'stage:id,label,title,color', 'project:id,title,code'])
            ->latest('id')
            ->limit(8)
            ->get();

        return $this->mapLeads($leads);
    }

    /**
     * @param  Collection<int, Lead>  $leads
     * @return list<array<string, mixed>>
     */
    protected function mapLeads(Collection $leads): array
    {
        $leads->each(fn (Lead $lead) => $lead->setRelation('assignee', null));

        return LeadResource::collection($leads)->resolve();
    }
}

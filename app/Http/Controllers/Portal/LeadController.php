<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\BulkLeadRequest;
use App\Http\Requests\Portal\ConvertLeadRequest;
use App\Http\Requests\Portal\StoreLeadRequest;
use App\Http\Requests\Portal\UpdateLeadRequest;
use App\Http\Resources\Portal\LeadResource;
use App\Models\Lead;
use App\Models\LeadActionType;
use App\Models\LeadStage;
use App\Models\Project;
use App\Models\Task;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\Unit;
use App\Models\User;
use App\Services\LeadActivity;
use App\Services\LeadIntakeService;
use App\Services\OrderService;
use App\Support\AssetManager;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class LeadController extends Controller
{
    public const KANBAN_COLUMN_PAGE_SIZE = 40;

    public function __construct(
        protected AssetManager $assets,
        protected LeadIntakeService $intake,
        protected LeadActivity $activity,
        protected OrderService $orders,
    ) {}

    public function index(Request $request): Response
    {
        $view = $request->string('view')->trim()->toString();
        $view = in_array($view, ['kanban', 'table', 'archive'], true) ? $view : 'table';

        [$filters, $leadsQuery] = $this->filteredLeadsQuery($request, archived: $view === 'archive');

        if ($view === 'kanban') {
            return $this->kanbanIndex($request, $leadsQuery, $filters);
        }

        $paginator = (clone $leadsQuery)->paginate(20)->withQueryString();
        $leads = $paginator->getCollection();
        $this->hydrateAssignees($leads);
        $this->hydrateProjectThumbnails($leads);

        return Inertia::render('leads/index', [
            'view' => $view === 'archive' ? 'archive' : 'table',
            'leads' => LeadResource::collection($leads)->resolve(),
            'openedLead' => $this->openedLead($request),
            'board' => [],
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
            'filters' => $filters,
            'formOptions' => $this->formOptions(),
        ]);
    }

    public function boardColumn(Request $request, LeadStage $stage): JsonResponse
    {
        [, $leadsQuery] = $this->filteredLeadsQuery($request, applyStageFilter: false, archived: false);

        $cursor = $request->string('cursor')->trim()->toString();
        $page = $this->kanbanColumnPage($leadsQuery, $stage->id, $cursor !== '' ? $cursor : null);

        return response()->json($page);
    }

    public function store(StoreLeadRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        [$contact, $contactReused] = $this->intake->resolveContact($this->contactPayload($validated));

        if ($contactReused) {
            session()->flash('contact_reused', true);
        }

        $stageId = $validated['lead_stage_id']
            ?? LeadStage::defaultStageId();

        Lead::query()->create([
            'contact_id' => $contact->id,
            'user_id' => $request->user()?->id,
            'project_id' => $validated['project_id'] ?? null,
            'unit_id' => $validated['unit_id'] ?? null,
            'assigned_to' => $validated['assigned_to'] ?? $request->user()?->id,
            'source' => $validated['source'] ?? null,
            'lead_stage_id' => $stageId,
            'tag' => $validated['tag'] ?? Lead::TAG_MODERATE,
            'budget' => $validated['budget'] ?? 0,
            'next_action' => $validated['next_action'] ?? null,
            'due_date' => $validated['due_date'] ?? null,
            'notes' => $validated['notes'] ?? null,
        ]);

        return to_route('portal.leads.index');
    }

    public function convert(ConvertLeadRequest $request, Lead $lead): RedirectResponse
    {
        if ($lead->hasActiveDeal()) {
            return back()->withErrors([
                'lead' => 'This lead already has an active booking. Cancel the booking to reopen sales work.',
            ]);
        }

        $order = $this->orders->book($lead, $request->validated(), $request->user()?->id);

        return redirect('/bookings?booking='.$order->code);
    }

    public function update(UpdateLeadRequest $request, Lead $lead): RedirectResponse
    {
        if ($lead->hasActiveDeal()) {
            return back()->withErrors([
                'lead' => 'This lead is locked while its booking is active. Cancel the booking to make changes.',
            ]);
        }

        $validated = $request->validated();

        $previousStageId = $lead->lead_stage_id;
        $previousAssigneeId = $lead->assigned_to;

        if (array_key_exists('contact', $validated) || array_key_exists('contact_id', $validated)) {
            [$contact] = $this->intake->resolveContact($this->contactPayload($validated), $lead);
            $lead->contact_id = $contact->id;
        }

        foreach ([
            'project_id',
            'unit_id',
            'assigned_to',
            'source',
            'lead_stage_id',
            'tag',
            'budget',
            'next_action',
            'due_date',
            'notes',
        ] as $field) {
            if ($field === 'lead_stage_id' && $lead->isArchived()) {
                continue;
            }

            if (array_key_exists($field, $validated)) {
                $lead->{$field} = $validated[$field];
            }
        }

        $lead->save();

        $actorId = $request->user()?->id;

        if (
            array_key_exists('lead_stage_id', $validated)
            && ! $lead->isArchived()
            && (int) $previousStageId !== (int) $lead->lead_stage_id
        ) {
            $titles = LeadStage::query()
                ->whereIn('id', array_filter([$previousStageId, $lead->lead_stage_id]))
                ->pluck('title', 'id');

            $from = $titles->get($previousStageId) ?? 'None';
            $to = $titles->get($lead->lead_stage_id) ?? 'None';

            $this->activity->log($lead, 'Stage changed', $from.' → '.$to, $actorId);
        }

        if (
            array_key_exists('assigned_to', $validated)
            && (int) $previousAssigneeId !== (int) $lead->assigned_to
        ) {
            $names = User::query()
                ->whereIn('id', array_filter([$previousAssigneeId, $lead->assigned_to]))
                ->pluck('display_name', 'id');

            $from = $names->get($previousAssigneeId) ?? 'Unassigned';
            $to = $names->get($lead->assigned_to) ?? 'Unassigned';

            $this->activity->log($lead, 'Assignee changed', $from.' → '.$to, $actorId);
        }

        return back();
    }

    public function archive(Lead $lead): RedirectResponse
    {
        if ($lead->hasActiveDeal()) {
            return back()->withErrors([
                'lead' => 'This lead is locked while its booking is active. Cancel the booking first.',
            ]);
        }

        if ($lead->isArchived()) {
            return back();
        }

        $lead->archive();
        $this->activity->log($lead, 'Lead archived', null, request()->user()?->id);

        return back();
    }

    public function restore(Lead $lead): RedirectResponse
    {
        if (! $lead->isArchived()) {
            return back();
        }

        $fallbackStageId = null;

        if ($lead->lead_stage_id === null || ! LeadStage::query()->whereKey($lead->lead_stage_id)->exists()) {
            $fallbackStageId = LeadStage::defaultStageId();
        }

        $lead->restoreFromArchive($fallbackStageId !== null ? (int) $fallbackStageId : null);
        $this->activity->log($lead, 'Lead restored', null, request()->user()?->id);

        return back();
    }

    public function destroy(Lead $lead): RedirectResponse
    {
        if (! $lead->isArchived()) {
            return back()->withErrors([
                'lead' => 'Only archived leads can be deleted. Archive the lead first.',
            ]);
        }

        $lead->delete();

        return to_route('portal.leads.index', ['view' => 'archive']);
    }

    public function bulk(BulkLeadRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        /** @var list<int> $ids */
        $ids = array_map('intval', $validated['ids']);
        $action = $validated['action'];

        $leads = Lead::query()->whereIn('id', $ids)->get();
        $mutable = $leads->reject(fn (Lead $lead): bool => $lead->hasActiveDeal())->values();

        if ($action === 'archive') {
            $mutable->each(function (Lead $lead): void {
                if (! $lead->isArchived()) {
                    $lead->archive();
                }
            });

            return back();
        }

        if ($action === 'restore') {
            $fallbackStageId = LeadStage::defaultStageId();

            $leads->each(function (Lead $lead) use ($fallbackStageId): void {
                if (! $lead->isArchived()) {
                    return;
                }

                $stageId = null;

                if ($lead->lead_stage_id === null || ! LeadStage::query()->whereKey($lead->lead_stage_id)->exists()) {
                    $stageId = $fallbackStageId !== null ? (int) $fallbackStageId : null;
                }

                $lead->restoreFromArchive($stageId);
            });

            return back();
        }

        if ($action === 'destroy') {
            $mutable->each(function (Lead $lead): void {
                if ($lead->isArchived()) {
                    $lead->delete();
                }
            });

            return back();
        }

        if ($action === 'assign') {
            $assignedTo = $validated['assigned_to'] ?? null;

            $mutable->each(function (Lead $lead) use ($assignedTo): void {
                $lead->update(['assigned_to' => $assignedTo]);
            });

            return back();
        }

        if ($action === 'stage') {
            $stageId = (int) $validated['lead_stage_id'];

            $mutable->filter(fn (Lead $lead): bool => ! $lead->isArchived())
                ->each(function (Lead $lead) use ($stageId): void {
                    $lead->update(['lead_stage_id' => $stageId]);
                });

            return back();
        }

        return back();
    }

    /**
     * @param  Builder<Lead>  $leadsQuery
     * @param  array{
     *     q: string,
     *     project: list<string>,
     *     stage: list<string>,
     *     tag: list<string>,
     *     assigned_to: list<string>
     * }  $filters
     */
    protected function kanbanIndex(Request $request, Builder $leadsQuery, array $filters): Response
    {
        $stagesQuery = LeadStage::query()->enabled()->orderBy('priority');

        if ($filters['stage'] !== []) {
            $stagesQuery->whereIn('label', $filters['stage']);
        }

        $stages = $stagesQuery->get(['id', 'label', 'title', 'color', 'priority']);

        $aggregates = (clone $leadsQuery)
            ->reorder()
            ->selectRaw('lead_stage_id, COUNT(*) as aggregate, COALESCE(SUM(budget), 0) as budget_sum')
            ->groupBy('lead_stage_id')
            ->get()
            ->keyBy('lead_stage_id');

        $board = $stages
            ->map(function (LeadStage $stage) use ($aggregates, $leadsQuery): array {
                $stats = $aggregates->get($stage->id);
                $page = $this->kanbanColumnPage($leadsQuery, $stage->id);

                return [
                    'stage' => [
                        'id' => $stage->id,
                        'label' => $stage->label,
                        'title' => $stage->title,
                        'color' => $stage->color,
                        'priority' => $stage->priority,
                    ],
                    'count' => (int) ($stats?->aggregate ?? 0),
                    'budget_sum' => (float) ($stats?->budget_sum ?? 0),
                    'leads' => $page['leads'],
                    'next_cursor' => $page['next_cursor'],
                    'has_more' => $page['has_more'],
                ];
            })
            ->values()
            ->all();

        $loadedLeads = collect($board)->flatMap(fn (array $column) => $column['leads'])->values();

        return Inertia::render('leads/index', [
            'view' => 'kanban',
            'leads' => $loadedLeads->all(),
            'openedLead' => $this->openedLead($request),
            'board' => $board,
            'pagination' => [
                'current_page' => 1,
                'last_page' => 1,
                'per_page' => self::KANBAN_COLUMN_PAGE_SIZE,
                'total' => (int) $aggregates->sum('aggregate'),
                'from' => $loadedLeads->isEmpty() ? null : 1,
                'to' => $loadedLeads->isEmpty() ? null : $loadedLeads->count(),
            ],
            'filters' => $filters,
            'formOptions' => $this->formOptions(),
        ]);
    }

    /**
     * @param  Builder<Lead>  $leadsQuery
     * @return array{leads: list<array<string, mixed>>, next_cursor: ?string, has_more: bool}
     */
    protected function kanbanColumnPage(Builder $leadsQuery, int $stageId, ?string $cursor = null): array
    {
        $cursorId = null;

        if ($cursor !== null && $cursor !== '') {
            $cursorId = Lead::query()->where('code', $cursor)->value('id');

            if ($cursorId === null) {
                return [
                    'leads' => [],
                    'next_cursor' => null,
                    'has_more' => false,
                ];
            }
        }

        $page = (clone $leadsQuery)
            ->where('lead_stage_id', $stageId)
            ->when($cursorId !== null, fn (Builder $builder) => $builder->where('id', '<', $cursorId))
            ->limit(self::KANBAN_COLUMN_PAGE_SIZE)
            ->get();

        $this->hydrateAssignees($page);
        $this->hydrateProjectThumbnails($page);

        $last = $page->last();
        $nextCursor = $last === null ? null : $last->code;
        $hasMore = $last !== null && (clone $leadsQuery)
            ->where('lead_stage_id', $stageId)
            ->where('id', '<', $last->id)
            ->exists();

        return [
            'leads' => LeadResource::collection($page)->resolve(),
            'next_cursor' => $hasMore ? $nextCursor : null,
            'has_more' => $hasMore,
        ];
    }

    /**
     * Lead opened from a notification link, even when it is not on the current page.
     *
     * @return array<string, mixed>|null
     */
    protected function openedLead(Request $request): ?array
    {
        $code = $request->string('lead')->trim()->toString();

        if ($code === '') {
            return null;
        }

        $lead = Lead::query()->with($this->leadDetailRelations())->where('code', $code)->first();

        if ($lead === null) {
            return null;
        }

        $loaded = collect([$lead]);
        $this->hydrateAssignees($loaded);
        $this->hydrateProjectThumbnails($loaded);

        return (new LeadResource($lead))->resolve();
    }

    /**
     * @return array<string, mixed>
     */
    protected function leadDetailRelations(): array
    {
        return [
            'contact:id,first_name,last_name,email_address,phone_number',
            'project:id,title,code',
            'project.thumbnail.asset',
            'unit:id,code,name,project_id,price,status',
            'stage:id,label,title,color,priority',
            'campaign:id,title,public_id',
            'activeOrder',
            'tasks' => fn ($query) => $query->with(['gallery.asset', 'documents.asset'])->latest('id'),
        ];
    }

    /**
     * @return array{
     *     0: array{
     *         q: string,
     *         project: list<string>,
     *         stage: list<string>,
     *         tag: list<string>,
     *         assigned_to: list<string>,
     *         next_action: list<string>
     *     },
     *     1: Builder<Lead>
     * }
     */
    protected function filteredLeadsQuery(
        Request $request,
        bool $applyStageFilter = true,
        bool $archived = false,
    ): array {
        $query = $request->string('q')->trim()->toString();
        $projectCodes = $this->listParam($request, 'project');
        $stageLabels = $this->listParam($request, 'stage');
        $tags = $this->listParam($request, 'tag');
        $nextActions = $this->listParam($request, 'next_action');
        $assignedTo = collect($this->listParam($request, 'assigned_to'))
            ->map(fn (string $value): int => (int) $value)
            ->filter(fn (int $value): bool => $value > 0)
            ->values()
            ->all();

        $projectIds = $projectCodes === []
            ? []
            : Project::query()
                ->whereIn('code', $projectCodes)
                ->pluck('id')
                ->all();

        $stageIds = $stageLabels === []
            ? []
            : LeadStage::query()
                ->whereIn('label', $stageLabels)
                ->pluck('id')
                ->all();

        $allowedNextActions = Lead::nextActions();
        $nextActions = array_values(array_intersect($nextActions, $allowedNextActions));

        $leadsQuery = Lead::query()
            ->when($archived, fn (Builder $builder) => $builder->archived(), fn (Builder $builder) => $builder->active())
            ->with($this->leadDetailRelations())
            ->when($query !== '', function ($builder) use ($query): void {
                $builder->where(function ($inner) use ($query): void {
                    $inner->where('code', 'like', "%{$query}%")
                        ->orWhere('source', 'like', "%{$query}%")
                        ->orWhere('notes', 'like', "%{$query}%")
                        ->orWhere('next_action', 'like', "%{$query}%")
                        ->orWhereHas('contact', function ($contactQuery) use ($query): void {
                            $contactQuery->where('first_name', 'like', "%{$query}%")
                                ->orWhere('last_name', 'like', "%{$query}%")
                                ->orWhere('phone_number', 'like', "%{$query}%")
                                ->orWhere('email_address', 'like', "%{$query}%");
                        });
                });
            })
            ->when($projectCodes !== [], function ($builder) use ($projectIds): void {
                if ($projectIds === []) {
                    $builder->whereRaw('0 = 1');

                    return;
                }

                $builder->whereIn('project_id', $projectIds);
            })
            ->when($applyStageFilter && $stageLabels !== [], function ($builder) use ($stageIds): void {
                if ($stageIds === []) {
                    $builder->whereRaw('0 = 1');

                    return;
                }

                $builder->whereIn('lead_stage_id', $stageIds);
            })
            ->when($tags !== [], fn ($builder) => $builder->whereIn('tag', $tags))
            ->when($nextActions !== [], fn ($builder) => $builder->whereIn('next_action', $nextActions))
            ->when($assignedTo !== [], fn ($builder) => $builder->whereIn('assigned_to', $assignedTo))
            ->when(
                $archived,
                fn (Builder $builder) => $builder->latest('archived_at'),
                fn (Builder $builder) => $builder->latest('id'),
            );

        return [
            [
                'q' => $query,
                'project' => $projectCodes,
                'stage' => $stageLabels,
                'tag' => $tags,
                'assigned_to' => array_map('strval', $assignedTo),
                'next_action' => $nextActions,
            ],
            $leadsQuery,
        ];
    }

    /**
     * @return list<string>
     */
    protected function listParam(Request $request, string $key): array
    {
        $value = $request->input($key);

        if (is_array($value)) {
            return collect($value)
                ->map(fn ($item): string => trim((string) $item))
                ->filter()
                ->values()
                ->all();
        }

        $string = trim((string) ($value ?? ''));

        if ($string === '') {
            return [];
        }

        return collect(explode(',', $string))
            ->map(fn (string $item): string => trim($item))
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array{
     *     first_name?: string|null,
     *     last_name?: string|null,
     *     phone_number?: string|null,
     *     email_address?: string|null,
     *     reference?: string|null,
     *     contact_id?: int|null,
     * }
     */
    protected function contactPayload(array $validated): array
    {
        $contact = $validated['contact'] ?? [];

        return [
            'contact_id' => $validated['contact_id'] ?? null,
            'first_name' => $contact['first_name'] ?? null,
            'last_name' => $contact['last_name'] ?? null,
            'phone_number' => $contact['phone_number'] ?? null,
            'email_address' => $contact['email_address'] ?? null,
            'reference' => $contact['reference'] ?? null,
        ];
    }

    /**
     * @param  Collection<int, Lead>  $leads
     */
    protected function hydrateAssignees(Collection $leads): void
    {
        $userIds = $leads->pluck('assigned_to')
            ->merge($leads->pluck('user_id'))
            ->merge($leads->flatMap(
                fn (Lead $lead) => $lead->relationLoaded('tasks') ? $lead->tasks->pluck('user_id') : []
            ))
            ->filter()
            ->unique()
            ->values()
            ->all();

        if ($userIds === []) {
            $leads->each(function (Lead $lead): void {
                $lead->setRelation('assignee', null);
                $lead->setRelation('creator', null);
            });

            return;
        }

        $users = User::query()
            ->whereIn('id', $userIds)
            ->get(['id', 'display_name', 'first_name', 'last_name'])
            ->keyBy('id');

        $avatarUrls = $this->assets->urlsFor(
            User::class,
            $userIds,
            AssetManager::LINKAGE_AVATAR,
        );

        $users->each(function (User $user) use ($avatarUrls): void {
            $user->setAttribute('avatar', $avatarUrls->get($user->id));
        });

        $leads->each(function (Lead $lead) use ($users): void {
            $lead->setRelation('assignee', $users->get($lead->assigned_to));
            $lead->setRelation('creator', $users->get($lead->user_id));

            if ($lead->relationLoaded('tasks')) {
                $lead->tasks->each(function (Task $task) use ($users): void {
                    $task->setRelation('user', $users->get($task->user_id));
                });
            }
        });
    }

    /**
     * @param  Collection<int, Lead>  $leads
     */
    protected function hydrateProjectThumbnails(Collection $leads): void
    {
        $leads->each(function (Lead $lead): void {
            if (! $lead->project) {
                return;
            }

            $lead->project->setAttribute(
                'thumbnail_url',
                $this->assets->url($lead->project->thumbnail?->asset),
            );
        });
    }

    /**
     * @return array{
     *     projects: list<array{id: int, title: string, code: string, thumbnail: ?string}>,
     *     units: list<array{id: int, project_id: int, code: string, name: ?string, price: ?float, status: ?string}>,
     *     stages: list<array{id: int, label: string, title: string, color: ?string}>,
     *     tags: list<string>,
     *     activity_types: list<array{id: int, kind: string, label: string, title: string, priority: int, icon: ?string, is_system: bool, is_enabled: bool}>,
     *     next_actions: list<array{id: int, kind: string, label: string, title: string, priority: int, icon: ?string, is_system: bool, is_enabled: bool}>,
     *     assignees: list<array{id: int, display_name: string, title: ?string, avatar: ?string}>,
     *     sources: list<string>
     * }
     */
    protected function formOptions(): array
    {
        $projects = Project::query()
            ->with(['thumbnail.asset'])
            ->orderBy('title')
            ->get(['id', 'title', 'code']);

        $units = Unit::query()
            ->orderBy('code')
            ->get(['id', 'project_id', 'code', 'name', 'price', 'status']);

        $stages = LeadStage::query()
            ->enabled()
            ->orderBy('priority')
            ->get(['id', 'label', 'title', 'color']);

        $sources = Lead::query()
            ->active()
            ->whereNotNull('source')
            ->where('source', '!=', '')
            ->distinct()
            ->orderBy('source')
            ->pluck('source')
            ->values()
            ->all();

        $tenant = Tenant::current();
        $assignees = [];

        if ($tenant) {
            $memberships = TenantUser::query()
                ->with(['user:id,display_name,first_name,last_name'])
                ->where('tenant_id', $tenant->id)
                ->orderBy('id')
                ->get()
                ->filter(fn (TenantUser $membership): bool => $membership->user !== null)
                ->values();

            $avatarUrls = $this->assets->urlsFor(
                User::class,
                $memberships->pluck('user_id')->all(),
                AssetManager::LINKAGE_AVATAR,
            );

            $assignees = $memberships
                ->map(fn (TenantUser $membership): array => [
                    'id' => $membership->user->id,
                    'display_name' => $membership->user->display_name
                        ?: trim($membership->user->first_name.' '.$membership->user->last_name),
                    'title' => $membership->title,
                    'avatar' => $avatarUrls->get($membership->user_id),
                ])
                ->all();
        }

        return [
            'projects' => $projects
                ->map(fn (Project $project): array => [
                    'id' => $project->id,
                    'title' => $project->title,
                    'code' => $project->code,
                    'thumbnail' => $this->assets->url($project->thumbnail?->asset),
                ])
                ->values()
                ->all(),
            'units' => $units
                ->map(fn (Unit $unit): array => [
                    'id' => $unit->id,
                    'project_id' => $unit->project_id,
                    'code' => $unit->code,
                    'name' => $unit->name,
                    'price' => $unit->price !== null ? (float) $unit->price : null,
                    'status' => $unit->status,
                ])
                ->values()
                ->all(),
            'stages' => $stages
                ->map(fn (LeadStage $stage): array => [
                    'id' => $stage->id,
                    'label' => $stage->label,
                    'title' => $stage->title,
                    'color' => $stage->color,
                ])
                ->values()
                ->all(),
            'tags' => Lead::tags(),
            'activity_types' => LeadActionType::catalog(LeadActionType::KIND_ACTIVITY, enabledOnly: true),
            'next_actions' => LeadActionType::catalog(LeadActionType::KIND_NEXT_ACTION, enabledOnly: true),
            'assignees' => $assignees,
            'sources' => $sources,
        ];
    }
}

<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Resources\Portal\CampaignResource;
use App\Http\Resources\Portal\LeadResource;
use App\Http\Resources\Portal\OrderResource;
use App\Models\Campaign;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Order;
use App\Models\Project;
use App\Models\Team;
use App\Models\TeamUser;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\Unit;
use App\Models\User;
use App\Support\AssetManager;
use App\Support\Calendar\CalendarEvents;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class CalendarController extends Controller
{
    public function __construct(
        protected CalendarEvents $calendar,
        protected AssetManager $assets,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $today = now()->startOfDay();

        $date = $this->parseDate($request->string('date')->toString()) ?? $today->copy();
        $monthAnchor = $this->parseMonth($request->string('month')->toString()) ?? $date->copy()->startOfMonth();

        $monthStart = $monthAnchor->copy()->startOfMonth()->startOfDay();
        $monthEnd = $monthAnchor->copy()->endOfMonth()->endOfDay();
        $dayStart = $date->copy()->startOfDay();
        $dayEnd = $date->copy()->endOfDay();

        $assigneeIds = $this->resolveAssigneeIds($request, $user?->id);
        $types = $this->listParam($request, 'type');
        $overdueOnly = $request->boolean('overdue');

        $payload = $this->calendar->aggregate(
            $monthStart,
            $monthEnd,
            $dayStart,
            $dayEnd,
            $assigneeIds,
            $types,
            $overdueOnly,
        );

        $filters = [
            'date' => $date->toDateString(),
            'month' => $monthStart->format('Y-m'),
            'assigned_to' => array_map('strval', $assigneeIds),
            'team' => $this->listParam($request, 'team'),
            'type' => $types,
            'overdue' => $overdueOnly,
        ];

        return Inertia::render('calendar/index', [
            'filters' => $filters,
            'formOptions' => $this->formOptions(),
            'monthMarkers' => $payload['monthMarkers'],
            'dayEvents' => $payload['dayEvents'],
            'openedLead' => $this->openedLead($request),
            'openedOrder' => $this->openedOrder($request),
            'openedCampaign' => $this->openedCampaign($request),
            'openedProject' => $this->openedProject($request),
        ]);
    }

    /**
     * @return list<int>
     */
    protected function resolveAssigneeIds(Request $request, ?int $defaultUserId): array
    {
        $assignedTo = collect($this->listParam($request, 'assigned_to'))
            ->map(fn (string $value): int => (int) $value)
            ->filter(fn (int $value): bool => $value > 0)
            ->values()
            ->all();

        $teamCodes = $this->listParam($request, 'team');
        $teamUserIds = [];

        if ($teamCodes !== []) {
            $teamIds = Team::query()
                ->whereIn('code', $teamCodes)
                ->pluck('id')
                ->all();

            $teamUserIds = $teamIds === []
                ? []
                : TeamUser::query()
                    ->whereIn('team_id', $teamIds)
                    ->pluck('user_id')
                    ->unique()
                    ->values()
                    ->all();
        }

        if ($assignedTo === [] && $teamCodes === [] && ! $request->has('assigned_to')) {
            return $defaultUserId ? [$defaultUserId] : [];
        }

        if ($assignedTo === [] && $teamCodes !== []) {
            return array_map('intval', $teamUserIds);
        }

        if ($teamCodes !== []) {
            return array_values(array_intersect($assignedTo, array_map('intval', $teamUserIds)));
        }

        return $assignedTo;
    }

    /**
     * @return array<string, mixed>|null
     */
    protected function openedLead(Request $request): ?array
    {
        $code = $request->string('lead')->trim()->toString();

        if ($code === '') {
            return null;
        }

        $lead = Lead::query()
            ->with([
                'contact:id,first_name,last_name,email_address,phone_number',
                'project:id,title,code',
                'project.thumbnail.asset',
                'unit:id,code,name,project_id,price,status',
                'stage:id,label,title,color,priority',
                'campaign:id,title,public_id',
                'activeOrder',
                'tasks' => fn ($query) => $query->with(['gallery.asset', 'documents.asset'])->latest('id'),
            ])
            ->where('code', $code)
            ->first();

        if ($lead === null) {
            return null;
        }

        $this->hydrateAssignees(collect([$lead]));
        $this->hydrateProjectThumbnails(collect([$lead]));

        return (new LeadResource($lead))->resolve();
    }

    /**
     * @return array<string, mixed>|null
     */
    protected function openedOrder(Request $request): ?array
    {
        $code = $request->string('order')->trim()->toString();

        if ($code === '') {
            return null;
        }

        $order = Order::query()
            ->with([
                'contact:id,first_name,last_name,phone_number,email_address',
                'project:id,title,code',
                'unit:id,code,name,status',
                'assignee:id,display_name,first_name,last_name',
                'lead:id,code',
                'paymentPlan.installments',
            ])
            ->where('code', $code)
            ->first();

        if ($order === null) {
            return null;
        }

        $resource = (new OrderResource($order))->resolve();
        $resource['assigned_to'] = $order->assigned_to;
        $resource['assignee'] = $order->assignee ? [
            'id' => $order->assignee->id,
            'display_name' => $order->assignee->display_name
                ?: trim($order->assignee->first_name.' '.$order->assignee->last_name),
        ] : null;
        $resource['booked_at'] = $order->booked_at?->toIso8601String();
        $resource['allocated_at'] = $order->allocated_at?->toIso8601String();
        $resource['balloted_at'] = $order->balloted_at?->toIso8601String();
        $resource['handover_ready_at'] = $order->handover_ready_at?->toIso8601String();
        $resource['delivered_at'] = $order->delivered_at?->toIso8601String();
        $resource['href'] = '/bookings/'.$order->code;

        return $resource;
    }

    /**
     * @return array<string, mixed>|null
     */
    protected function openedCampaign(Request $request): ?array
    {
        $code = $request->string('campaign')->trim()->toString();

        if ($code === '') {
            return null;
        }

        $campaign = Campaign::query()
            ->with(['project:id,title,code', 'owner:id,display_name,first_name,last_name'])
            ->where(function ($query) use ($code): void {
                $query->where('slug', $code)->orWhere('public_id', $code);
            })
            ->first();

        if ($campaign === null) {
            return null;
        }

        $resource = (new CampaignResource($campaign))->resolve();
        $resource['owner'] = $campaign->owner ? [
            'id' => $campaign->owner->id,
            'display_name' => $campaign->owner->display_name
                ?: trim($campaign->owner->first_name.' '.$campaign->owner->last_name),
        ] : null;
        $resource['href'] = '/campaigns/'.$campaign->slug;

        return $resource;
    }

    /**
     * @return array<string, mixed>|null
     */
    protected function openedProject(Request $request): ?array
    {
        $code = $request->string('project')->trim()->toString();

        if ($code === '') {
            return null;
        }

        $project = Project::query()
            ->with(['phases' => fn ($query) => $query->orderBy('order')->orderBy('start_date')])
            ->where('code', $code)
            ->first();

        if ($project === null) {
            return null;
        }

        return [
            'id' => $project->id,
            'code' => $project->code,
            'title' => $project->title,
            'status' => $project->status,
            'start_date' => $project->start_date,
            'end_date' => $project->end_date,
            'progress' => $project->progress,
            'href' => '/projects/'.$project->code,
            'phases' => $project->phases->map(fn ($phase): array => [
                'id' => $phase->id,
                'title' => $phase->title,
                'status' => $phase->status,
                'start_date' => $phase->start_date?->toIso8601String(),
                'end_date' => $phase->end_date?->toIso8601String(),
                'progress' => $phase->progress,
            ])->values()->all(),
        ];
    }

    /**
     * @return array{
     *     assignees: list<array{id: int, display_name: string, title: ?string, avatar: ?string}>,
     *     teams: list<array{code: string, title: string, color: ?string}>,
     *     modules: list<array{id: string, label: string, color: string}>,
     *     projects: list<array{id: int, title: string, code: string}>,
     *     units: list<array{id: int, project_id: int, code: string, name: ?string, price: ?float, status: ?string}>,
     *     stages: list<array{id: int, label: string, title: string, color: ?string}>
     * }
     */
    protected function formOptions(): array
    {
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

        $teams = Team::query()
            ->orderBy('title')
            ->get(['code', 'title', 'color'])
            ->map(fn (Team $team): array => [
                'code' => $team->code,
                'title' => $team->title,
                'color' => $team->color,
            ])
            ->values()
            ->all();

        $modules = collect(CalendarEvents::COLORS)
            ->map(fn (string $color, string $id): array => [
                'id' => $id,
                'label' => ucfirst($id),
                'color' => $color,
            ])
            ->values()
            ->all();

        return [
            'assignees' => $assignees,
            'teams' => $teams,
            'modules' => $modules,
            'projects' => Project::query()
                ->orderBy('title')
                ->get(['id', 'title', 'code'])
                ->map(fn (Project $project): array => [
                    'id' => $project->id,
                    'title' => $project->title,
                    'code' => $project->code,
                ])
                ->values()
                ->all(),
            'units' => Unit::query()
                ->orderBy('code')
                ->get(['id', 'project_id', 'code', 'name', 'price', 'status'])
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
            'stages' => LeadStage::query()
                ->enabled()
                ->orderBy('priority')
                ->get(['id', 'label', 'title', 'color'])
                ->map(fn (LeadStage $stage): array => [
                    'id' => $stage->id,
                    'label' => $stage->label,
                    'title' => $stage->title,
                    'color' => $stage->color,
                ])
                ->values()
                ->all(),
        ];
    }

    /**
     * @param  Collection<int, Lead>  $leads
     */
    protected function hydrateAssignees(Collection $leads): void
    {
        $userIds = $leads->pluck('assigned_to')->filter()->unique()->values()->all();

        if ($userIds === []) {
            return;
        }

        $users = User::query()
            ->whereIn('id', $userIds)
            ->get(['id', 'display_name', 'first_name', 'last_name'])
            ->keyBy('id');

        $avatarUrls = $this->assets->urlsFor(User::class, $userIds, AssetManager::LINKAGE_AVATAR);

        $leads->each(function (Lead $lead) use ($users, $avatarUrls): void {
            $user = $lead->assigned_to ? $users->get($lead->assigned_to) : null;

            if ($user === null) {
                $lead->setRelation('assignee', null);

                return;
            }

            $user->setAttribute('avatar', $avatarUrls->get($user->id));
            $user->display_name = $user->display_name
                ?: trim($user->first_name.' '.$user->last_name);
            $lead->setRelation('assignee', $user);
        });
    }

    /**
     * @param  Collection<int, Lead>  $leads
     */
    protected function hydrateProjectThumbnails(Collection $leads): void
    {
        $leads->each(function (Lead $lead): void {
            if ($lead->relationLoaded('project') && $lead->project !== null) {
                $lead->project->setAttribute(
                    'thumbnail_url',
                    $this->assets->url($lead->project->thumbnail?->asset),
                );
            }
        });
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

    protected function parseMonth(string $value): ?Carbon
    {
        $value = trim($value);

        if ($value === '') {
            return null;
        }

        try {
            return Carbon::createFromFormat('Y-m', $value)->startOfMonth();
        } catch (\Throwable) {
            return $this->parseDate($value)?->startOfMonth();
        }
    }
}

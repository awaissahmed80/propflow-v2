<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\BulkOrderRequest;
use App\Http\Requests\Portal\UpdateOrderRequest;
use App\Http\Resources\Portal\OrderResource;
use App\Models\BookingDocumentType;
use App\Models\Contact;
use App\Models\LeadActionType;
use App\Models\Order;
use App\Models\OrderStage;
use App\Models\OrderStatus;
use App\Models\PaymentAccount;
use App\Models\PaymentInstallment;
use App\Models\Project;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\Unit;
use App\Models\User;
use App\Services\DealPipeline;
use App\Services\OrderService;
use App\Support\AssetManager;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    public function __construct(
        protected OrderService $orders,
        protected DealPipeline $deals,
    ) {}

    public function index(Request $request): Response
    {
        return $this->list($request);
    }

    public function show(Order $order): RedirectResponse
    {
        return redirect('/bookings?booking='.$order->code);
    }

    public function panel(Order $order): JsonResponse
    {
        return response()->json($this->bookingPanelPayload($order));
    }

    public function update(UpdateOrderRequest $request, Order $order): RedirectResponse
    {
        $data = $request->safe()->only(['project_id', 'assigned_to', 'status']);

        if (array_key_exists('status', $data) && $data['status'] !== null) {
            if (! $order->isOpen()) {
                return back()->withErrors([
                    'status' => 'Closed bookings cannot change status.',
                ]);
            }

            if (in_array($data['status'], Order::automatedStatuses(), true)) {
                return back()->withErrors([
                    'status' => 'That status is set automatically by the payment pipeline.',
                ]);
            }
        }

        $order->update($data);

        return redirect('/bookings?booking='.$order->code);
    }

    public function cancel(Request $request, Order $order): RedirectResponse
    {
        $this->orders->cancel($order, $request->user()?->id);

        return back();
    }

    public function allocate(Request $request, Order $order): RedirectResponse
    {
        $this->orders->allocate($order, $request->user()?->id);

        return back();
    }

    public function bulk(BulkOrderRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        /** @var list<int> $ids */
        $ids = array_map('intval', $validated['ids']);
        $action = $validated['action'];

        $orders = Order::query()->whereIn('id', $ids)->get();

        if ($action === 'assign') {
            $assignedTo = $validated['assigned_to'] ?? null;

            $orders->each(function (Order $order) use ($assignedTo): void {
                if ($order->isOpen()) {
                    $order->update(['assigned_to' => $assignedTo]);
                }
            });

            return back();
        }

        if ($action === 'status') {
            $status = (string) $validated['status'];

            if (in_array($status, Order::automatedStatuses(), true)) {
                return back()->withErrors([
                    'status' => 'That status is set automatically by the payment pipeline.',
                ]);
            }

            if (! in_array($status, Order::manualStatuses(), true)) {
                return back()->withErrors([
                    'status' => 'That status cannot be set manually.',
                ]);
            }

            $orders->each(function (Order $order) use ($status): void {
                if ($order->isOpen()) {
                    $order->update(['status' => $status]);
                }
            });

            return back();
        }

        if ($action === 'cancel') {
            $orders->each(function (Order $order) use ($request): void {
                if ($order->isOpen()) {
                    $this->orders->cancel($order, $request->user()?->id);
                }
            });
        }

        return back();
    }

    protected function list(Request $request): Response
    {
        $filters = $this->filtersFromRequest($request);

        $query = Order::query()
            ->with([
                'contact:id,uuid,first_name,last_name,phone_number,email_address,cnic',
                'project:id,title,code,location,city',
                'project.thumbnail.asset',
                'unit:id,name,status,type,size,area_type,project_id',
                'lead:id,code,tag,lead_stage_id,assigned_to,user_id',
                'lead.stage:id,label,title,color',
                'lead.assignee:id,display_name,first_name,last_name,email_address',
                'lead.creator:id,display_name,first_name,last_name,email_address',
                'assignee:id,display_name,first_name,last_name',
            ])
            ->withCount([
                'installments as unpaid_count' => fn ($query) => $query->where('status', PaymentInstallment::STATUS_PENDING),
            ])
            ->withSum('payments as payments_sum', 'amount');

        $this->applyFilters($query, $filters);

        $paginator = $query
            ->latest('id')
            ->paginate(20)
            ->withQueryString();

        $this->hydrateOrderMedia($paginator->getCollection());

        return Inertia::render('bookings/index', [
            'orders' => OrderResource::collection($paginator->getCollection())->resolve(),
            'pagination' => $this->pagination($paginator),
            'filters' => $filters,
            'openedBooking' => $this->openedBooking($request),
            'orderStages' => $this->orderStagesPayload(),
            'orderStatuses' => OrderStatus::catalog(enabledOnly: false),
            'projects' => $this->projectOptions(),
            'units' => $this->unitOptions(),
            'paymentAccounts' => $this->paymentAccountOptions(),
            'assignees' => $this->assigneeOptions(),
            'activityTypes' => LeadActionType::catalog(LeadActionType::KIND_ACTIVITY, enabledOnly: true),
            'contactOptions' => [
                'tags' => Contact::tags(),
                'types' => Contact::types(),
                'income_levels' => Contact::incomeLevels(),
                'affordability_levels' => Contact::affordabilityLevels(),
                'capability_levels' => Contact::capabilityLevels(),
            ],
            'bookingDocumentTypes' => BookingDocumentType::catalog(),
        ]);
    }

    /**
     * @return array{q: ?string, stage: list<string>, status: list<string>, project: list<string>, assigned_to: list<string>}
     */
    protected function filtersFromRequest(Request $request): array
    {
        return [
            'q' => $request->string('q')->trim()->toString() ?: null,
            'stage' => $this->csvList($request->string('stage')->toString()),
            'status' => $this->csvList($request->string('status')->toString()),
            'project' => $this->csvList($request->string('project')->toString()),
            'assigned_to' => $this->csvList($request->string('assigned_to')->toString()),
        ];
    }

    /**
     * @return list<string>
     */
    protected function csvList(string $value): array
    {
        if ($value === '') {
            return [];
        }

        return collect(explode(',', $value))
            ->map(fn (string $item): string => trim($item))
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @param  Builder<Order>  $query
     * @param  array{q: ?string, stage: list<string>, status: list<string>, project: list<string>, assigned_to: list<string>}  $filters
     */
    protected function applyFilters(Builder $query, array $filters): void
    {
        if ($filters['status'] === [] || ! in_array(Order::STATUS_CANCELLED, $filters['status'], true)) {
            $query->where('status', '!=', Order::STATUS_CANCELLED);
        }

        if ($filters['q']) {
            $q = $filters['q'];
            $query->where(function (Builder $inner) use ($q): void {
                $inner->where('code', 'like', '%'.$q.'%')
                    ->orWhere('plot_or_file', 'like', '%'.$q.'%')
                    ->orWhereHas('contact', fn (Builder $contact) => $contact->matchingSearch($q))
                    ->orWhereHas('project', fn (Builder $project) => $project->where('title', 'like', '%'.$q.'%'))
                    ->orWhereHas('unit', function (Builder $unit) use ($q): void {
                        $unit->where('name', 'like', '%'.$q.'%')
                            ->orWhere('code', 'like', '%'.$q.'%');
                    });
            });
        }

        if ($filters['stage'] !== []) {
            $query->whereIn('stage', $filters['stage']);
        }

        if ($filters['status'] !== []) {
            $query->whereIn('status', $filters['status']);
        }

        if ($filters['project'] !== []) {
            $query->whereIn('project_id', array_map('intval', $filters['project']));
        }

        if ($filters['assigned_to'] !== []) {
            $query->whereIn('assigned_to', array_map('intval', $filters['assigned_to']));
        }
    }

    /**
     * @return list<array{id: int, label: string, title: string, priority: int, color: ?string, is_system: bool, is_enabled: bool}>
     */
    protected function orderStagesPayload(): array
    {
        OrderStage::ensureDefaults();

        return OrderStage::query()
            ->orderBy('priority')
            ->get(['id', 'label', 'title', 'priority', 'color', 'is_system', 'is_enabled'])
            ->map(fn (OrderStage $stage): array => [
                'id' => $stage->id,
                'label' => (string) $stage->label,
                'title' => (string) $stage->title,
                'priority' => (int) $stage->priority,
                'color' => $stage->color,
                'is_system' => (bool) $stage->is_system,
                'is_enabled' => (bool) $stage->is_enabled,
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>|null
     */
    protected function openedBooking(Request $request): ?array
    {
        $code = $request->string('booking')->trim()->toString();

        if ($code === '') {
            return null;
        }

        $order = Order::query()->where('code', $code)->first();

        if ($order === null) {
            return null;
        }

        return $this->bookingPanelPayload($order);
    }

    /**
     * @return array{order: array<string, mixed>, deal: array<string, mixed>}
     */
    protected function bookingPanelPayload(Order $order): array
    {
        $order->load([
            'contact:id,uuid,first_name,last_name,phone_number,email_address,cnic,type',
            'project:id,title,code,location,city',
            'project.thumbnail.asset',
            'unit:id,name,description,status,type,sector,price,size,area_type,quantity,features,project_id,project_block_id',
            'unit.block:id,title',
            'lead:id,code,tag,lead_stage_id,assigned_to,user_id,budget,source',
            'lead.stage:id,label,title,color',
            'lead.project:id,title,code',
            'lead.assignee:id,display_name,first_name,last_name,email_address',
            'lead.creator:id,display_name,first_name,last_name,email_address',
            'assignee:id,display_name,first_name,last_name,email_address',
            'paymentPlan.installments',
        ]);

        if ($order->project) {
            $order->project->setAttribute(
                'thumbnail_url',
                app(AssetManager::class)->url($order->project->thumbnail?->asset),
            );
        }

        $userIds = collect([
            $order->assigned_to,
            $order->lead?->assigned_to,
            $order->lead?->user_id,
        ])->filter()->unique()->values()->all();

        if ($userIds !== []) {
            $avatars = app(AssetManager::class)->urlsFor(User::class, $userIds, AssetManager::LINKAGE_AVATAR);
            $tenant = Tenant::current();
            $membershipCodes = $tenant
                ? TenantUser::query()
                    ->where('tenant_id', $tenant->id)
                    ->whereIn('user_id', $userIds)
                    ->pluck('code', 'user_id')
                : collect();

            if ($order->assignee) {
                $order->assignee->setAttribute('avatar', $avatars->get($order->assignee->id));
                $order->assignee->setAttribute('code', $membershipCodes->get($order->assignee->id));
            }

            if ($order->lead?->assignee) {
                $order->lead->assignee->setAttribute('avatar', $avatars->get($order->lead->assignee->id));
                $order->lead->assignee->setAttribute('code', $membershipCodes->get($order->lead->assignee->id));
            }

            if ($order->lead?->creator) {
                $order->lead->creator->setAttribute('avatar', $avatars->get($order->lead->creator->id));
                $order->lead->creator->setAttribute('code', $membershipCodes->get($order->lead->creator->id));
            }
        }

        $order->ensureDocumentFolder();

        return [
            'order' => (new OrderResource($order))->resolve(),
            'deal' => $this->deals->snapshot($order),
        ];
    }

    /**
     * @return array{current_page: int, last_page: int, per_page: int, total: int, from: ?int, to: ?int}
     */
    protected function pagination(LengthAwarePaginator $paginator): array
    {
        return [
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'from' => $paginator->firstItem(),
            'to' => $paginator->lastItem(),
        ];
    }

    /**
     * @param  Collection<int, Order>  $orders
     */
    protected function hydrateOrderMedia(Collection $orders): void
    {
        $assets = app(AssetManager::class);

        foreach ($orders as $order) {
            if ($order->project) {
                $order->project->setAttribute(
                    'thumbnail_url',
                    $assets->url($order->project->thumbnail?->asset),
                );
            }
        }

        $userIds = $orders
            ->flatMap(fn (Order $order): array => array_filter([
                $order->assigned_to,
                $order->lead?->assigned_to,
                $order->lead?->user_id,
            ]))
            ->unique()
            ->values()
            ->all();

        if ($userIds === []) {
            return;
        }

        $avatars = $assets->urlsFor(User::class, $userIds, AssetManager::LINKAGE_AVATAR);

        $tenant = Tenant::current();
        $membershipCodes = $tenant
            ? TenantUser::query()
                ->where('tenant_id', $tenant->id)
                ->whereIn('user_id', $userIds)
                ->pluck('code', 'user_id')
            : collect();

        foreach ($orders as $order) {
            if ($order->assignee) {
                $order->assignee->setAttribute('avatar', $avatars->get($order->assignee->id));
                $order->assignee->setAttribute('code', $membershipCodes->get($order->assignee->id));
            }

            if ($order->lead?->assignee) {
                $order->lead->assignee->setAttribute('avatar', $avatars->get($order->lead->assignee->id));
                $order->lead->assignee->setAttribute('code', $membershipCodes->get($order->lead->assignee->id));
            }

            if ($order->lead?->creator) {
                $order->lead->creator->setAttribute('avatar', $avatars->get($order->lead->creator->id));
                $order->lead->creator->setAttribute('code', $membershipCodes->get($order->lead->creator->id));
            }
        }
    }

    /**
     * @return list<array{id: int, title: string, thumbnail: ?string}>
     */
    protected function projectOptions(): array
    {
        return Project::query()
            ->with(['thumbnail.asset'])
            ->orderBy('title')
            ->get(['id', 'title'])
            ->map(fn (Project $project): array => [
                'id' => $project->id,
                'title' => $project->title,
                'thumbnail' => app(AssetManager::class)->url($project->thumbnail?->asset),
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<array{id: int, project_id: int, name: ?string, price: ?float, status: ?string}>
     */
    protected function unitOptions(): array
    {
        return Unit::query()
            ->orderBy('name')
            ->orderBy('id')
            ->get(['id', 'project_id', 'name', 'price', 'status'])
            ->map(fn (Unit $unit): array => [
                'id' => $unit->id,
                'project_id' => $unit->project_id,
                'name' => $unit->name,
                'price' => $unit->price !== null ? (float) $unit->price : null,
                'status' => $unit->status,
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<array{id: int, type: string, name: string, bank_name: ?string, account_title: ?string, account_number: ?string, iban: ?string, swift: ?string, branch: ?string, is_default: bool, is_enabled: bool}>
     */
    protected function paymentAccountOptions(): array
    {
        return collect(PaymentAccount::catalog())
            ->filter(fn (array $account): bool => (bool) ($account['is_enabled'] ?? false))
            ->values()
            ->all();
    }

    /**
     * @return list<array{id: int, display_name: string, avatar: ?string}>
     */
    protected function assigneeOptions(): array
    {
        $tenant = Tenant::current();

        if ($tenant === null) {
            return [];
        }

        $memberships = TenantUser::query()
            ->with(['user:id,display_name,first_name,last_name'])
            ->where('tenant_id', $tenant->id)
            ->orderBy('id')
            ->get()
            ->filter(fn (TenantUser $membership): bool => $membership->user !== null)
            ->values();

        $avatars = app(AssetManager::class)->urlsFor(
            User::class,
            $memberships->pluck('user_id')->all(),
            AssetManager::LINKAGE_AVATAR,
        );

        return $memberships
            ->map(fn (TenantUser $membership): array => [
                'id' => $membership->user->id,
                'display_name' => $membership->user->display_name
                    ?: trim($membership->user->first_name.' '.$membership->user->last_name),
                'avatar' => $avatars->get($membership->user_id),
            ])
            ->all();
    }
}

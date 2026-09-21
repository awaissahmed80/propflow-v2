<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\UpdateOrderRequest;
use App\Http\Resources\Portal\OrderResource;
use App\Models\LeadActionType;
use App\Models\Order;
use App\Models\OrderStage;
use App\Models\OrderStatus;
use App\Models\PaymentInstallment;
use App\Models\Project;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\DealPipeline;
use App\Services\OrderService;
use App\Support\AssetManager;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
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

    public function update(UpdateOrderRequest $request, Order $order): RedirectResponse
    {
        $order->update($request->safe()->only(['project_id', 'assigned_to']));

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

    protected function list(Request $request): Response
    {
        $paginator = Order::query()
            ->with([
                'contact:id,first_name,last_name,phone_number,email_address',
                'project:id,title',
                'project.thumbnail.asset',
                'unit:id,code,name,status',
                'lead:id,code,tag,lead_stage_id,assigned_to,user_id',
                'lead.stage:id,label,title,color',
                'assignee:id,display_name,first_name,last_name',
            ])
            ->withCount([
                'installments as unpaid_count' => fn ($query) => $query->where('status', PaymentInstallment::STATUS_PENDING),
            ])
            ->where('status', '!=', Order::STATUS_CANCELLED)
            ->latest('id')
            ->paginate(20)
            ->withQueryString();

        $this->hydrateOrderMedia($paginator->getCollection());

        return Inertia::render('bookings/index', [
            'orders' => OrderResource::collection($paginator->getCollection())->resolve(),
            'pagination' => $this->pagination($paginator),
            'openedBooking' => $this->openedBooking($request),
            'orderStages' => $this->orderStagesPayload(),
            'projects' => $this->projectOptions(),
            'assignees' => $this->assigneeOptions(),
            'activityTypes' => LeadActionType::catalog(LeadActionType::KIND_ACTIVITY, enabledOnly: true),
        ]);
    }

    /**
     * @return list<array{id: int, label: string, title: string, priority: int, color: ?string, is_system: bool, is_enabled: bool, statuses: list<array{id: int, stage_label: string, label: string, title: string, priority: int, color: ?string, is_system: bool, is_enabled: bool}>}>
     */
    protected function orderStagesPayload(): array
    {
        OrderStage::ensureDefaults();
        OrderStatus::ensureDefaults();

        $statuses = collect(OrderStatus::catalog(enabledOnly: false))
            ->groupBy('stage_label');

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
                'statuses' => ($statuses->get($stage->label) ?? collect())->values()->all(),
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

        $order = Order::query()
            ->with([
                'contact:id,first_name,last_name,phone_number,email_address,type',
                'project:id,title,code',
                'project.thumbnail.asset',
                'unit:id,code,name,status',
                'lead:id,code,tag,lead_stage_id,assigned_to,user_id,budget,source',
                'lead.stage:id,label,title,color',
                'lead.project:id,title,code',
                'lead.assignee:id,display_name,first_name,last_name,email_address',
                'lead.creator:id,display_name,first_name,last_name,email_address',
                'assignee:id,display_name,first_name,last_name,email_address',
                'paymentPlan.installments',
            ])
            ->where('code', $code)
            ->first();

        if ($order === null) {
            return null;
        }

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

            if ($order->assignee) {
                $order->assignee->setAttribute('avatar', $avatars->get($order->assignee->id));
            }

            if ($order->lead?->assignee) {
                $order->lead->assignee->setAttribute('avatar', $avatars->get($order->lead->assignee->id));
            }

            if ($order->lead?->creator) {
                $order->lead->creator->setAttribute('avatar', $avatars->get($order->lead->creator->id));
            }
        }

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

        $userIds = $orders->pluck('assigned_to')->filter()->unique()->values()->all();

        if ($userIds === []) {
            return;
        }

        $avatars = $assets->urlsFor(User::class, $userIds, AssetManager::LINKAGE_AVATAR);

        foreach ($orders as $order) {
            if ($order->assignee) {
                $order->assignee->setAttribute('avatar', $avatars->get($order->assignee->id));
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

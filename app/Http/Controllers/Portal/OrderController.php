<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Resources\Portal\OrderResource;
use App\Models\Order;
use App\Models\OrderStage;
use App\Models\PaymentInstallment;
use App\Models\User;
use App\Services\DealPipeline;
use App\Services\OrderService;
use App\Support\AssetManager;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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

        return Inertia::render('bookings/index', [
            'orders' => OrderResource::collection($paginator->getCollection())->resolve(),
            'pagination' => $this->pagination($paginator),
            'openedBooking' => $this->openedBooking($request),
            'orderStages' => OrderStage::catalog(enabledOnly: false),
        ]);
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
}

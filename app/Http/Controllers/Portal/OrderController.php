<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Resources\Portal\OrderResource;
use App\Models\Order;
use App\Models\PaymentInstallment;
use App\Services\DealPipeline;
use App\Services\OrderService;
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
        $paginator = Order::query()
            ->with([
                'contact:id,first_name,last_name,phone_number,email_address',
                'project:id,title',
                'unit:id,code,name,status',
            ])
            ->withCount([
                'installments as unpaid_count' => fn ($query) => $query->where('status', PaymentInstallment::STATUS_PENDING),
            ])
            ->latest('id')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('orders/index', [
            'orders' => OrderResource::collection($paginator->getCollection())->resolve(),
            'pagination' => $this->pagination($paginator),
        ]);
    }

    public function show(Order $order): Response
    {
        $order->load([
            'contact:id,first_name,last_name,phone_number,email_address',
            'project:id,title',
            'unit:id,code,name,status',
            'lead:id,code',
            'paymentPlan.installments',
        ]);

        return Inertia::render('orders/show', [
            'order' => (new OrderResource($order))->resolve(),
            'deal' => $this->deals->snapshot($order),
        ]);
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

<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Resources\Portal\OrderResource;
use App\Models\Order;
use App\Models\PaymentInstallment;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AllocationController extends Controller
{
    public function index(Request $request): Response
    {
        $paginator = Order::query()
            ->where('status', Order::STATUS_BOOKED)
            ->with([
                'contact:id,first_name,last_name',
                'project:id,title',
                'unit:id,code,name,status',
                'paymentPlan.installments',
            ])
            ->withCount([
                'installments as unpaid_count' => fn ($query) => $query->where('status', PaymentInstallment::STATUS_PENDING),
            ])
            ->latest('id')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('allocation/index', [
            'orders' => OrderResource::collection($paginator->getCollection())->resolve(),
            'pagination' => $this->pagination($paginator),
        ]);
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

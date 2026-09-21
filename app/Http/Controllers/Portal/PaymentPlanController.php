<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Models\PaymentInstallment;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PaymentPlanController extends Controller
{
    public function index(Request $request): Response
    {
        $paginator = PaymentInstallment::query()
            ->with([
                'plan.order:id,code,status,contact_id,unit_id',
                'plan.order.contact:id,first_name,last_name',
                'plan.order.unit:id,code,name',
            ])
            ->orderByRaw("case when status = 'pending' then 0 else 1 end")
            ->orderBy('due_on')
            ->orderBy('id')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('payment-plans/index', [
            'installments' => $paginator->getCollection()->map(function (PaymentInstallment $row): array {
                $order = $row->plan?->order;
                $contact = $order?->contact;

                return [
                    'id' => $row->id,
                    'sequence' => $row->sequence,
                    'label' => $row->label,
                    'amount' => (float) $row->amount,
                    'due_on' => $row->due_on?->toDateString(),
                    'status' => $row->status,
                    'paid_at' => $row->paid_at?->toIso8601String(),
                    'order' => $order ? [
                        'id' => $order->id,
                        'code' => $order->code,
                        'status' => $order->status,
                    ] : null,
                    'buyer' => $contact
                        ? (trim(implode(' ', array_filter([$contact->first_name, $contact->last_name]))) ?: 'Contact #'.$contact->id)
                        : null,
                    'unit' => $order?->unit?->code ?: $order?->unit?->name,
                ];
            })->values()->all(),
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

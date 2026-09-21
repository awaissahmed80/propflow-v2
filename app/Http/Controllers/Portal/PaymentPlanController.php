<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Models\PaymentInstallment;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class PaymentPlanController extends Controller
{
    public function index(Request $request): Response
    {
        $month = $request->string('month')->toString();
        $from = $request->string('from')->toString();
        $to = $request->string('to')->toString();
        $hasHistoryFilter = filled($month) || filled($from) || filled($to);

        $query = PaymentInstallment::query()
            ->with([
                'plan.order:id,code,status,contact_id,unit_id',
                'plan.order.contact:id,first_name,last_name',
                'plan.order.unit:id,code,name',
            ]);

        if ($hasHistoryFilter) {
            if (filled($month) && preg_match('/^\d{4}-\d{2}$/', $month) === 1) {
                $start = Carbon::createFromFormat('Y-m', $month)->startOfMonth();
                $end = $start->copy()->endOfMonth();
                $query->whereDate('due_on', '>=', $start->toDateString())
                    ->whereDate('due_on', '<=', $end->toDateString());
            }

            if (filled($from)) {
                $query->whereDate('due_on', '>=', $from);
            }

            if (filled($to)) {
                $query->whereDate('due_on', '<=', $to);
            }
        } else {
            $query->where('status', PaymentInstallment::STATUS_PENDING);
        }

        $paginator = $query
            ->orderBy('due_on')
            ->orderBy('id')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('receivables/installments', [
            'filters' => [
                'month' => $month !== '' ? $month : null,
                'from' => $from !== '' ? $from : null,
                'to' => $to !== '' ? $to : null,
                'mode' => $hasHistoryFilter ? 'history' : 'upcoming',
            ],
            'installments' => $paginator->getCollection()->map(function (PaymentInstallment $row): array {
                $order = $row->plan?->order;
                $contact = $order?->contact;
                $overdue = $row->isPending()
                    && $row->due_on !== null
                    && $row->due_on->lt(today());

                return [
                    'id' => $row->id,
                    'sequence' => $row->sequence,
                    'label' => $row->label,
                    'amount' => (float) $row->amount,
                    'due_on' => $row->due_on?->toDateString(),
                    'status' => $row->status,
                    'overdue' => $overdue,
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

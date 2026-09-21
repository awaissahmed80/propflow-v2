<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\PaymentInstallment;
use App\Services\OrderService;
use Illuminate\Http\RedirectResponse;

class PaymentInstallmentController extends Controller
{
    public function __construct(protected OrderService $orders) {}

    public function pay(Order $order, int $sequence): RedirectResponse
    {
        $installment = PaymentInstallment::query()
            ->where('sequence', $sequence)
            ->whereHas('plan', fn ($query) => $query->where('order_id', $order->id))
            ->firstOrFail();

        $this->orders->markPaid($installment);

        return back();
    }
}

<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\BallotOrderRequest;
use App\Http\Requests\Portal\GeneratePaymentPlanRequest;
use App\Http\Requests\Portal\HandoverOrderRequest;
use App\Http\Requests\Portal\RecordOrderPaymentRequest;
use App\Http\Requests\Portal\TransferOrderRequest;
use App\Http\Requests\Portal\VerifyBookingRequest;
use App\Models\Order;
use App\Services\DealPipeline;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class DealController extends Controller
{
    public function __construct(protected DealPipeline $deals) {}

    public function storeBooking(VerifyBookingRequest $request, Order $order): RedirectResponse
    {
        $this->deals->verify($order, $request->validated(), $request->user()?->id);

        return back();
    }

    public function plan(GeneratePaymentPlanRequest $request, Order $order): RedirectResponse
    {
        $this->deals->generatePlan($order, $request->validated());

        return back();
    }

    public function payment(RecordOrderPaymentRequest $request, Order $order): RedirectResponse
    {
        $this->deals->recordPayment($order, $request->validated(), $request->file('receipt'));

        return back();
    }

    public function ballot(BallotOrderRequest $request, Order $order): RedirectResponse
    {
        $this->deals->ballot($order, $request->validated(), $request->user()?->id);

        return back();
    }

    public function transfer(TransferOrderRequest $request, Order $order): RedirectResponse
    {
        $this->deals->transfer($order, $request->validated(), $request->user()?->id);

        return back();
    }

    public function handover(HandoverOrderRequest $request, Order $order): RedirectResponse
    {
        $this->deals->ready($order, $request->validated(), $request->user()?->id);

        return back();
    }

    public function deliver(Order $order): RedirectResponse
    {
        $this->deals->deliver($order, request()->user()?->id);

        return back();
    }

    public function showBookingForm(Order $order): View
    {
        $order->load(['contact', 'project', 'unit.block', 'paymentPlan']);
        $deal = $this->deals->snapshot($order);

        return view('portal.booking-form', [
            'order' => $order,
            'deal' => $deal,
        ]);
    }
}

<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\StoreOrderActivityRequest;
use App\Models\Order;
use App\Services\OrderActivity;
use Illuminate\Http\RedirectResponse;

class OrderActivityController extends Controller
{
    public function __construct(protected OrderActivity $activity) {}

    public function store(StoreOrderActivityRequest $request, Order $order): RedirectResponse
    {
        $this->activity->recordUpdate($order, $request->validated(), $request->user()?->id);

        return back();
    }
}

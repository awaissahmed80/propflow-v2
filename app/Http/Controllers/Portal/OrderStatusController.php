<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\UpdateOrderStatusRequest;
use App\Models\OrderStatus;
use Illuminate\Http\RedirectResponse;

class OrderStatusController extends Controller
{
    public function update(UpdateOrderStatusRequest $request, OrderStatus $status): RedirectResponse
    {
        $validated = $request->validated();

        $status->forceFill([
            'title' => $validated['title'] ?? $status->title,
            'color' => array_key_exists('color', $validated) ? ($validated['color'] ?? $status->color) : $status->color,
        ])->save();

        return back();
    }
}

<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\UpdateOrderStageRequest;
use App\Models\OrderStage;
use Illuminate\Http\RedirectResponse;

class OrderStageController extends Controller
{
    public function update(UpdateOrderStageRequest $request, OrderStage $stage): RedirectResponse
    {
        $validated = $request->validated();

        $stage->forceFill([
            'title' => $validated['title'] ?? $stage->title,
            'color' => array_key_exists('color', $validated) ? ($validated['color'] ?? $stage->color) : $stage->color,
        ])->save();

        return back();
    }

    public function store(): RedirectResponse
    {
        return back()->withErrors([
            'stage' => 'Booking stages are fixed and cannot be added.',
        ]);
    }

    public function reorder(): RedirectResponse
    {
        return back()->withErrors([
            'stage' => 'Booking stages cannot be reordered.',
        ]);
    }

    public function destroy(): RedirectResponse
    {
        return back()->withErrors([
            'stage' => 'Booking stages cannot be deleted.',
        ]);
    }
}

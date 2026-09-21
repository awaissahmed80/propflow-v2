<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\ReorderOrderStagesRequest;
use App\Http\Requests\Portal\StoreOrderStageRequest;
use App\Http\Requests\Portal\UpdateOrderStageRequest;
use App\Models\Order;
use App\Models\OrderStage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OrderStageController extends Controller
{
    public function store(StoreOrderStageRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $maxPriority = (int) OrderStage::query()->max('priority');

        OrderStage::query()->create([
            'label' => $validated['label'] ?? Str::slug($validated['title'], '_'),
            'title' => $validated['title'],
            'color' => $validated['color'] ?? '#64748B',
            'priority' => $maxPriority + 1,
            'is_system' => false,
            'is_enabled' => true,
        ]);

        return back();
    }

    public function update(UpdateOrderStageRequest $request, OrderStage $stage): RedirectResponse
    {
        $validated = $request->validated();

        if (array_key_exists('is_enabled', $validated)) {
            $nextEnabled = (bool) $validated['is_enabled'];

            if (
                ! $nextEnabled
                && $stage->is_enabled
                && OrderStage::query()
                    ->enabled()
                    ->whereKeyNot($stage->id)
                    ->doesntExist()
            ) {
                return back()->withErrors([
                    'stage' => 'At least one enabled booking stage is required.',
                ]);
            }
        }

        $stage->forceFill([
            'title' => $validated['title'] ?? $stage->title,
            'color' => array_key_exists('color', $validated) ? ($validated['color'] ?? $stage->color) : $stage->color,
            'label' => $stage->is_system
                ? $stage->label
                : ($validated['label'] ?? $stage->label),
            'is_enabled' => array_key_exists('is_enabled', $validated)
                ? (bool) $validated['is_enabled']
                : $stage->is_enabled,
        ])->save();

        return back();
    }

    public function reorder(ReorderOrderStagesRequest $request): RedirectResponse
    {
        $order = $request->validated('order');

        DB::connection('tenant')->transaction(function () use ($order): void {
            foreach ($order as $index => $stageId) {
                OrderStage::query()
                    ->whereKey($stageId)
                    ->update(['priority' => $index + 1]);
            }
        });

        return back();
    }

    public function destroy(OrderStage $stage): RedirectResponse
    {
        if ($stage->is_system) {
            return back()->withErrors([
                'stage' => 'Default stages cannot be deleted. Turn them off instead.',
            ]);
        }

        if (OrderStage::query()->enabled()->whereKeyNot($stage->id)->doesntExist()) {
            return back()->withErrors([
                'stage' => 'At least one enabled booking stage is required.',
            ]);
        }

        DB::connection('tenant')->transaction(function () use ($stage): void {
            $fallback = OrderStage::query()
                ->enabled()
                ->whereKeyNot($stage->id)
                ->where('is_system', true)
                ->orderBy('priority')
                ->value('label')
                ?? Order::STAGE_BOOKING;

            Order::query()
                ->where('stage', $stage->label)
                ->update(['stage' => $fallback]);

            $stage->delete();

            $remaining = OrderStage::query()->orderBy('priority')->pluck('id');

            foreach ($remaining as $index => $id) {
                OrderStage::query()->whereKey($id)->update(['priority' => $index + 1]);
            }
        });

        return back();
    }
}

<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\ReorderLeadStagesRequest;
use App\Http\Requests\Portal\StoreLeadStageRequest;
use App\Http\Requests\Portal\UpdateLeadStageRequest;
use App\Models\Lead;
use App\Models\LeadStage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LeadStageController extends Controller
{
    public function store(StoreLeadStageRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $maxPriority = (int) LeadStage::query()->max('priority');

        LeadStage::query()->create([
            'label' => $validated['label'] ?? Str::slug($validated['title'], '_'),
            'title' => $validated['title'],
            'color' => $validated['color'] ?? '#64748B',
            'priority' => $maxPriority + 1,
            'is_system' => false,
            'is_enabled' => true,
        ]);

        return back();
    }

    public function update(UpdateLeadStageRequest $request, LeadStage $stage): RedirectResponse
    {
        $validated = $request->validated();

        if (array_key_exists('is_enabled', $validated)) {
            $nextEnabled = (bool) $validated['is_enabled'];

            if (
                ! $nextEnabled
                && $stage->is_enabled
                && LeadStage::query()
                    ->enabled()
                    ->whereKeyNot($stage->id)
                    ->doesntExist()
            ) {
                return back()->withErrors([
                    'stage' => 'At least one enabled pipeline stage is required.',
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

    public function reorder(ReorderLeadStagesRequest $request): RedirectResponse
    {
        $order = $request->validated('order');

        DB::connection('tenant')->transaction(function () use ($order): void {
            foreach ($order as $index => $stageId) {
                LeadStage::query()
                    ->whereKey($stageId)
                    ->update(['priority' => $index + 1]);
            }
        });

        return back();
    }

    public function destroy(LeadStage $stage): RedirectResponse
    {
        if ($stage->is_system) {
            return back()->withErrors([
                'stage' => 'Default stages cannot be deleted. Turn them off instead.',
            ]);
        }

        if (LeadStage::query()->enabled()->whereKeyNot($stage->id)->doesntExist()) {
            return back()->withErrors([
                'stage' => 'At least one enabled pipeline stage is required.',
            ]);
        }

        DB::connection('tenant')->transaction(function () use ($stage): void {
            Lead::query()
                ->where('lead_stage_id', $stage->id)
                ->active()
                ->update(['archived_at' => now()]);

            $stage->delete();

            $remaining = LeadStage::query()->orderBy('priority')->pluck('id');

            foreach ($remaining as $index => $id) {
                LeadStage::query()->whereKey($id)->update(['priority' => $index + 1]);
            }
        });

        return back();
    }
}

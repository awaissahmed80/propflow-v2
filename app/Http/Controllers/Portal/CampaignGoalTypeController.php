<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\ReorderCampaignGoalTypesRequest;
use App\Http\Requests\Portal\StoreCampaignGoalTypeRequest;
use App\Http\Requests\Portal\UpdateCampaignGoalTypeRequest;
use App\Models\Campaign;
use App\Models\CampaignGoalType;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CampaignGoalTypeController extends Controller
{
    public function store(StoreCampaignGoalTypeRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $maxPriority = (int) CampaignGoalType::query()->max('priority');

        CampaignGoalType::query()->create([
            'label' => $validated['label'] ?? Str::slug($validated['title'], '_'),
            'title' => $validated['title'],
            'color' => $validated['color'] ?? '#64748B',
            'priority' => $maxPriority + 1,
        ]);

        return back();
    }

    public function update(UpdateCampaignGoalTypeRequest $request, CampaignGoalType $goalType): RedirectResponse
    {
        $validated = $request->validated();
        $previousLabel = $goalType->label;

        $goalType->forceFill([
            'title' => $validated['title'],
            'color' => $validated['color'] ?? $goalType->color,
            'label' => $validated['label'] ?? $goalType->label,
        ])->save();

        if (filled($previousLabel) && $previousLabel !== $goalType->label) {
            $this->renameGoalKeyAcrossCampaigns((string) $previousLabel, (string) $goalType->label);
        }

        return back();
    }

    public function reorder(ReorderCampaignGoalTypesRequest $request): RedirectResponse
    {
        $order = $request->validated('order');

        DB::connection('tenant')->transaction(function () use ($order): void {
            foreach ($order as $index => $goalTypeId) {
                CampaignGoalType::query()
                    ->whereKey($goalTypeId)
                    ->update(['priority' => $index + 1]);
            }
        });

        return back();
    }

    public function destroy(CampaignGoalType $goalType): RedirectResponse
    {
        if (CampaignGoalType::query()->count() <= 1) {
            return back()->withErrors([
                'goal_type' => 'At least one campaign goal is required.',
            ]);
        }

        $label = $goalType->label;

        DB::connection('tenant')->transaction(function () use ($goalType, $label): void {
            if (filled($label)) {
                $this->removeGoalKeyAcrossCampaigns((string) $label);
            }

            $goalType->delete();

            $remaining = CampaignGoalType::query()->orderBy('priority')->pluck('id');

            foreach ($remaining as $index => $id) {
                CampaignGoalType::query()->whereKey($id)->update(['priority' => $index + 1]);
            }
        });

        return back();
    }

    protected function renameGoalKeyAcrossCampaigns(string $from, string $to): void
    {
        Campaign::query()
            ->whereNotNull('goals')
            ->orderBy('id')
            ->each(function (Campaign $campaign) use ($from, $to): void {
                $goals = $campaign->goals ?? [];

                if (! array_key_exists($from, $goals)) {
                    return;
                }

                if (! array_key_exists($to, $goals)) {
                    $goals[$to] = $goals[$from];
                }

                unset($goals[$from]);
                $campaign->forceFill(['goals' => $goals])->save();
            });
    }

    protected function removeGoalKeyAcrossCampaigns(string $label): void
    {
        Campaign::query()
            ->whereNotNull('goals')
            ->orderBy('id')
            ->each(function (Campaign $campaign) use ($label): void {
                $goals = $campaign->goals ?? [];

                if (! array_key_exists($label, $goals)) {
                    return;
                }

                unset($goals[$label]);
                $campaign->forceFill(['goals' => $goals])->save();
            });
    }
}

<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\ReorderLeadActionTypesRequest;
use App\Http\Requests\Portal\StoreLeadActionTypeRequest;
use App\Http\Requests\Portal\UpdateLeadActionTypeRequest;
use App\Models\Lead;
use App\Models\LeadActionType;
use App\Models\Task;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LeadActionTypeController extends Controller
{
    public function store(StoreLeadActionTypeRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $kind = $validated['kind'];
        $maxPriority = (int) LeadActionType::query()->ofKind($kind)->max('priority');

        LeadActionType::query()->create([
            'kind' => $kind,
            'label' => $validated['label'] ?? Str::slug($validated['title'], '_'),
            'title' => $validated['title'],
            'icon' => $validated['icon'] ?? null,
            'color' => $validated['color'] ?? LeadActionType::DEFAULT_COLOR,
            'priority' => $maxPriority + 1,
            'is_system' => false,
            'is_enabled' => true,
        ]);

        return back();
    }

    public function update(UpdateLeadActionTypeRequest $request, LeadActionType $actionType): RedirectResponse
    {
        $validated = $request->validated();
        $previousTitle = $actionType->title;

        if (array_key_exists('is_enabled', $validated)) {
            $nextEnabled = (bool) $validated['is_enabled'];

            if (
                ! $nextEnabled
                && $actionType->is_enabled
                && LeadActionType::query()
                    ->ofKind($actionType->kind)
                    ->enabled()
                    ->whereKeyNot($actionType->id)
                    ->doesntExist()
            ) {
                return back()->withErrors([
                    'action_type' => 'At least one enabled item is required in this list.',
                ]);
            }
        }

        $nextLabel = $actionType->is_system
            ? $actionType->label
            : ($validated['label'] ?? $actionType->label);

        $actionType->forceFill([
            'title' => $validated['title'] ?? $actionType->title,
            'label' => $nextLabel,
            'icon' => array_key_exists('icon', $validated) ? $validated['icon'] : $actionType->icon,
            'color' => array_key_exists('color', $validated)
                ? ($validated['color'] ?: LeadActionType::DEFAULT_COLOR)
                : $actionType->color,
            'is_enabled' => array_key_exists('is_enabled', $validated)
                ? (bool) $validated['is_enabled']
                : $actionType->is_enabled,
        ])->save();

        if ($previousTitle !== $actionType->title) {
            $this->renameTitleAcrossLeads($actionType->kind, $previousTitle, $actionType->title);
        }

        return back();
    }

    public function reorder(ReorderLeadActionTypesRequest $request): RedirectResponse
    {
        $kind = $request->validated('kind');
        $order = $request->validated('order');

        DB::connection('tenant')->transaction(function () use ($kind, $order): void {
            foreach ($order as $index => $actionTypeId) {
                LeadActionType::query()
                    ->ofKind($kind)
                    ->whereKey($actionTypeId)
                    ->update(['priority' => $index + 1]);
            }
        });

        return back();
    }

    public function destroy(LeadActionType $actionType): RedirectResponse
    {
        if ($actionType->is_system) {
            return back()->withErrors([
                'action_type' => 'Default actions cannot be deleted. Turn them off instead.',
            ]);
        }

        if (LeadActionType::query()->ofKind($actionType->kind)->enabled()->whereKeyNot($actionType->id)->doesntExist()) {
            return back()->withErrors([
                'action_type' => 'At least one enabled item is required in this list.',
            ]);
        }

        DB::connection('tenant')->transaction(function () use ($actionType): void {
            $kind = $actionType->kind;
            $actionType->delete();

            $remaining = LeadActionType::query()
                ->ofKind($kind)
                ->orderBy('priority')
                ->pluck('id');

            foreach ($remaining as $index => $id) {
                LeadActionType::query()->whereKey($id)->update(['priority' => $index + 1]);
            }
        });

        return back();
    }

    protected function renameTitleAcrossLeads(string $kind, string $from, string $to): void
    {
        if ($kind === LeadActionType::KIND_NEXT_ACTION) {
            Lead::query()->where('next_action', $from)->update(['next_action' => $to]);
            Task::query()
                ->where('type', Task::TYPE_ACTION)
                ->where('status', Task::STATUS_PENDING)
                ->where('action', $from)
                ->update(['action' => $to]);

            return;
        }

        Task::query()
            ->where('type', Task::TYPE_ACTION)
            ->where('action', $from)
            ->update(['action' => $to]);
    }
}

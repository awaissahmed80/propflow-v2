<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\BulkUnitRequest;
use App\Http\Requests\Portal\StoreUnitRequest;
use App\Http\Requests\Portal\UpdateUnitRequest;
use App\Models\MetaData;
use App\Models\Unit;
use Illuminate\Http\RedirectResponse;

class UnitController extends Controller
{
    public function store(StoreUnitRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        if (! empty($validated['type'])) {
            MetaData::remember(MetaData::TYPE_UNIT, $validated['type']);
        }

        if (! empty($validated['area_type'])) {
            MetaData::remember(MetaData::TYPE_AREA, $validated['area_type']);
        }

        Unit::query()->create([
            'project_id' => $validated['project_id'],
            'project_block_id' => $validated['project_block_id'] ?? null,
            'name' => $validated['name'] ?? null,
            'description' => $validated['description'] ?? null,
            'type' => $validated['type'] ?? null,
            'sector' => $validated['sector'] ?? null,
            'price' => $validated['price'] ?? 0,
            'size' => $validated['size'] ?? null,
            'area_type' => $validated['area_type'] ?? null,
            'quantity' => $validated['quantity'] ?? 1,
            'status' => $validated['status'] ?? Unit::STATUS_AVAILABLE,
            'features' => $validated['features'] ?? null,
        ]);

        return to_route('portal.inventory.index');
    }

    public function update(UpdateUnitRequest $request, Unit $unit): RedirectResponse
    {
        $validated = $request->validated();

        if (array_key_exists('type', $validated) && filled($validated['type'])) {
            MetaData::remember(MetaData::TYPE_UNIT, $validated['type']);
        }

        if (array_key_exists('area_type', $validated) && filled($validated['area_type'])) {
            MetaData::remember(MetaData::TYPE_AREA, $validated['area_type']);
        }

        $unit->fill($validated)->save();

        return to_route('portal.inventory.index');
    }

    public function bulk(BulkUnitRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        /** @var list<int> $ids */
        $ids = array_map('intval', $validated['ids']);
        $action = $validated['action'];

        $units = Unit::query()->whereIn('id', $ids)->get();

        if ($action === 'status') {
            $status = (string) $validated['status'];

            $units->each(function (Unit $unit) use ($status): void {
                $unit->update(['status' => $status]);
            });

            return back();
        }

        if ($action === 'destroy') {
            $units->each(function (Unit $unit): void {
                $unit->forceDelete();
            });
        }

        return back();
    }

    public function destroy(Unit $unit): RedirectResponse
    {
        $unit->forceDelete();

        return to_route('portal.inventory.index');
    }
}

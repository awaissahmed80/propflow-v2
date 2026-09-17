<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\StoreMetaDataRequest;
use App\Http\Requests\Portal\UpdateMetaDataRequest;
use App\Models\MetaData;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MetaDataController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['required', 'string', Rule::in(MetaData::types())],
        ]);

        $type = strtoupper($validated['type']);

        return response()->json([
            'type' => $type,
            'data' => MetaData::valuesFor($type)->values()->all(),
        ]);
    }

    public function store(StoreMetaDataRequest $request): JsonResponse|RedirectResponse
    {
        $validated = $request->validated();

        $meta = MetaData::remember($validated['type'], $validated['value']);

        if ($request->header('X-Inertia')) {
            return back();
        }

        return response()->json([
            'data' => [
                'id' => $meta->id,
                'type' => $meta->type,
                'value' => $meta->value,
            ],
        ], 201);
    }

    public function update(UpdateMetaDataRequest $request, MetaData $metaData): RedirectResponse
    {
        $validated = $request->validated();
        $value = trim((string) $validated['value']);

        $duplicate = MetaData::query()
            ->ofType($metaData->type)
            ->whereKeyNot($metaData->id)
            ->whereRaw('LOWER(value) = ?', [mb_strtolower($value)])
            ->exists();

        if ($duplicate) {
            return back()->withErrors([
                'value' => 'This value already exists for this type.',
            ]);
        }

        $metaData->forceFill(['value' => $value])->save();

        return back();
    }

    public function destroy(MetaData $metaData): RedirectResponse
    {
        $metaData->delete();

        return back();
    }
}

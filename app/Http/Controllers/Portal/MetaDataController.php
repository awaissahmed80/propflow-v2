<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\StoreMetaDataRequest;
use App\Models\MetaData;
use Illuminate\Http\JsonResponse;
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

    public function store(StoreMetaDataRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $meta = MetaData::remember($validated['type'], $validated['value']);

        return response()->json([
            'data' => [
                'id' => $meta->id,
                'type' => $meta->type,
                'value' => $meta->value,
            ],
        ], 201);
    }
}

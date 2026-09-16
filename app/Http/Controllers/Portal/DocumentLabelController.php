<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\StoreAssetLabelRequest;
use App\Http\Requests\Portal\SyncAssetLabelsRequest;
use App\Models\Asset;
use App\Models\AssetLabel;
use App\Support\AssetManager;
use Illuminate\Http\JsonResponse;

class DocumentLabelController extends Controller
{
    public function __construct(protected AssetManager $assets) {}

    public function index(): JsonResponse
    {
        $labels = AssetLabel::query()
            ->where('kind', AssetManager::KIND_DOCUMENT)
            ->withCount('assets')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $labels->map(fn (AssetLabel $label): array => [
                'id' => $label->id,
                'name' => $label->name,
                'color' => $label->color,
                'assets_count' => (int) $label->assets_count,
            ])->values(),
        ]);
    }

    public function store(StoreAssetLabelRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $label = AssetLabel::query()->create([
            'name' => $validated['name'],
            'color' => $validated['color'] ?? null,
            'kind' => AssetManager::KIND_DOCUMENT,
        ]);

        return response()->json([
            'data' => [
                'id' => $label->id,
                'name' => $label->name,
                'color' => $label->color,
                'assets_count' => 0,
            ],
        ], 201);
    }

    public function destroy(AssetLabel $label): JsonResponse
    {
        abort_unless($label->kind === AssetManager::KIND_DOCUMENT, 404);

        $label->assets()->detach();
        $label->delete();

        return response()->json(['ok' => true]);
    }

    public function sync(SyncAssetLabelsRequest $request, int $document): JsonResponse
    {
        $asset = Asset::query()
            ->where('tag', AssetManager::KIND_DOCUMENT)
            ->whereKey($document)
            ->firstOrFail();

        $this->assets->syncLabels($asset, $request->validated('label_ids') ?? []);

        $asset->load('labels');

        return response()->json([
            'data' => $asset->labels->map(fn (AssetLabel $label): array => [
                'id' => $label->id,
                'name' => $label->name,
                'color' => $label->color,
            ])->values(),
        ]);
    }
}

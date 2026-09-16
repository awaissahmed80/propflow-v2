<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\MoveAssetsToFolderRequest;
use App\Http\Requests\Portal\StoreAssetFolderRequest;
use App\Http\Requests\Portal\UpdateAssetFolderRequest;
use App\Models\Asset;
use App\Models\AssetFolder;
use App\Support\AssetManager;
use Illuminate\Http\JsonResponse;

class DocumentFolderController extends Controller
{
    public function __construct(protected AssetManager $assets) {}

    public function index(): JsonResponse
    {
        $folders = AssetFolder::query()
            ->where('kind', AssetManager::KIND_DOCUMENT)
            ->with(['children' => fn ($query) => $query->withCount('assets')])
            ->withCount('assets')
            ->whereNull('parent_id')
            ->orderBy('order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $folders->map(fn (AssetFolder $folder): array => $this->serializeFolder($folder))->values(),
        ]);
    }

    public function store(StoreAssetFolderRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $folder = AssetFolder::query()->create([
            'name' => $validated['name'],
            'kind' => AssetManager::KIND_DOCUMENT,
            'parent_id' => $validated['parent_id'] ?? null,
            'order' => $validated['order'] ?? ((int) AssetFolder::query()
                ->where('kind', AssetManager::KIND_DOCUMENT)
                ->where('parent_id', $validated['parent_id'] ?? null)
                ->max('order')) + 1,
        ]);

        return response()->json([
            'data' => $this->serializeFolder($folder->loadCount('assets')->load(['children' => fn ($q) => $q->withCount('assets')])),
        ], 201);
    }

    public function update(UpdateAssetFolderRequest $request, AssetFolder $folder): JsonResponse
    {
        abort_unless($folder->kind === AssetManager::KIND_DOCUMENT, 404);

        $validated = $request->validated();
        $folder->fill($validated)->save();

        return response()->json([
            'data' => $this->serializeFolder(
                $folder->fresh()->loadCount('assets')->load(['children' => fn ($q) => $q->withCount('assets')])
            ),
        ]);
    }

    public function destroy(AssetFolder $folder): JsonResponse
    {
        abort_unless($folder->kind === AssetManager::KIND_DOCUMENT, 404);

        $this->assets->destroyFolder($folder);

        return response()->json(['ok' => true]);
    }

    public function move(MoveAssetsToFolderRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $folder = isset($validated['folder_id'])
            ? AssetFolder::query()->findOrFail($validated['folder_id'])
            : null;

        $assets = Asset::query()
            ->where('tag', AssetManager::KIND_DOCUMENT)
            ->whereIn('id', $validated['asset_ids'])
            ->get();

        foreach ($assets as $asset) {
            $this->assets->moveToFolder($asset, $folder);
        }

        return response()->json(['ok' => true]);
    }

    /**
     * @return array<string, mixed>
     */
    protected function serializeFolder(AssetFolder $folder): array
    {
        return [
            'id' => $folder->id,
            'name' => $folder->name,
            'parent_id' => $folder->parent_id,
            'order' => $folder->order,
            'assets_count' => (int) ($folder->assets_count ?? $folder->assets()->count()),
            'children' => $folder->relationLoaded('children')
                ? $folder->children->map(fn (AssetFolder $child): array => [
                    'id' => $child->id,
                    'name' => $child->name,
                    'parent_id' => $child->parent_id,
                    'order' => $child->order,
                    'assets_count' => (int) ($child->assets_count ?? 0),
                    'children' => [],
                ])->values()->all()
                : [],
        ];
    }
}

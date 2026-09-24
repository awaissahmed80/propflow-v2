<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\StoreDocumentRequest;
use App\Http\Requests\Portal\SyncAssetLinksRequest;
use App\Http\Resources\Portal\AssetResource;
use App\Models\Asset;
use App\Models\AssetFolder;
use App\Models\Order;
use App\Support\AssetManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DocumentController extends Controller
{
    public function __construct(protected AssetManager $assets) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $search = $request->string('q')->trim()->toString();
        $folderParam = $request->input('folder_id');
        $unfiledOnly = $request->boolean('unfiled');
        $labelIds = $request->input('label_ids');

        $folderId = null;

        if ($folderParam !== null && $folderParam !== '' && $folderParam !== 'all') {
            $folderId = (int) $folderParam;
        }

        if (is_string($labelIds)) {
            $labelIds = array_filter(explode(',', $labelIds));
        }

        $assets = $this->assets
            ->libraryQuery(
                AssetManager::KIND_DOCUMENT,
                $search !== '' ? $search : null,
                $folderId,
                $unfiledOnly,
                is_array($labelIds) ? $labelIds : null,
            )
            ->limit(200)
            ->get();

        return AssetResource::collection($assets);
    }

    public function store(StoreDocumentRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $asset = $this->assets->storeOnly(
            $request->file('file'),
            AssetManager::KIND_DOCUMENT,
            $this->assets->directoryForKind(AssetManager::KIND_DOCUMENT),
        );

        if (! empty($validated['folder_id'])) {
            $folder = AssetFolder::query()->findOrFail($validated['folder_id']);
            $this->assets->moveToFolder($asset, $folder);
        }

        if (! empty($validated['label_ids'])) {
            $this->assets->syncLabels($asset, $validated['label_ids']);
        }

        $asset->load(['labels', 'folders']);

        return (new AssetResource($asset))
            ->response()
            ->setStatusCode(201);
    }

    public function destroy(int $document): JsonResponse
    {
        $asset = Asset::query()
            ->where('tag', AssetManager::KIND_DOCUMENT)
            ->whereKey($document)
            ->firstOrFail();

        $this->assets->destroy($asset);

        return response()->json(['ok' => true]);
    }

    public function sync(SyncAssetLinksRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $assetable = $this->assets->resolveAssetable(
            $validated['assetable_type'],
            (int) $validated['assetable_id'],
        );

        $this->assets->syncLinks(
            $assetable,
            strtoupper($validated['linkage']),
            $validated['asset_ids'] ?? [],
            $validated['label'] ?? null,
        );

        if ($assetable instanceof Order) {
            $folder = $assetable->ensureDocumentFolder();
            $assetIds = array_values(array_filter(array_map('intval', $validated['asset_ids'] ?? [])));

            if ($assetIds !== []) {
                Asset::query()
                    ->where('tag', AssetManager::KIND_DOCUMENT)
                    ->whereIn('id', $assetIds)
                    ->get()
                    ->each(fn (Asset $asset) => $this->assets->moveToFolder($asset, $folder));
            }
        }

        return response()->json(['ok' => true]);
    }
}

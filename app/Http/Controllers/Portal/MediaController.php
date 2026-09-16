<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\StoreMediaRequest;
use App\Http\Requests\Portal\SyncAssetLinksRequest;
use App\Http\Resources\Portal\AssetResource;
use App\Models\Asset;
use App\Support\AssetManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class MediaController extends Controller
{
    public function __construct(protected AssetManager $assets) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $search = $request->string('q')->trim()->toString();

        $assets = $this->assets
            ->libraryQuery(AssetManager::KIND_MEDIA, $search !== '' ? $search : null)
            ->limit(100)
            ->get();

        return AssetResource::collection($assets);
    }

    public function store(StoreMediaRequest $request): JsonResponse
    {
        $asset = $this->assets->storeOnly(
            $request->file('file'),
            AssetManager::KIND_MEDIA,
            $this->assets->directoryForKind(AssetManager::KIND_MEDIA),
        );

        return (new AssetResource($asset))
            ->response()
            ->setStatusCode(201);
    }

    public function destroy(int $media): JsonResponse
    {
        $asset = Asset::query()
            ->where('tag', AssetManager::KIND_MEDIA)
            ->whereKey($media)
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
        );

        return response()->json(['ok' => true]);
    }
}

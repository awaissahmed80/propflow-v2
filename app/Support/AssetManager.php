<?php

namespace App\Support;

use App\Models\Asset;
use App\Models\AssetFolder;
use App\Models\AssetLink;
use App\Models\Campaign;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use InvalidArgumentException;

class AssetManager
{
    public const KIND_MEDIA = 'media';

    public const KIND_DOCUMENT = 'document';

    public const LINKAGE_AVATAR = 'AVATAR';

    public const LINKAGE_THUMBNAIL = 'THUMBNAIL';

    public const LINKAGE_GALLERY = 'GALLERY';

    public const LINKAGE_DOCUMENT = 'DOCUMENT';

    /**
     * @var array<string, class-string<Model>>
     */
    public const ASSETABLES = [
        'project' => Project::class,
        'campaign' => Campaign::class,
        'user' => User::class,
        'task' => Task::class,
    ];

    public function url(?Asset $asset): ?string
    {
        if ($asset === null || blank($asset->path)) {
            return null;
        }

        return url('assets/'.$asset->path);
    }

    /**
     * @param  class-string<Model>  $assetableType
     * @param  list<int|string>  $assetableIds
     * @return Collection<int|string, string|null>
     */
    public function urlsFor(string $assetableType, array $assetableIds, string $linkage): Collection
    {
        if ($assetableIds === []) {
            return collect();
        }

        return AssetLink::query()
            ->with('asset')
            ->where('assetable_type', $assetableType)
            ->where('linkage', $linkage)
            ->whereIn('assetable_id', $assetableIds)
            ->get()
            ->mapWithKeys(fn (AssetLink $link): array => [
                $link->assetable_id => $this->url($link->asset),
            ]);
    }

    public function urlFor(Model $assetable, string $linkage): ?string
    {
        $link = AssetLink::query()
            ->with('asset')
            ->where('assetable_type', $assetable::class)
            ->where('assetable_id', $assetable->getKey())
            ->where('linkage', $linkage)
            ->first();

        return $this->url($link?->asset);
    }

    /**
     * Upload into the shared library without linking.
     */
    public function storeOnly(
        UploadedFile $file,
        string $kind,
        string $directory = 'uploads',
    ): Asset {
        return $this->storeFile($file, $directory, $this->normalizeKind($kind));
    }

    /**
     * Replace a single exclusive linkage (avatar / thumbnail).
     * Previous links are removed; orphaned assets are deleted.
     */
    public function attach(
        Model $assetable,
        UploadedFile $file,
        string $linkage,
        string $directory = 'uploads',
    ): AssetLink {
        $kind = $this->kindForLinkage($linkage);
        $this->detach($assetable, $linkage, deleteOrphans: true);

        $asset = $this->storeFile($file, $directory, $kind);

        return AssetLink::query()->create([
            'assetable_id' => $assetable->getKey(),
            'assetable_type' => $assetable::class,
            'asset_id' => $asset->id,
            'linkage' => $linkage,
        ]);
    }

    /**
     * Replace all links for a linkage with the given asset ids.
     * Removed links are unlinked only — assets stay in the library.
     *
     * @param  list<int|string>  $assetIds
     */
    public function syncLinks(Model $assetable, string $linkage, array $assetIds): void
    {
        $assetIds = collect($assetIds)
            ->map(fn ($id): int => (int) $id)
            ->filter(fn (int $id): bool => $id > 0)
            ->unique()
            ->values()
            ->all();

        $existing = AssetLink::query()
            ->where('assetable_type', $assetable::class)
            ->where('assetable_id', $assetable->getKey())
            ->where('linkage', $linkage)
            ->get();

        foreach ($existing as $link) {
            if (! in_array((int) $link->asset_id, $assetIds, true)) {
                $link->delete();
            }
        }

        $keptIds = $existing
            ->pluck('asset_id')
            ->map(fn ($id): int => (int) $id)
            ->all();

        foreach ($assetIds as $assetId) {
            if (in_array($assetId, $keptIds, true)) {
                continue;
            }

            if (! Asset::query()->whereKey($assetId)->exists()) {
                throw new InvalidArgumentException("Asset [{$assetId}] was not found.");
            }

            AssetLink::query()->create([
                'assetable_id' => $assetable->getKey(),
                'assetable_type' => $assetable::class,
                'asset_id' => $assetId,
                'linkage' => $linkage,
            ]);
        }
    }

    /**
     * Remove links for a linkage. Optionally delete assets that become orphaned
     * (used for exclusive attachments like avatars).
     */
    public function detach(Model $assetable, string $linkage, bool $deleteOrphans = false): void
    {
        $links = AssetLink::query()
            ->with('asset')
            ->where('assetable_type', $assetable::class)
            ->where('assetable_id', $assetable->getKey())
            ->where('linkage', $linkage)
            ->get();

        foreach ($links as $link) {
            $asset = $link->asset;
            $link->delete();

            if ($deleteOrphans && $asset !== null) {
                $this->deleteIfOrphaned($asset);
            }
        }
    }

    /**
     * Permanently remove an asset from the library (files + soft delete).
     * Also removes any remaining links, folder membership, and label pivots.
     */
    public function destroy(Asset $asset): void
    {
        AssetLink::query()->where('asset_id', $asset->id)->delete();
        $asset->folders()->detach();
        $asset->labels()->detach();
        $this->deleteAssetFiles($asset);
        $asset->delete();
    }

    /**
     * Place an asset in exactly one folder, or unfile it when $folder is null.
     */
    public function moveToFolder(Asset $asset, ?AssetFolder $folder): void
    {
        $asset->folders()->detach();

        if ($folder !== null) {
            $asset->folders()->attach($folder->id);
        }
    }

    /**
     * Delete a folder, its descendants, and destroy every document inside them.
     */
    public function destroyFolder(AssetFolder $folder): void
    {
        $folderIds = collect([$folder->id])
            ->merge(
                AssetFolder::query()
                    ->where('parent_id', $folder->id)
                    ->pluck('id')
            )
            ->all();

        $assetIds = DB::connection('tenant')
            ->table('asset_folder_items')
            ->whereIn('folder_id', $folderIds)
            ->pluck('asset_id')
            ->unique()
            ->all();

        $assets = Asset::query()->whereIn('id', $assetIds)->get();

        foreach ($assets as $asset) {
            $this->destroy($asset);
        }

        AssetFolder::query()->whereIn('id', $folderIds)->delete();
    }

    /**
     * @param  list<int>  $labelIds
     */
    public function syncLabels(Asset $asset, array $labelIds): void
    {
        $ids = collect($labelIds)
            ->map(fn ($id): int => (int) $id)
            ->filter(fn (int $id): bool => $id > 0)
            ->unique()
            ->values()
            ->all();

        $asset->labels()->sync($ids);
    }

    /**
     * @return Builder<Asset>
     */
    public function libraryQuery(
        string $kind,
        ?string $search = null,
        ?int $folderId = null,
        bool $unfiledOnly = false,
        ?array $labelIds = null,
    ): Builder {
        $kind = $this->normalizeKind($kind);

        $query = Asset::query()
            ->with(['labels', 'folders'])
            ->where('tag', $kind)
            ->orderByDesc('id');

        if (filled($search)) {
            $needle = '%'.mb_strtolower(trim($search)).'%';
            $query->whereRaw('LOWER(name) like ?', [$needle]);
        }

        if ($unfiledOnly) {
            $query->whereDoesntHave('folders');
        } elseif ($folderId !== null) {
            $query->whereHas('folders', fn (Builder $builder) => $builder->whereKey($folderId));
        }

        if ($labelIds !== null && $labelIds !== []) {
            $ids = collect($labelIds)->map(fn ($id): int => (int) $id)->filter()->all();
            foreach ($ids as $labelId) {
                $query->whereHas('labels', fn (Builder $builder) => $builder->whereKey($labelId));
            }
        }

        return $query;
    }

    /**
     * @return class-string<Model>
     */
    public function resolveAssetableType(string $key): string
    {
        $normalized = mb_strtolower(trim($key));

        if (! isset(self::ASSETABLES[$normalized])) {
            throw new InvalidArgumentException("Unsupported assetable [{$key}].");
        }

        return self::ASSETABLES[$normalized];
    }

    public function resolveAssetable(string $typeKey, int $id): Model
    {
        $class = $this->resolveAssetableType($typeKey);

        return $class::query()->findOrFail($id);
    }

    public function kindForLinkage(string $linkage): string
    {
        return match (strtoupper($linkage)) {
            self::LINKAGE_DOCUMENT => self::KIND_DOCUMENT,
            default => self::KIND_MEDIA,
        };
    }

    public function directoryForKind(string $kind): string
    {
        return match ($this->normalizeKind($kind)) {
            self::KIND_DOCUMENT => 'documents',
            default => 'media',
        };
    }

    protected function normalizeKind(string $kind): string
    {
        $normalized = mb_strtolower(trim($kind));

        if (! in_array($normalized, [self::KIND_MEDIA, self::KIND_DOCUMENT], true)) {
            throw new InvalidArgumentException("Unsupported asset kind [{$kind}].");
        }

        return $normalized;
    }

    protected function deleteIfOrphaned(Asset $asset): void
    {
        $stillLinked = AssetLink::query()->where('asset_id', $asset->id)->exists();

        if ($stillLinked) {
            return;
        }

        $this->deleteAssetFiles($asset);
        $asset->delete();
    }

    protected function storeFile(UploadedFile $file, string $directory, string $tag): Asset
    {
        $originalName = $file->getClientOriginalName();
        $size = (float) ($file->getSize() ?: 0);
        $mime = $file->getMimeType();
        $extension = $file->guessExtension()
            ?: $file->getClientOriginalExtension()
            ?: 'bin';
        $filename = Str::uuid()->toString().'.'.$extension;
        $relativeDirectory = trim($directory, '/');
        $relativePath = $relativeDirectory.'/'.$filename;
        $absoluteDirectory = public_path('assets/'.$relativeDirectory);

        File::ensureDirectoryExists($absoluteDirectory);
        $file->move($absoluteDirectory, $filename);

        return Asset::query()->create([
            'name' => $originalName,
            'path' => $relativePath,
            'thumbnail' => $relativePath,
            'size' => $size,
            'type' => $mime,
            'tag' => $tag,
        ]);
    }

    protected function deleteAssetFiles(Asset $asset): void
    {
        foreach (array_unique(array_filter([$asset->path, $asset->thumbnail])) as $relativePath) {
            $absolutePath = public_path('assets/'.$relativePath);

            if (is_file($absolutePath)) {
                File::delete($absolutePath);
            }
        }
    }
}

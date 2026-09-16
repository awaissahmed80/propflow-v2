<?php

namespace App\Http\Resources\Portal;

use App\Models\Asset;
use App\Support\AssetManager;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Asset
 */
class AssetResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var AssetManager $assets */
        $assets = app(AssetManager::class);
        $folder = $this->relationLoaded('folders')
            ? $this->folders->first()
            : null;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'url' => $assets->url($this->resource),
            'thumbnail_url' => $this->thumbnail
                ? url('assets/'.$this->thumbnail)
                : null,
            'type' => $this->type,
            'tag' => $this->tag,
            'size' => $this->size,
            'created_at' => $this->created_at?->toIso8601String(),
            'folder_id' => $folder?->id,
            'folder' => $folder ? [
                'id' => $folder->id,
                'name' => $folder->name,
                'parent_id' => $folder->parent_id,
            ] : null,
            'labels' => $this->whenLoaded('labels', fn () => $this->labels->map(fn ($label) => [
                'id' => $label->id,
                'name' => $label->name,
                'color' => $label->color,
            ])->values()->all()),
        ];
    }
}

<?php

namespace App\Http\Resources\Portal;

use App\Models\Project;
use App\Support\MapEmbed;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Project
 */
class ProjectResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'title' => $this->title,
            'description' => $this->description,
            'type' => $this->type,
            'purpose' => $this->purpose,
            'country' => $this->country,
            'city' => $this->city,
            'location' => $this->location,
            'status' => $this->status ?: 'draft',
            'start_date' => $this->start_date,
            'end_date' => $this->end_date,
            'progress' => (int) ($this->progress ?? 0),
            'pin_location' => $this->pin_location,
            'map_embed_src' => MapEmbed::src($this->pin_location),
            'area_unit' => data_get($this->details, 'area_unit'),
            'total_area' => data_get($this->details, 'total_area'),
            'thumbnail' => $this->thumbnail_url,
            'units_count' => (int) ($this->units_count ?? 0),
            'blocks_count' => (int) ($this->blocks_count ?? 0),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}

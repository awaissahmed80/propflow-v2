<?php

namespace App\Http\Resources\Portal;

use App\Models\Unit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Unit
 */
class UnitResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'code' => $this->code,
            'description' => $this->description,
            'type' => $this->type,
            'sector' => $this->sector,
            'price' => $this->price !== null ? (float) $this->price : null,
            'size' => $this->size !== null ? (float) $this->size : null,
            'area_type' => $this->area_type,
            'quantity' => $this->quantity,
            'status' => $this->status,
            'project_id' => $this->project_id,
            'project_block_id' => $this->project_block_id,
            'project' => $this->whenLoaded('project', fn () => $this->project ? [
                'id' => $this->project->id,
                'title' => $this->project->title,
                'code' => $this->project->code,
            ] : null),
            'block' => $this->whenLoaded('block', fn () => $this->block ? [
                'id' => $this->block->id,
                'title' => $this->block->title,
            ] : null),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}

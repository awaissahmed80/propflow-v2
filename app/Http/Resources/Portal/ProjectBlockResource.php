<?php

namespace App\Http\Resources\Portal;

use App\Models\ProjectBlock;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ProjectBlock
 */
class ProjectBlockResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'title' => $this->title,
            'description' => $this->description,
            'units_count' => (int) ($this->units_count ?? 0),
        ];
    }
}

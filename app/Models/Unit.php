<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'name',
    'code',
    'description',
    'type',
    'sector',
    'price',
    'size',
    'area_type',
    'features',
    'pricing',
    'quantity',
    'status',
    'project_id',
    'project_block_id',
])]
#[Connection('tenant')]
class Unit extends Model
{
    use SoftDeletes;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'size' => 'decimal:2',
            'features' => 'array',
            'pricing' => 'array',
        ];
    }

    /**
     * @return BelongsTo<Project, $this>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * @return BelongsTo<ProjectBlock, $this>
     */
    public function block(): BelongsTo
    {
        return $this->belongsTo(ProjectBlock::class, 'project_block_id');
    }
}

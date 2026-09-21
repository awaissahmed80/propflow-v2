<?php

namespace App\Models;

use App\Traits\LogUserActivity;
use Database\Factories\ProjectBlockFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['project_id', 'title', 'description'])]
#[Connection('tenant')]
#[Table(timestamps: false)]
class ProjectBlock extends Model
{
    /** @use HasFactory<ProjectBlockFactory> */
    use HasFactory, LogUserActivity;

    /**
     * @return BelongsTo<Project, $this>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * @return HasMany<Unit, $this>
     */
    public function units(): HasMany
    {
        return $this->hasMany(Unit::class, 'project_block_id');
    }
}

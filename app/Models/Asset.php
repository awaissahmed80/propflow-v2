<?php

namespace App\Models;

use App\Traits\LogUserActivity;
use Database\Factories\AssetFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['type', 'tag', 'name', 'path', 'thumbnail', 'size'])]
#[Connection('tenant')]
class Asset extends Model
{
    /** @use HasFactory<AssetFactory> */
    use HasFactory, LogUserActivity, SoftDeletes;

    /**
     * @return HasMany<AssetLink, $this>
     */
    public function links(): HasMany
    {
        return $this->hasMany(AssetLink::class);
    }

    /**
     * @return BelongsToMany<AssetLabel, $this>
     */
    public function labels(): BelongsToMany
    {
        return $this->belongsToMany(AssetLabel::class, 'asset_label_asset', 'asset_id', 'asset_label_id')
            ->withTimestamps();
    }

    /**
     * Single primary library folder (one membership per asset).
     *
     * @return BelongsToMany<AssetFolder, $this>
     */
    public function folders(): BelongsToMany
    {
        return $this->belongsToMany(AssetFolder::class, 'asset_folder_items', 'asset_id', 'folder_id')
            ->withTimestamps();
    }

    protected static function newFactory(): AssetFactory
    {
        return AssetFactory::new();
    }
}

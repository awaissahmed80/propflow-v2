<?php

namespace App\Models;

use App\Support\AssetManager;
use Database\Factories\AssetFolderFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'kind', 'parent_id', 'order'])]
#[Connection('tenant')]
class AssetFolder extends Model
{
    /** @use HasFactory<AssetFolderFactory> */
    use HasFactory;

    public const MAX_DEPTH = 2;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'order' => 'integer',
            'parent_id' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<AssetFolder, $this>
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    /**
     * @return HasMany<AssetFolder, $this>
     */
    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('order')->orderBy('name');
    }

    /**
     * @return BelongsToMany<Asset, $this>
     */
    public function assets(): BelongsToMany
    {
        return $this->belongsToMany(Asset::class, 'asset_folder_items', 'folder_id', 'asset_id')
            ->withTimestamps();
    }

    public function depth(): int
    {
        return $this->parent_id ? 2 : 1;
    }

    public function canHaveChildren(): bool
    {
        return $this->depth() < self::MAX_DEPTH;
    }

    protected static function newFactory(): AssetFolderFactory
    {
        return AssetFolderFactory::new();
    }

    protected static function booted(): void
    {
        static::creating(function (AssetFolder $folder): void {
            $folder->kind = $folder->kind ?: AssetManager::KIND_DOCUMENT;
        });
    }
}

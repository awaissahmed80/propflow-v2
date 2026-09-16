<?php

namespace App\Models;

use App\Support\AssetManager;
use Database\Factories\AssetLabelFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable(['name', 'color', 'kind'])]
#[Connection('tenant')]
class AssetLabel extends Model
{
    /** @use HasFactory<AssetLabelFactory> */
    use HasFactory;

    /**
     * @return BelongsToMany<Asset, $this>
     */
    public function assets(): BelongsToMany
    {
        return $this->belongsToMany(Asset::class, 'asset_label_asset', 'asset_label_id', 'asset_id')
            ->withTimestamps();
    }

    protected static function newFactory(): AssetLabelFactory
    {
        return AssetLabelFactory::new();
    }

    protected static function booted(): void
    {
        static::creating(function (AssetLabel $label): void {
            $label->kind = $label->kind ?: AssetManager::KIND_DOCUMENT;
            $label->name = trim($label->name);
        });
    }
}

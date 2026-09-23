<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

#[Fillable(['assetable_id', 'assetable_type', 'asset_id', 'linkage', 'label', 'is_secure'])]
#[Connection('tenant')]
class AssetLink extends Model
{
    protected function casts(): array
    {
        return [
            'is_secure' => 'boolean',
        ];
    }

    public function assetable(): MorphTo
    {
        return $this->morphTo();
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

#[Fillable(['assetable_id', 'assetable_type', 'asset_id', 'linkage'])]
#[Connection('tenant')]
class AssetLink extends Model
{
    //
    public function assetable(): MorphTo
    {
        return $this->morphTo();
    }

    public function asset()
    {
        return $this->belongsTo(Asset::class);
    }
}

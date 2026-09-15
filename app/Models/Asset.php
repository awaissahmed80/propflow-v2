<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['type', 'tag', 'name', 'path'])]
#[Connection('tenant')]
class Asset extends Model
{
    //
    public function links()
    {
        return $this->hasMany(AssetLink::class);
    }
}

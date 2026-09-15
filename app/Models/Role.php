<?php

namespace App\Models;

use App\Support\PermissionConnection;
use Illuminate\Database\Eloquent\Builder;
use Spatie\Permission\Models\Role as SpatieRole;

class Role extends SpatieRole
{
    public function getConnectionName(): ?string
    {
        return PermissionConnection::name();
    }

    /**
     * @param  Builder<Role>  $query
     * @return Builder<Role>
     */
    public function scopePlatform(Builder $query): Builder
    {
        return $query; // platform roles live only on the landlord connection
    }
}

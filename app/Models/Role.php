<?php

namespace App\Models;

use App\Support\PermissionConnection;
use Spatie\Permission\Models\Role as SpatieRole;

class Role extends SpatieRole
{
    public function getConnectionName(): ?string
    {
        return PermissionConnection::name();
    }

    public function getRouteKeyName(): string
    {
        return 'name';
    }
}

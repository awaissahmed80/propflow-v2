<?php

namespace App\Models;

use App\Support\PermissionConnection;
use Spatie\Permission\Models\Permission as SpatiePermission;

class Permission extends SpatiePermission
{
    public function getConnectionName(): ?string
    {
        return PermissionConnection::name();
    }
}

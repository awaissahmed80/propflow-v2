<?php

namespace App\Support;

class PlatformPermissions
{
    /**
     * @return list<string>
     */
    public static function names(): array
    {
        return [
            'tenants.view',
            'tenants.create',
            'tenants.update',
            'tenants.impersonate',
            'users.view',
            'users.create',
            'users.update',
            'roles.view',
            'roles.create',
            'roles.update',
        ];
    }
}

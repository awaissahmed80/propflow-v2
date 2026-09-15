<?php

namespace App\Support;

use App\Models\Tenant;

class PermissionConnection
{
    /**
     * Landlord roles when no tenant is current; tenant DB roles once a tenant is active.
     */
    public static function name(): string
    {
        return Tenant::checkCurrent() ? 'tenant' : 'landlord';
    }
}

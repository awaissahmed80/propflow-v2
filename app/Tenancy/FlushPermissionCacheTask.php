<?php

namespace App\Tenancy;

use Spatie\Multitenancy\Contracts\IsTenant;
use Spatie\Multitenancy\Tasks\SwitchTenantTask;
use Spatie\Permission\PermissionRegistrar;

class FlushPermissionCacheTask implements SwitchTenantTask
{
    public function makeCurrent(IsTenant $tenant): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function forgetCurrent(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}

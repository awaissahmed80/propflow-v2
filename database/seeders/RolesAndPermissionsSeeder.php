<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Support\PlatformPermissions;
use Illuminate\Database\Seeder;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    /**
     * Seed platform (landlord) permissions and the default platform-admin role.
     * Must run while no tenant is current so Role/Permission use the landlord connection.
     */
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (PlatformPermissions::names() as $name) {
            Permission::findOrCreate($name, 'web');
        }

        $admin = Role::findOrCreate('platform-admin', 'web');
        $admin->syncPermissions(PlatformPermissions::names());
    }
}

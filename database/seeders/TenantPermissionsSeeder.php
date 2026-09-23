<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Support\TenantPermissions;
use Illuminate\Database\Seeder;
use Spatie\Permission\PermissionRegistrar;

class TenantPermissionsSeeder extends Seeder
{
    /**
     * Legacy system role names renamed when the default catalog changed.
     *
     * @var array<string, string>
     */
    protected array $legacyRoleRenames = [
        'Manager' => 'Business Manager',
        'Team Lead' => 'Sales Team Lead',
        'Accounts / Finance' => 'Accounts Manager',
    ];

    /**
     * Sync tenant permission catalog rows and default system roles.
     *
     * Safe to re-run: creates missing permissions, refreshes group/label,
     * and re-syncs system role permission pivots from TenantPermissions::defaultRoles().
     */
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $this->seedPermissions();
        $this->renameLegacySystemRoles();
        $this->seedDefaultRoles();
    }

    protected function seedPermissions(): void
    {
        foreach (TenantPermissions::catalog() as $group) {
            foreach ($group['permissions'] as $permission) {
                $model = Permission::findOrCreate($permission['name'], 'web');
                $model->forceFill([
                    'group' => $group['group'],
                    'label' => $permission['label'],
                ])->save();
            }
        }
    }

    protected function renameLegacySystemRoles(): void
    {
        foreach ($this->legacyRoleRenames as $from => $to) {
            $legacy = Role::query()->where('name', $from)->where('is_system', true)->first();

            if (! $legacy) {
                continue;
            }

            $existing = Role::query()->where('name', $to)->first();

            if ($existing) {
                if ($legacy->users()->count() === 0) {
                    $legacy->delete();
                }

                continue;
            }

            $legacy->name = $to;
            $legacy->save();
        }
    }

    protected function seedDefaultRoles(): void
    {
        foreach (TenantPermissions::defaultRoles() as $roleData) {
            $role = Role::findOrCreate($roleData['name'], 'web');
            $role->forceFill([
                'description' => $roleData['description'],
                'is_system' => true,
                'is_enabled' => true,
            ])->save();
            $role->syncPermissions($roleData['permissions']);
        }
    }
}

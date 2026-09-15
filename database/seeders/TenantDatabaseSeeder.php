<?php

namespace Database\Seeders;

use App\Models\LeadStage;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Support\TenantPermissions;
use Illuminate\Database\Seeder;
use Spatie\Permission\PermissionRegistrar;

class TenantDatabaseSeeder extends Seeder
{
    /**
     * Seed the current tenant database (permissions, admin role, default stages).
     * Expects a tenant to already be current and the admin User to be passed via config.
     */
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (TenantPermissions::names() as $name) {
            Permission::findOrCreate($name, 'web');
        }

        $adminRole = Role::findOrCreate('admin', 'web');
        $adminRole->syncPermissions(TenantPermissions::names());

        /** @var User|null $admin */
        $admin = config('seeder.tenant_admin_user');

        if ($admin instanceof User) {
            $admin->unsetRelation('roles')->unsetRelation('permissions');
            $admin->syncRoles([$adminRole]);
        }

        $this->seedDefaultLeadStages();
    }

    protected function seedDefaultLeadStages(): void
    {
        if (LeadStage::query()->exists()) {
            return;
        }

        $stages = [
            ['label' => 'new', 'title' => 'New', 'priority' => 1, 'color' => '#3B82F6'],
            ['label' => 'contacted', 'title' => 'Contacted', 'priority' => 2, 'color' => '#8B5CF6'],
            ['label' => 'qualified', 'title' => 'Qualified', 'priority' => 3, 'color' => '#10B981'],
            ['label' => 'site_visit', 'title' => 'Site Visit', 'priority' => 4, 'color' => '#F59E0B'],
            ['label' => 'negotiation', 'title' => 'Negotiation', 'priority' => 5, 'color' => '#EF4444'],
            ['label' => 'closed_won', 'title' => 'Closed Won', 'priority' => 6, 'color' => '#059669'],
            ['label' => 'closed_lost', 'title' => 'Closed Lost', 'priority' => 7, 'color' => '#6B7280'],
        ];

        foreach ($stages as $stage) {
            LeadStage::query()->create($stage);
        }
    }
}

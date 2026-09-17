<?php

namespace Database\Seeders;

use App\Models\CampaignGoalType;
use App\Models\LeadStage;
use App\Models\MetaData;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Support\TenantPermissions;
use Illuminate\Database\Seeder;
use Spatie\Permission\PermissionRegistrar;

class TenantDatabaseSeeder extends Seeder
{
    /**
     * Seed the current tenant database:
     * permissions (grouped catalog), default roles, admin assignment, lead stages, area units.
     */
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $this->seedPermissions();
        $adminRole = $this->seedDefaultRoles();

        /** @var User|null $admin */
        $admin = config('seeder.tenant_admin_user');

        if ($admin instanceof User && $adminRole) {
            $admin->unsetRelation('roles')->unsetRelation('permissions');
            $admin->syncRoles([$adminRole]);
        }

        $this->seedDefaultLeadStages();
        $this->seedDefaultCampaignGoalTypes();
        $this->seedDefaultAreaUnits();
        $this->seedDefaultUnitTypes();
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

    protected function seedDefaultRoles(): ?Role
    {
        $adminRole = null;

        foreach (TenantPermissions::defaultRoles() as $roleData) {
            $role = Role::findOrCreate($roleData['name'], 'web');
            $role->forceFill([
                'description' => $roleData['description'],
            ])->save();
            $role->syncPermissions($roleData['permissions']);

            if ($roleData['name'] === 'Admin') {
                $adminRole = $role;
            }
        }

        return $adminRole;
    }

    protected function seedDefaultLeadStages(): void
    {
        if (LeadStage::query()->exists()) {
            return;
        }

        $stages = [
            ['label' => 'new', 'title' => 'New', 'priority' => 1, 'color' => '#3B82F6'],
            ['label' => 'contacted', 'title' => 'Contacted', 'priority' => 2, 'color' => '#8B5CF6'],
            ['label' => 'qualified', 'title' => 'Qualified', 'priority' => 3, 'color' => '#06B6D4'],
            ['label' => 'site_visit', 'title' => 'Site Visit', 'priority' => 4, 'color' => '#F59E0B'],
            ['label' => 'negotiation', 'title' => 'Negotiation', 'priority' => 5, 'color' => '#F97316'],
            ['label' => 'closed_won', 'title' => 'Closed Won', 'priority' => 6, 'color' => '#059669'],
            ['label' => 'closed_lost', 'title' => 'Closed Lost', 'priority' => 7, 'color' => '#EF4444'],
        ];

        foreach ($stages as $stage) {
            LeadStage::query()->create($stage);
        }
    }

    protected function seedDefaultCampaignGoalTypes(): void
    {
        CampaignGoalType::ensureDefaults();
    }

    protected function seedDefaultAreaUnits(): void
    {
        $units = [
            'Sq. Feet',
            'Sq. Meter',
            'Sq. Yards',
            'Marla',
            'Kanal',
            'Acre',
            'Hectare',
        ];

        foreach ($units as $unit) {
            MetaData::remember(MetaData::TYPE_AREA, $unit);
        }
    }

    protected function seedDefaultUnitTypes(): void
    {
        foreach (['Apartment', 'Plot', 'Shop', 'Villa', 'Office'] as $type) {
            MetaData::remember(MetaData::TYPE_UNIT, $type);
        }
    }
}

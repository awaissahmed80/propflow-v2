<?php

namespace Database\Seeders;

use App\Models\CampaignGoalType;
use App\Models\LeadActionType;
use App\Models\LeadStage;
use App\Models\MetaData;
use App\Models\OrderStage;
use App\Models\PaymentPlanTemplate;
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
        $this->seedDefaultOrderStages();
        $this->seedDefaultLeadActionTypes();
        $this->seedDefaultCampaignGoalTypes();
        $this->seedDefaultPaymentPlanTemplates();
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
                'is_system' => true,
                'is_enabled' => true,
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
        LeadStage::ensureDefaults();
    }

    protected function seedDefaultOrderStages(): void
    {
        OrderStage::ensureDefaults();
    }

    protected function seedDefaultLeadActionTypes(): void
    {
        LeadActionType::ensureDefaults();
    }

    protected function seedDefaultCampaignGoalTypes(): void
    {
        CampaignGoalType::ensureDefaults();
    }

    protected function seedDefaultPaymentPlanTemplates(): void
    {
        PaymentPlanTemplate::ensureDefaults();
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

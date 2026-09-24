<?php

namespace Database\Seeders;

use App\Models\CampaignGoalType;
use App\Models\LeadActionType;
use App\Models\LeadStage;
use App\Models\MetaData;
use App\Models\OrderStage;
use App\Models\PaymentAccount;
use App\Models\PaymentPlanTemplate;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class TenantDatabaseSeeder extends Seeder
{
    /**
     * Seed the current tenant database:
     * permissions (grouped catalog), default roles, admin assignment, lead stages, area units.
     */
    public function run(): void
    {
        $this->call(TenantPermissionsSeeder::class);

        /** @var User|null $admin */
        $admin = config('seeder.tenant_admin_user');
        $adminRole = Role::query()->where('name', 'Admin')->first();

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
        MetaData::ensureUnitCategories();
    }

    protected function seedDefaultLeadStages(): void
    {
        LeadStage::ensureDefaults();
    }

    protected function seedDefaultOrderStages(): void
    {
        OrderStage::ensureDefaults();
        MetaData::ensurePaymentMethods();
        PaymentAccount::ensureDefaults();
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

<?php

namespace Tests\Feature\Portal;

use App\Models\CampaignForm;
use App\Models\CustomField;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class CampaignFormFieldSettingsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'app.base_domain' => 'propflow.test',
            'app.url_scheme' => 'https',
        ]);

        $this->migrateLandlord();
        $this->migrateTenant();
    }

    public function test_campaigns_settings_includes_form_fields_catalog(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_campaign_fields_index');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/settings/campaigns'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('settings/index', false)
                ->has('campaignFormFields')
                ->where('campaignFormFields.0.key', 'first_name')
            );
    }

    public function test_custom_fields_section_redirects_to_campaigns(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_campaign_fields_redirect');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/settings/custom-fields'))
            ->assertRedirect(Domain::portal('/settings/campaigns'));
    }

    public function test_campaign_form_field_can_be_created_and_appended_to_forms(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_campaign_fields_store');

        $tenant->makeCurrent();
        CustomField::ensureCampaignFormDefaults();
        $form = CampaignForm::factory()->create([
            'fields' => CampaignForm::defaultFields(),
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/settings/campaign-form-fields'), [
            'label' => 'Company name',
            'type' => 'text',
            'enabled' => true,
        ])->assertRedirect();

        $tenant->makeCurrent();
        $field = CustomField::query()->where('key', 'company_name')->first();
        $this->assertNotNull($field);
        $this->assertFalse($field->is_system);

        $form->refresh();
        $keys = collect($form->fields)->pluck('key')->all();
        $this->assertContains('company_name', $keys);
        Tenant::forgetCurrent();
    }

    public function test_system_campaign_form_field_cannot_be_deleted(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_campaign_fields_system');

        $tenant->makeCurrent();
        CustomField::ensureCampaignFormDefaults();
        $field = CustomField::query()->where('key', 'first_name')->firstOrFail();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/settings/campaigns'))
            ->delete(Domain::portal('/settings/campaign-form-fields/'.$field->key))
            ->assertRedirect(Domain::portal('/settings/campaigns'))
            ->assertSessionHasErrors('field');
    }

    public function test_new_campaign_forms_use_catalog_defaults(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_campaign_fields_defaults');

        $tenant->makeCurrent();
        CustomField::ensureCampaignFormDefaults();
        CustomField::query()->create([
            'entity' => CustomField::ENTITY_CAMPAIGN_FORM,
            'key' => 'unit_preference',
            'label' => 'Unit preference',
            'type' => 'text',
            'required' => false,
            'enabled' => true,
            'placeholder' => null,
            'priority' => 99,
            'is_system' => false,
        ]);

        $form = CampaignForm::factory()->create(['fields' => null]);
        $keys = collect($form->fields)->pluck('key')->all();
        $this->assertContains('unit_preference', $keys);
        $this->assertContains('first_name', $keys);
        Tenant::forgetCurrent();
    }

    /**
     * @return array{0: User, 1: Tenant}
     */
    protected function createTenantUser(string $database): array
    {
        $user = User::factory()->tenant()->create();
        $tenant = Tenant::factory()->create(['database' => $database]);

        TenantUser::factory()->owner()->create([
            'user_id' => $user->id,
            'tenant_id' => $tenant->id,
        ]);

        return [$user, $tenant];
    }
}

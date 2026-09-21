<?php

namespace Tests\Feature\Portal;

use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\MetaData;
use App\Models\Setting;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use App\Support\Notifications\NotificationSettings;
use Tests\TestCase;

class SettingsIndexTest extends TestCase
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

    public function test_guest_cannot_view_settings(): void
    {
        $this->get(Domain::portal('/settings'))
            ->assertRedirect(Domain::auth());
    }

    public function test_authenticated_user_can_view_settings(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_settings_index');

        $tenant->makeCurrent();
        LeadStage::factory()->newLead()->create();
        MetaData::query()->create(['type' => MetaData::TYPE_CITY, 'value' => 'Karachi']);
        Setting::putGroup(Setting::GROUP_GENERAL, 'General', [
            'business_name' => 'Propflow Realty',
            'phone' => '+923001234567',
            'email' => 'hello@propflow.test',
            'website' => null,
            'address' => null,
            'logo_path' => null,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/settings'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('settings/index', false)
            ->where('section', 'general')
            ->has('sections')
            ->where('general.business_name', 'Propflow Realty')
            ->has('configuration')
            ->has('pipelineRules')
            ->has('metaTypes')
            ->has('stages', 1)
        );
    }

    public function test_settings_section_route_loads_requested_section(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_settings_section');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/settings/pipeline'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('settings/index', false)
                ->where('section', 'pipeline')
            );
    }

    public function test_pipeline_section_includes_stage_lead_counts(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_settings_pipeline_counts');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->create([
            'title' => 'New',
            'label' => 'new',
            'priority' => 1,
        ]);
        Lead::factory()->count(2)->create(['lead_stage_id' => $stage->id]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/settings/pipeline'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('settings/index', false)
                ->where('section', 'pipeline')
                ->where('stages.0.leads_count', 2)
            );
    }

    public function test_legacy_pipeline_rules_section_redirects_to_pipeline(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_settings_rules_redirect');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/settings/pipeline-rules'))
            ->assertRedirect(route('portal.settings.index', ['section' => 'pipeline']));
    }

    public function test_legacy_configuration_section_redirects_to_general(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_settings_config_redirect');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/settings/configuration'))
            ->assertRedirect(route('portal.settings.index', ['section' => 'general']));
    }

    public function test_unknown_settings_section_returns_not_found(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_settings_404');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/settings/not-a-section'))
            ->assertNotFound();
    }

    public function test_notifications_section_loads_workspace_defaults(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_settings_notifications');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/settings/notifications'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('settings/index', false)
                ->where('section', 'notifications')
                ->where('notifications.in_app', true)
                ->where('notifications.email', true)
                ->where('notifications.lead_created', true)
                ->where('notifications.lead_stage_changed', false)
                ->where('notifications.task_due', true)
                ->has('notificationCatalog', count(NotificationSettings::catalog()))
            );
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

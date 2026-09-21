<?php

namespace Tests\Feature\Portal;

use App\Models\Campaign;
use App\Models\CampaignForm;
use App\Models\Integration;
use App\Models\LeadStage;
use App\Models\Project;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class CampaignStoreTest extends TestCase
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

    public function test_campaign_can_be_created_with_form_and_project(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_campaign_store');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $project = Project::factory()->create();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->from(Domain::portal('/campaigns'))
            ->post(Domain::portal('/campaigns'), [
                'title' => 'City Vista Launch',
                'description' => 'Launch campaign for City Vista.',
                'purpose' => 'lead_generation',
                'source_type' => 'custom_form',
                'channel' => 'website',
                'status' => 'active',
                'project_id' => $project->id,
                'owner_id' => $user->id,
                'default_assignee_id' => $user->id,
                'default_lead_stage_id' => $stage->id,
                'budget' => 50000,
                'target_cpl' => 250,
                'tags' => ['launch', 'q2'],
                'lead_source_label' => 'City Vista landing',
                'create_form' => true,
                'utm' => [
                    'source' => 'facebook',
                    'medium' => 'cpc',
                    'campaign' => 'city-vista-launch',
                ],
                'goals' => [
                    'total_leads' => ['enabled' => true, 'target' => 100],
                    'qualified_leads' => ['enabled' => true, 'target' => 40],
                    'engagement' => ['enabled' => false, 'target' => 0],
                    'closed_deals' => ['enabled' => false, 'target' => 0],
                ],
                'landing' => [
                    'headline' => 'City Vista Launch',
                    'subheadline' => 'Register your interest today',
                    'cta_label' => 'Register interest',
                    'thank_you_message' => 'Thanks — our team will call you shortly.',
                ],
            ]);

        $tenant->makeCurrent();
        $campaign = Campaign::query()->latest('id')->first();
        $this->assertNotNull($campaign);
        $this->assertSame('City Vista Launch', $campaign->title);
        $this->assertSame('Launch campaign for City Vista.', $campaign->description);
        $this->assertSame('lead_generation', $campaign->purpose);
        $this->assertSame('custom_form', $campaign->source_type);
        $this->assertSame('website', $campaign->channel);
        $this->assertSame($user->id, $campaign->owner_id);
        $this->assertSame($project->id, $campaign->project_id);
        $this->assertSame($user->id, $campaign->default_assignee_id);
        $this->assertSame($stage->id, $campaign->default_lead_stage_id);
        $this->assertSame('50000.00', (string) $campaign->budget);
        $this->assertSame('250.00', (string) $campaign->target_cpl);
        $this->assertSame(['launch', 'q2'], $campaign->tags);
        $this->assertSame('facebook', data_get($campaign->utm, 'source'));
        $this->assertSame('Register your interest today', data_get($campaign->landing, 'subheadline'));
        $this->assertNotNull($campaign->campaign_form_id);
        $this->assertTrue((bool) data_get($campaign->goals, 'total_leads.enabled'));
        $this->assertSame(100, (int) data_get($campaign->goals, 'total_leads.target'));
        $this->assertTrue((bool) data_get($campaign->goals, 'qualified_leads.enabled'));
        $this->assertSame(40, (int) data_get($campaign->goals, 'qualified_leads.target'));
        $this->assertSame(1, CampaignForm::query()->count());

        $form = CampaignForm::query()->find($campaign->campaign_form_id);
        $this->assertSame($user->id, data_get($form->settings, 'assigned_to'));
        $this->assertSame($stage->id, data_get($form->settings, 'lead_stage_id'));
        $this->assertSame('City Vista landing', data_get($form->settings, 'source'));
        Tenant::forgetCurrent();

        $response->assertRedirect(Domain::portal('/campaigns/'.$campaign->slug));
    }

    public function test_campaign_can_be_created_with_title_only(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_campaign_minimal');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->from(Domain::portal('/campaigns'))
            ->post(Domain::portal('/campaigns'), [
                'title' => 'Quick Draft Campaign',
                'create_form' => true,
            ]);

        $tenant->makeCurrent();
        $campaign = Campaign::query()->latest('id')->first();
        $this->assertNotNull($campaign);
        $this->assertSame('Quick Draft Campaign', $campaign->title);
        $this->assertSame('draft', $campaign->status);
        $this->assertSame('lead_generation', $campaign->purpose);
        $this->assertSame('custom_form', $campaign->source_type);
        $this->assertNull($campaign->project_id);
        $this->assertNotNull($campaign->campaign_form_id);
        $this->assertSame(1, CampaignForm::query()->count());
        Tenant::forgetCurrent();

        $response->assertRedirect(Domain::portal('/campaigns/'.$campaign->slug));
    }

    public function test_campaign_store_requires_title(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_campaign_store_required');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->from(Domain::portal('/campaigns'))
            ->post(Domain::portal('/campaigns'), [
                'status' => 'draft',
                'source_type' => 'custom_form',
            ]);

        $response->assertRedirect(Domain::portal('/campaigns'));
        $response->assertSessionHasErrors(['title']);
    }

    public function test_meta_campaign_can_be_created_when_connected(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_campaign_meta');

        $tenant->makeCurrent();
        Integration::factory()->connected()->create([
            'provider' => Integration::PROVIDER_META,
            'external_id' => 'page-111',
            'external_name' => 'Acme Properties',
            'settings' => [
                'pages' => [
                    [
                        'id' => 'page-111',
                        'name' => 'Acme Properties',
                        'access_token' => 'encrypted',
                        'tasks' => [],
                    ],
                ],
            ],
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->from(Domain::portal('/campaigns'))
            ->post(Domain::portal('/campaigns'), [
                'title' => 'Meta Spring Leads',
                'source_type' => 'facebook',
                'status' => 'active',
                'source_config' => [
                    'page_id' => 'page-111',
                    'page_name' => 'Acme Properties',
                    'form_id' => 'form-55',
                    'form_name' => 'Spring Lead Form',
                ],
                'create_form' => false,
            ]);

        $tenant->makeCurrent();
        $campaign = Campaign::query()->latest('id')->first();
        $this->assertNotNull($campaign);
        $this->assertSame('facebook', $campaign->source_type);
        $this->assertSame('social', $campaign->channel);
        $this->assertSame('page-111', data_get($campaign->source_config, 'page_id'));
        $this->assertSame('form-55', data_get($campaign->source_config, 'form_id'));
        $this->assertSame('Spring Lead Form', data_get($campaign->source_config, 'form_name'));
        $this->assertNull($campaign->landing);
        $this->assertNull($campaign->campaign_form_id);
        $this->assertSame(0, CampaignForm::query()->count());
        Tenant::forgetCurrent();

        $response->assertRedirect(Domain::portal('/campaigns/'.$campaign->slug));
    }

    public function test_meta_campaign_requires_connected_integration(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_campaign_meta_required');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/campaigns'))
            ->post(Domain::portal('/campaigns'), [
                'title' => 'Blocked Meta Campaign',
                'source_type' => 'facebook',
                'source_config' => [
                    'page_id' => 'page-111',
                ],
            ])
            ->assertRedirect(Domain::portal('/campaigns'))
            ->assertSessionHasErrors(['source_type']);
    }

    public function test_whatsapp_campaign_can_be_created_when_connected(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_campaign_whatsapp');

        $tenant->makeCurrent();
        Integration::factory()->connected()->create([
            'provider' => Integration::PROVIDER_WHATSAPP,
            'external_id' => 'phone-111',
            'external_name' => 'Acme Sales',
            'settings' => [
                'wabas' => [
                    [
                        'id' => 'waba-111',
                        'name' => 'Acme WABA',
                        'phone_numbers' => [
                            [
                                'id' => 'phone-111',
                                'display_phone_number' => '+1 555 0100',
                                'verified_name' => 'Acme Sales',
                                'quality_rating' => 'GREEN',
                            ],
                        ],
                    ],
                ],
            ],
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->from(Domain::portal('/campaigns'))
            ->post(Domain::portal('/campaigns'), [
                'title' => 'WhatsApp Spring Leads',
                'source_type' => 'whatsapp',
                'status' => 'active',
                'source_config' => [
                    'phone_number_id' => 'phone-111',
                    'phone_number' => '+1 555 0100',
                    'phone_name' => 'Acme Sales',
                    'waba_id' => 'waba-111',
                ],
                'create_form' => false,
            ]);

        $tenant->makeCurrent();
        $campaign = Campaign::query()->latest('id')->first();
        $this->assertNotNull($campaign);
        $this->assertSame('whatsapp', $campaign->source_type);
        $this->assertSame('social', $campaign->channel);
        $this->assertSame('phone-111', data_get($campaign->source_config, 'phone_number_id'));
        $this->assertSame('waba-111', data_get($campaign->source_config, 'waba_id'));
        $this->assertNull($campaign->landing);
        $this->assertNull($campaign->campaign_form_id);
        $this->assertSame(0, CampaignForm::query()->count());
        Tenant::forgetCurrent();

        $response->assertRedirect(Domain::portal('/campaigns/'.$campaign->slug));
    }

    public function test_whatsapp_campaign_requires_connected_integration(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_campaign_whatsapp_required');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/campaigns'))
            ->post(Domain::portal('/campaigns'), [
                'title' => 'Blocked WhatsApp Campaign',
                'source_type' => 'whatsapp',
                'source_config' => [
                    'phone_number_id' => 'phone-111',
                ],
            ])
            ->assertRedirect(Domain::portal('/campaigns'))
            ->assertSessionHasErrors(['source_type']);
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

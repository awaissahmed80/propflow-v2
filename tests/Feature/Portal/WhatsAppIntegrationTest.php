<?php

namespace Tests\Feature\Portal;

use App\Models\Integration;
use App\Models\LeadStage;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use App\Support\Integrations\WhatsApp\WhatsAppOAuthClient;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class WhatsAppIntegrationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'app.base_domain' => 'propflow.test',
            'app.url_scheme' => 'https',
            'services.whatsapp.app_id' => 'wa-app-id',
            'services.whatsapp.app_secret' => 'wa-app-secret',
            'services.whatsapp.redirect' => Domain::portal('/settings/integrations/whatsapp/callback'),
            'services.whatsapp.graph_version' => 'v21.0',
            'services.whatsapp.scopes' => [
                'whatsapp_business_management',
                'whatsapp_business_messaging',
                'business_management',
            ],
            'services.whatsapp.webhook_verify_token' => 'wa-platform-verify-token',
        ]);

        $this->migrateLandlord();
        $this->migrateTenant();
    }

    public function test_whatsapp_is_available_in_integrations_catalog(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_wa_settings');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/settings/integrations'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('settings/index', false)
                ->where('section', 'integrations')
                ->where('integrations.1.provider', 'whatsapp')
                ->where('integrations.1.available', true)
            );
    }

    public function test_whatsapp_connect_redirects_to_facebook_oauth(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_wa_oauth_redirect');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/settings/integrations/whatsapp/connect'));

        $response->assertRedirect();
        $location = $response->headers->get('Location');
        $this->assertIsString($location);
        $this->assertStringContainsString('https://www.facebook.com/v21.0/dialog/oauth', $location);
        $this->assertStringContainsString('client_id=wa-app-id', $location);
        $this->assertStringContainsString('whatsapp_business_management', $location);
        $this->assertStringContainsString('whatsapp_business_messaging', $location);
        $this->assertStringContainsString('business_management', $location);
        $this->assertStringContainsString('auth_type=rerequest', $location);
        $this->assertStringNotContainsString('pages_show_list', $location);
        $this->assertStringNotContainsString('pages_manage_ads', $location);
        $this->assertStringNotContainsString('leads_retrieval', $location);
        $this->assertStringNotContainsString('instagram_basic', $location);
        $this->assertStringNotContainsString('instagram_manage_messages', $location);
        $this->assertStringNotContainsString('pages_messaging', $location);
        $this->assertTrue(session()->has(WhatsAppOAuthClient::SESSION_STATE_KEY));
    }

    public function test_whatsapp_oauth_strips_meta_lead_ads_scopes_from_config(): void
    {
        config([
            'services.whatsapp.scopes' => [
                'whatsapp_business_management',
                'pages_show_list',
                'instagram_basic',
                'leads_retrieval',
                'whatsapp_business_messaging',
                'business_management',
            ],
        ]);

        [$user, $tenant] = $this->createTenantUser('tenant_wa_oauth_scope_filter');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/settings/integrations/whatsapp/connect'));
        $location = $response->headers->get('Location');
        $this->assertIsString($location);

        $this->assertStringContainsString('whatsapp_business_management', $location);
        $this->assertStringContainsString('whatsapp_business_messaging', $location);
        $this->assertStringNotContainsString('pages_show_list', $location);
        $this->assertStringNotContainsString('instagram_basic', $location);
        $this->assertStringNotContainsString('leads_retrieval', $location);
    }

    public function test_whatsapp_oauth_callback_stores_waba_and_phones(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_wa_oauth_callback');

        Http::fake([
            'graph.facebook.com/*/oauth/access_token*' => Http::sequence()
                ->push(['access_token' => 'short-lived-token'], 200)
                ->push(['access_token' => 'long-lived-token'], 200),
            'graph.facebook.com/*/me?*' => Http::response([
                'id' => 'user-1',
                'name' => 'Wa Owner',
            ], 200),
            'graph.facebook.com/*/me/businesses*' => Http::response([
                'data' => [
                    [
                        'id' => 'biz-1',
                        'name' => 'Acme Biz',
                        'owned_whatsapp_business_accounts' => [
                            'data' => [
                                [
                                    'id' => 'waba-111',
                                    'name' => 'Acme WABA',
                                    'phone_numbers' => [
                                        'data' => [
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
                        ],
                    ],
                ],
            ], 200),
            'graph.facebook.com/*/waba-111/subscribed_apps*' => Http::response(['success' => true], 200),
        ]);

        $this->actingAs($user);
        session([
            TenantContext::SESSION_TENANT_ID => $tenant->id,
            WhatsAppOAuthClient::SESSION_STATE_KEY => 'expected-state',
        ]);

        $this->get(Domain::portal('/settings/integrations/whatsapp/callback').'?'.http_build_query([
            'code' => 'oauth-code',
            'state' => 'expected-state',
        ]))
            ->assertRedirect(Domain::portal('/settings/integrations'))
            ->assertSessionHas('success')
            ->assertSessionHas('open_whatsapp_config', true);

        $tenant->makeCurrent();
        $integration = Integration::query()->where('provider', Integration::PROVIDER_WHATSAPP)->first();
        $this->assertNotNull($integration);
        $this->assertSame(Integration::STATUS_CONNECTED, $integration->status);
        $this->assertSame('phone-111', $integration->external_id);
        $this->assertSame('Acme Sales', $integration->external_name);
        $this->assertSame('long-lived-token', $integration->access_token);
        $this->assertSame('waba-111', data_get($integration->settings, 'primary_waba_id'));
        $this->assertCount(1, data_get($integration->settings, 'wabas', []));
        Tenant::forgetCurrent();
    }

    public function test_whatsapp_settings_can_be_updated(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_wa_update_settings');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $qualified = LeadStage::factory()->create([
            'title' => 'Qualified',
            'label' => 'qualified',
            'priority' => 2,
        ]);
        Integration::factory()->connected()->create([
            'provider' => Integration::PROVIDER_WHATSAPP,
            'external_id' => 'phone-111',
            'external_name' => 'Acme Sales',
            'access_token' => 'token',
            'settings' => [
                'connected_via' => 'facebook_login',
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
                            [
                                'id' => 'phone-222',
                                'display_phone_number' => '+1 555 0200',
                                'verified_name' => 'Acme Support',
                                'quality_rating' => 'GREEN',
                            ],
                        ],
                    ],
                ],
                'primary_phone_number_id' => 'phone-111',
                'primary_waba_id' => 'waba-111',
                'lead_settings' => [
                    'sync_frequency' => 'realtime',
                    'default_owner' => 'round_robin',
                    'default_lead_stage_id' => $stage->id,
                    'notify_on_new_leads' => false,
                    'deduplicate_by_phone' => true,
                    'auto_tag_source' => true,
                ],
            ],
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/settings/integrations/whatsapp'), [
            'sync_frequency' => 'hourly',
            'default_owner' => (string) $user->id,
            'default_lead_stage_id' => $qualified->id,
            'notify_on_new_leads' => true,
            'deduplicate_by_phone' => false,
            'auto_tag_source' => false,
            'phone_number_id' => 'phone-222',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $integration = Integration::query()->where('provider', Integration::PROVIDER_WHATSAPP)->first();
        $this->assertSame('phone-222', $integration->external_id);
        $this->assertSame('Acme Support', $integration->external_name);
        $this->assertSame('hourly', data_get($integration->settings, 'lead_settings.sync_frequency'));
        $this->assertSame((string) $user->id, data_get($integration->settings, 'lead_settings.default_owner'));
        $this->assertFalse((bool) data_get($integration->settings, 'lead_settings.deduplicate_by_phone'));
        Tenant::forgetCurrent();
    }

    public function test_whatsapp_can_be_disconnected(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_wa_disconnect');

        $tenant->makeCurrent();
        Integration::factory()->connected()->create([
            'provider' => Integration::PROVIDER_WHATSAPP,
            'webhook_verify_token' => 'keep-me',
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/settings/integrations'))
            ->delete(Domain::portal('/settings/integrations/whatsapp'))
            ->assertRedirect(Domain::portal('/settings/integrations'));

        $tenant->makeCurrent();
        $integration = Integration::query()->where('provider', Integration::PROVIDER_WHATSAPP)->first();
        $this->assertNotNull($integration);
        $this->assertSame(Integration::STATUS_INACTIVE, $integration->status);
        $this->assertNull($integration->access_token);
        $this->assertSame('keep-me', $integration->webhook_verify_token);
        Tenant::forgetCurrent();
    }

    /**
     * @return array{0: User, 1: Tenant}
     */
    protected function createTenantUser(string $database): array
    {
        $user = User::factory()->tenant()->create();
        $tenant = Tenant::factory()->create(['database' => $database]);

        TenantUser::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'role' => 'owner',
        ]);

        return [$user, $tenant];
    }
}

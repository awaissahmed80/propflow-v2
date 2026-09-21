<?php

namespace Tests\Feature\Portal;

use App\Models\Integration;
use App\Models\LeadStage;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use App\Support\Integrations\Meta\MetaOAuthClient;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MetaIntegrationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'app.base_domain' => 'propflow.test',
            'app.url_scheme' => 'https',
            'services.meta.app_id' => 'meta-app-id',
            'services.meta.app_secret' => 'meta-app-secret',
            'services.meta.redirect' => Domain::portal('/settings/integrations/meta/callback'),
            'services.meta.graph_version' => 'v21.0',
            'services.meta.scopes' => [
                'pages_show_list',
                'pages_manage_ads',
                'leads_retrieval',
                'ads_management',
                'pages_messaging',
            ],
            'services.meta.webhook_verify_token' => 'platform-verify-token',
        ]);

        $this->migrateLandlord();
        $this->migrateTenant();
    }

    public function test_settings_integrations_section_loads_catalog(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_meta_settings');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/settings/integrations'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('settings/index', false)
                ->where('section', 'integrations')
                ->has('integrations', 3)
                ->where('integrations.0.provider', 'meta')
                ->where('integrations.1.provider', 'whatsapp')
                ->where('integrations.2.provider', 'google')
            );
    }

    public function test_meta_connect_redirects_to_facebook_oauth(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_meta_oauth_redirect');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/settings/integrations/meta/connect'));

        $response->assertRedirect();
        $location = $response->headers->get('Location');
        $this->assertIsString($location);
        $this->assertStringContainsString('https://www.facebook.com/v21.0/dialog/oauth', $location);
        $this->assertStringContainsString('client_id=meta-app-id', $location);
        $this->assertStringContainsString('leads_retrieval', $location);
        $this->assertStringContainsString('pages_manage_ads', $location);
        $this->assertTrue(session()->has(MetaOAuthClient::SESSION_STATE_KEY));
    }

    public function test_meta_oauth_callback_stores_pages_and_tokens(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_meta_oauth_callback');

        Http::fake([
            'graph.facebook.com/v21.0/oauth/access_token*' => Http::sequence()
                ->push(['access_token' => 'short-lived-token', 'token_type' => 'bearer'])
                ->push(['access_token' => 'long-lived-user-token', 'token_type' => 'bearer', 'expires_in' => 5184000]),
            'graph.facebook.com/v21.0/me/accounts*' => Http::response([
                'data' => [
                    [
                        'id' => 'page-111',
                        'name' => 'Acme Properties',
                        'access_token' => 'page-token-111',
                        'tasks' => ['MANAGE', 'MODERATE'],
                        'instagram_business_account' => [
                            'id' => 'ig-999',
                            'username' => 'acme.properties',
                            'name' => 'Acme Properties',
                        ],
                    ],
                    [
                        'id' => 'page-222',
                        'name' => 'Acme Sales',
                        'access_token' => 'page-token-222',
                        'tasks' => ['ADVERTISE'],
                    ],
                ],
            ]),
            'graph.facebook.com/v21.0/me*' => Http::response([
                'id' => 'user-123',
                'name' => 'Ada Lovelace',
            ]),
        ]);

        $this->actingAs($user);
        session([
            TenantContext::SESSION_TENANT_ID => $tenant->id,
            MetaOAuthClient::SESSION_STATE_KEY => 'state-abc',
        ]);

        $this->get(Domain::portal('/settings/integrations/meta/callback').'?'.http_build_query([
            'code' => 'oauth-code',
            'state' => 'state-abc',
        ]))
            ->assertRedirect(Domain::portal('/settings/integrations'))
            ->assertSessionHas('success')
            ->assertSessionHas('open_meta_config', true);

        $tenant->makeCurrent();
        $integration = Integration::query()->where('provider', Integration::PROVIDER_META)->first();
        $this->assertNotNull($integration);
        $this->assertSame(Integration::STATUS_CONNECTED, $integration->status);
        $this->assertSame('page-111', $integration->external_id);
        $this->assertSame('Acme Properties', $integration->external_name);
        $this->assertSame('page-token-111', $integration->access_token);
        $this->assertSame('long-lived-user-token', $integration->refresh_token);
        $this->assertSame('platform-verify-token', $integration->webhook_verify_token);
        $this->assertSame('facebook_login', data_get($integration->settings, 'connected_via'));
        $this->assertSame('user-123', data_get($integration->settings, 'meta_user_id'));
        $this->assertCount(2, data_get($integration->settings, 'pages', []));
        $this->assertNotSame('page-token-111', data_get($integration->settings, 'pages.0.access_token'));
        $this->assertSame('ig-999', data_get($integration->settings, 'pages.0.instagram.id'));
        $this->assertSame('acme.properties', data_get($integration->settings, 'pages.0.instagram.username'));
        $this->assertSame('realtime', data_get($integration->settings, 'lead_settings.sync_frequency'));
        $this->assertSame('round_robin', data_get($integration->settings, 'lead_settings.default_owner'));
        Tenant::forgetCurrent();
    }

    public function test_meta_oauth_callback_rejects_invalid_state(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_meta_oauth_bad_state');

        Http::fake();

        $this->actingAs($user);
        session([
            TenantContext::SESSION_TENANT_ID => $tenant->id,
            MetaOAuthClient::SESSION_STATE_KEY => 'expected-state',
        ]);

        $this->get(Domain::portal('/settings/integrations/meta/callback').'?'.http_build_query([
            'code' => 'oauth-code',
            'state' => 'wrong-state',
        ]))
            ->assertRedirect(Domain::portal('/settings/integrations'))
            ->assertSessionHas('error');

        $tenant->makeCurrent();
        $this->assertSame(0, Integration::query()->count());
        Tenant::forgetCurrent();
    }

    public function test_meta_lead_settings_can_be_updated(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_meta_update_settings');

        $client = app(MetaOAuthClient::class);
        $pages = $client->encryptPageTokens([
            [
                'id' => 'page-111',
                'name' => 'Acme Properties',
                'access_token' => 'page-token-111',
                'tasks' => ['MANAGE'],
            ],
            [
                'id' => 'page-222',
                'name' => 'Acme Sales',
                'access_token' => 'page-token-222',
                'tasks' => ['ADVERTISE'],
            ],
        ]);

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $qualified = LeadStage::factory()->create([
            'title' => 'Qualified',
            'label' => 'qualified',
            'priority' => 2,
        ]);
        Integration::factory()->connected()->create([
            'provider' => Integration::PROVIDER_META,
            'external_id' => 'page-111',
            'external_name' => 'Acme Properties',
            'access_token' => 'page-token-111',
            'settings' => [
                'connected_via' => 'facebook_login',
                'pages' => $pages,
                'primary_page_id' => 'page-111',
                'lead_settings' => [
                    'sync_frequency' => 'realtime',
                    'default_owner' => 'round_robin',
                    'default_lead_stage_id' => $stage->id,
                    'notify_on_new_leads' => false,
                    'deduplicate_by_email' => false,
                    'auto_tag_source' => false,
                ],
            ],
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/settings/integrations/meta'), [
            'sync_frequency' => 'hourly',
            'default_owner' => (string) $user->id,
            'default_lead_stage_id' => $qualified->id,
            'notify_on_new_leads' => true,
            'deduplicate_by_email' => true,
            'auto_tag_source' => true,
            'page_id' => 'page-222',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $integration = Integration::query()->where('provider', Integration::PROVIDER_META)->first();
        $this->assertSame('page-222', $integration->external_id);
        $this->assertSame('Acme Sales', $integration->external_name);
        $this->assertSame('page-token-222', $integration->access_token);
        $this->assertSame('hourly', data_get($integration->settings, 'lead_settings.sync_frequency'));
        $this->assertSame((string) $user->id, data_get($integration->settings, 'lead_settings.default_owner'));
        $this->assertSame($qualified->id, data_get($integration->settings, 'lead_settings.default_lead_stage_id'));
        $this->assertTrue(data_get($integration->settings, 'lead_settings.notify_on_new_leads'));
        $this->assertTrue(data_get($integration->settings, 'lead_settings.deduplicate_by_email'));
        $this->assertTrue(data_get($integration->settings, 'lead_settings.auto_tag_source'));
        Tenant::forgetCurrent();
    }

    public function test_meta_integration_can_be_disconnected(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_meta_disconnect');

        $tenant->makeCurrent();
        Integration::factory()->connected()->create([
            'provider' => Integration::PROVIDER_META,
            'webhook_verify_token' => 'keep-me',
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/settings/integrations'))
            ->delete(Domain::portal('/settings/integrations/meta'))
            ->assertRedirect(Domain::portal('/settings/integrations'));

        $tenant->makeCurrent();
        $integration = Integration::query()->where('provider', Integration::PROVIDER_META)->first();
        $this->assertNotNull($integration);
        $this->assertSame(Integration::STATUS_INACTIVE, $integration->status);
        $this->assertNull($integration->access_token);
        $this->assertNull($integration->refresh_token);
        $this->assertNull($integration->external_id);
        $this->assertNull($integration->external_name);
        $this->assertSame('keep-me', $integration->webhook_verify_token);
        Tenant::forgetCurrent();
    }

    public function test_meta_lead_forms_can_be_fetched_for_connected_page(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_meta_lead_forms');

        $client = app(MetaOAuthClient::class);
        $pages = $client->encryptPageTokens([
            [
                'id' => 'page-111',
                'name' => 'Acme Properties',
                'access_token' => 'page-token-111',
                'tasks' => ['MANAGE'],
            ],
        ]);

        $tenant->makeCurrent();
        Integration::factory()->connected()->create([
            'provider' => Integration::PROVIDER_META,
            'external_id' => 'page-111',
            'external_name' => 'Acme Properties',
            'access_token' => 'page-token-111',
            'settings' => [
                'connected_via' => 'facebook_login',
                'pages' => $pages,
                'primary_page_id' => 'page-111',
            ],
        ]);
        Tenant::forgetCurrent();

        Http::fake([
            'graph.facebook.com/*' => Http::response([
                'data' => [
                    [
                        'id' => 'form-55',
                        'name' => 'Spring Lead Form',
                        'status' => 'ACTIVE',
                        'leads_count' => 12,
                    ],
                    [
                        'id' => 'form-66',
                        'name' => 'Archived Form',
                        'status' => 'ARCHIVED',
                        'leads_count' => 0,
                    ],
                ],
            ], 200),
        ]);

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->getJson(Domain::portal('/settings/integrations/meta/forms').'?page_id=page-111')
            ->assertOk()
            ->assertJson([
                'forms' => [
                    [
                        'id' => 'form-55',
                        'name' => 'Spring Lead Form',
                        'status' => 'ACTIVE',
                        'leads_count' => 12,
                    ],
                    [
                        'id' => 'form-66',
                        'name' => 'Archived Form',
                        'status' => 'ARCHIVED',
                        'leads_count' => 0,
                    ],
                ],
            ]);

        Http::assertSent(function ($request) {
            return str_contains($request->url(), '/page-111/leadgen_forms')
                && $request['access_token'] === 'page-token-111';
        });
    }

    public function test_meta_lead_forms_require_connected_page(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_meta_lead_forms_missing');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->getJson(Domain::portal('/settings/integrations/meta/forms').'?page_id=page-111')
            ->assertStatus(422)
            ->assertJsonPath('message', 'Connect Meta before loading lead forms.');
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

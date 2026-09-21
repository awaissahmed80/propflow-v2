<?php

namespace Tests\Feature\Public;

use App\Jobs\ProcessMetaWebhook;
use App\Models\Campaign;
use App\Models\Integration;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Support\Domain;
use App\Support\Integrations\Meta\MetaOAuthClient;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class MetaWebhookTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'app.base_domain' => 'propflow.test',
            'app.url_scheme' => 'https',
            'services.meta.app_secret' => null,
            'services.meta.webhook_verify_token' => null,
            'services.meta.graph_version' => 'v21.0',
        ]);

        $this->migrateLandlord();
        $this->migrateTenant();
    }

    public function test_webhook_verification_returns_challenge(): void
    {
        $tenant = $this->createConnectedMetaTenant('tenant_meta_webhook_verify');

        $response = $this->get(Domain::campaign('/webhooks/meta/'.$tenant->identifier).'?'.http_build_query([
            'hub_mode' => 'subscribe',
            'hub_verify_token' => 'tenant-verify-token',
            'hub_challenge' => 'challenge-abc-123',
        ]));

        $response->assertOk()
            ->assertHeader('Content-Type', 'text/plain; charset=UTF-8')
            ->assertSee('challenge-abc-123', false);
    }

    public function test_webhook_verification_rejects_invalid_token(): void
    {
        $tenant = $this->createConnectedMetaTenant('tenant_meta_webhook_bad_token');

        $this->get(Domain::campaign('/webhooks/meta/'.$tenant->identifier).'?'.http_build_query([
            'hub_mode' => 'subscribe',
            'hub_verify_token' => 'wrong-token',
            'hub_challenge' => 'challenge-abc-123',
        ]))->assertForbidden();
    }

    public function test_webhook_verification_returns_not_found_for_unknown_tenant(): void
    {
        $this->get(Domain::campaign('/webhooks/meta/missing-tenant').'?'.http_build_query([
            'hub_mode' => 'subscribe',
            'hub_verify_token' => 'any',
            'hub_challenge' => 'challenge',
        ]))->assertNotFound();
    }

    public function test_webhook_receive_dispatches_job(): void
    {
        Queue::fake();

        $tenant = $this->createConnectedMetaTenant('tenant_meta_webhook_dispatch');

        $this->postJson(Domain::campaign('/webhooks/meta/'.$tenant->identifier), [
            'object' => 'page',
            'entry' => [],
        ])
            ->assertOk()
            ->assertSee('EVENT_RECEIVED', false);

        Queue::assertPushed(ProcessMetaWebhook::class, function (ProcessMetaWebhook $job) use ($tenant): bool {
            return $job->tenantIdentifier === $tenant->identifier;
        });
    }

    public function test_leadgen_webhook_creates_lead_from_graph_payload(): void
    {
        $tenant = $this->createConnectedMetaTenant('tenant_meta_webhook_leadgen', pageId: 'page-111');

        $tenant->makeCurrent();
        $campaign = Campaign::factory()->create([
            'title' => 'Meta Spring',
            'source_type' => Campaign::SOURCE_FACEBOOK,
            'status' => Campaign::STATUS_ACTIVE,
            'source_config' => [
                'page_id' => 'page-111',
                'page_name' => 'Acme Properties',
                'form_id' => 'form-1',
            ],
        ]);
        Tenant::forgetCurrent();

        Http::fake([
            'graph.facebook.com/v21.0/999*' => Http::response([
                'id' => '999',
                'created_time' => '2026-09-18T10:00:00+0000',
                'ad_id' => 'ad-1',
                'form_id' => 'form-1',
                'field_data' => [
                    ['name' => 'full_name', 'values' => ['Sara Khan']],
                    ['name' => 'email', 'values' => ['sara@example.com']],
                    ['name' => 'phone_number', 'values' => ['+923001112233']],
                    ['name' => 'city', 'values' => ['Lahore']],
                ],
            ]),
        ]);

        $this->postJson(Domain::campaign('/webhooks/meta/'.$tenant->identifier), [
            'object' => 'page',
            'entry' => [
                [
                    'id' => 'page-111',
                    'time' => now()->timestamp,
                    'changes' => [
                        [
                            'field' => 'leadgen',
                            'value' => [
                                'leadgen_id' => '999',
                                'page_id' => 'page-111',
                                'form_id' => 'form-1',
                            ],
                        ],
                    ],
                ],
            ],
        ])->assertOk();

        $tenant->makeCurrent();
        $lead = Lead::query()->latest('id')->first();
        $this->assertNotNull($lead);
        $this->assertSame('Sara', $lead->contact->first_name);
        $this->assertSame('Khan', $lead->contact->last_name);
        $this->assertSame('sara@example.com', $lead->contact->email_address);
        $this->assertSame($campaign->id, $lead->campaign_id);
        $this->assertSame('999', data_get($lead->attributes, 'meta.leadgen_id'));
        $this->assertStringContainsString('City: Lahore', (string) $lead->notes);

        $integration = Integration::query()->where('provider', Integration::PROVIDER_META)->first();
        $this->assertNotNull($integration?->last_synced_at);
        $this->assertSame(1, (int) $integration->leads_synced_count);
        Tenant::forgetCurrent();
    }

    public function test_messenger_webhook_creates_lead_from_inbound_message(): void
    {
        $tenant = $this->createConnectedMetaTenant('tenant_meta_webhook_messenger', pageId: 'page-111');

        $this->postJson(Domain::campaign('/webhooks/meta/'.$tenant->identifier), [
            'object' => 'page',
            'entry' => [
                [
                    'id' => 'page-111',
                    'time' => now()->timestamp,
                    'messaging' => [
                        [
                            'sender' => ['id' => 'psid-123'],
                            'recipient' => ['id' => 'page-111'],
                            'timestamp' => now()->getTimestampMs(),
                            'message' => [
                                'mid' => 'mid.messenger.1',
                                'text' => 'Hi, I want a villa',
                            ],
                        ],
                    ],
                ],
            ],
        ])->assertOk();

        $tenant->makeCurrent();
        $lead = Lead::query()->latest('id')->first();
        $this->assertNotNull($lead);
        $this->assertSame('Messenger', $lead->source);
        $this->assertSame('Hi, I want a villa', $lead->notes);
        $this->assertSame('psid-123', data_get($lead->attributes, 'meta.sender_id'));
        Tenant::forgetCurrent();
    }

    public function test_instagram_webhook_creates_lead_from_inbound_message(): void
    {
        $tenant = $this->createConnectedMetaTenant('tenant_meta_webhook_instagram', pageId: 'page-111');

        $this->postJson(Domain::campaign('/webhooks/meta/'.$tenant->identifier), [
            'object' => 'instagram',
            'entry' => [
                [
                    'id' => 'ig-999',
                    'time' => now()->timestamp,
                    'messaging' => [
                        [
                            'sender' => ['id' => 'igsid-456'],
                            'recipient' => ['id' => 'ig-999'],
                            'timestamp' => now()->getTimestampMs(),
                            'message' => [
                                'mid' => 'mid.instagram.1',
                                'text' => 'Interested in your project',
                            ],
                        ],
                    ],
                ],
            ],
        ])->assertOk();

        $tenant->makeCurrent();
        $lead = Lead::query()->latest('id')->first();
        $this->assertNotNull($lead);
        $this->assertSame('Instagram', $lead->source);
        $this->assertSame('Interested in your project', $lead->notes);
        $this->assertSame('instagram', data_get($lead->attributes, 'meta.channel'));
        Tenant::forgetCurrent();
    }

    public function test_webhook_receive_rejects_invalid_signature_when_secret_configured(): void
    {
        config(['services.meta.app_secret' => 'meta-app-secret']);

        $tenant = $this->createConnectedMetaTenant('tenant_meta_webhook_sig');

        $this->postJson(
            Domain::campaign('/webhooks/meta/'.$tenant->identifier),
            ['object' => 'page', 'entry' => []],
            ['X-Hub-Signature-256' => 'sha256=invalid']
        )->assertForbidden();
    }

    public function test_webhook_receive_accepts_valid_signature(): void
    {
        $secret = 'meta-app-secret';
        config(['services.meta.app_secret' => $secret]);

        $tenant = $this->createConnectedMetaTenant('tenant_meta_webhook_sig_ok');

        $payload = json_encode(['object' => 'page', 'entry' => []], JSON_THROW_ON_ERROR);
        $signature = 'sha256='.hash_hmac('sha256', $payload, $secret);

        $this->call(
            'POST',
            Domain::campaign('/webhooks/meta/'.$tenant->identifier),
            [],
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_X_HUB_SIGNATURE_256' => $signature,
            ],
            $payload
        )->assertOk();
    }

    protected function createConnectedMetaTenant(string $database, string $pageId = '10987654321'): Tenant
    {
        $user = User::factory()->tenant()->create();
        $tenant = Tenant::factory()->create([
            'database' => $database,
            'identifier' => str_replace('_', '-', $database),
        ]);

        TenantUser::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'is_owner' => true,
        ]);

        $client = app(MetaOAuthClient::class);
        $pages = $client->encryptPageTokens([
            [
                'id' => $pageId,
                'name' => 'Acme Properties',
                'access_token' => 'page-token-'.$pageId,
                'tasks' => ['MANAGE', 'MESSAGING'],
                'instagram' => [
                    'id' => 'ig-999',
                    'username' => 'acme.properties',
                    'name' => 'Acme Properties',
                ],
            ],
        ]);

        $tenant->makeCurrent();
        LeadStage::factory()->newLead()->create();
        Integration::factory()->connected()->create([
            'provider' => Integration::PROVIDER_META,
            'external_id' => $pageId,
            'external_name' => 'Acme Properties',
            'access_token' => 'page-token-'.$pageId,
            'webhook_verify_token' => 'tenant-verify-token',
            'leads_synced_count' => 0,
            'settings' => [
                'connected_via' => 'facebook_login',
                'pages' => $pages,
                'primary_page_id' => $pageId,
                'lead_settings' => [
                    'sync_frequency' => 'realtime',
                    'default_owner' => 'round_robin',
                    'default_lead_stage_id' => LeadStage::query()->value('id'),
                    'notify_on_new_leads' => false,
                    'deduplicate_by_email' => false,
                    'auto_tag_source' => false,
                ],
            ],
        ]);
        Tenant::forgetCurrent();

        return $tenant;
    }
}

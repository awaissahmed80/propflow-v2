<?php

namespace Tests\Feature\Public;

use App\Jobs\ProcessWhatsAppWebhook;
use App\Models\Campaign;
use App\Models\Integration;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Support\Domain;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class WhatsAppWebhookTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'app.base_domain' => 'propflow.test',
            'app.url_scheme' => 'https',
            'services.whatsapp.app_secret' => null,
            'services.whatsapp.webhook_verify_token' => null,
            'services.whatsapp.graph_version' => 'v21.0',
        ]);

        $this->migrateLandlord();
        $this->migrateTenant();
    }

    public function test_webhook_verification_returns_challenge(): void
    {
        $tenant = $this->createConnectedWhatsAppTenant('tenant_wa_webhook_verify');

        $response = $this->get(Domain::campaign('/webhooks/whatsapp/'.$tenant->identifier).'?'.http_build_query([
            'hub_mode' => 'subscribe',
            'hub_verify_token' => 'tenant-verify-token',
            'hub_challenge' => 'challenge-wa-123',
        ]));

        $response->assertOk()
            ->assertHeader('Content-Type', 'text/plain; charset=UTF-8')
            ->assertSee('challenge-wa-123', false);
    }

    public function test_webhook_verification_rejects_invalid_token(): void
    {
        $tenant = $this->createConnectedWhatsAppTenant('tenant_wa_webhook_bad_token');

        $this->get(Domain::campaign('/webhooks/whatsapp/'.$tenant->identifier).'?'.http_build_query([
            'hub_mode' => 'subscribe',
            'hub_verify_token' => 'wrong-token',
            'hub_challenge' => 'challenge-wa-123',
        ]))->assertForbidden();
    }

    public function test_webhook_receive_dispatches_job(): void
    {
        Queue::fake();

        $tenant = $this->createConnectedWhatsAppTenant('tenant_wa_webhook_dispatch');

        $this->postJson(Domain::campaign('/webhooks/whatsapp/'.$tenant->identifier), [
            'object' => 'whatsapp_business_account',
            'entry' => [],
        ])
            ->assertOk()
            ->assertSee('EVENT_RECEIVED', false);

        Queue::assertPushed(ProcessWhatsAppWebhook::class, function (ProcessWhatsAppWebhook $job) use ($tenant): bool {
            return $job->tenantIdentifier === $tenant->identifier;
        });
    }

    public function test_inbound_message_creates_lead_for_whatsapp_campaign(): void
    {
        $tenant = $this->createConnectedWhatsAppTenant('tenant_wa_webhook_message', phoneNumberId: 'phone-111');

        $tenant->makeCurrent();
        LeadStage::factory()->newLead()->create();
        $campaign = Campaign::factory()->create([
            'title' => 'WhatsApp Spring',
            'source_type' => Campaign::SOURCE_WHATSAPP,
            'status' => Campaign::STATUS_ACTIVE,
            'source_config' => [
                'phone_number_id' => 'phone-111',
                'phone_number' => '+1 555 0100',
                'waba_id' => 'waba-111',
            ],
        ]);
        Tenant::forgetCurrent();

        $this->postJson(Domain::campaign('/webhooks/whatsapp/'.$tenant->identifier), [
            'object' => 'whatsapp_business_account',
            'entry' => [
                [
                    'id' => 'waba-111',
                    'changes' => [
                        [
                            'field' => 'messages',
                            'value' => [
                                'messaging_product' => 'whatsapp',
                                'metadata' => [
                                    'display_phone_number' => '15550100',
                                    'phone_number_id' => 'phone-111',
                                ],
                                'contacts' => [
                                    [
                                        'profile' => ['name' => 'Jane Doe'],
                                        'wa_id' => '15551234567',
                                    ],
                                ],
                                'messages' => [
                                    [
                                        'from' => '15551234567',
                                        'id' => 'wamid.abc123',
                                        'timestamp' => (string) now()->timestamp,
                                        'type' => 'text',
                                        'text' => ['body' => 'Interested in a 2BR'],
                                        'referral' => [
                                            'source_type' => 'ad',
                                            'source_id' => 'ad-99',
                                            'headline' => 'Spring Offer',
                                            'ctwa_clid' => 'ctwa-1',
                                        ],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ])->assertOk();

        $tenant->makeCurrent();
        $lead = Lead::query()->latest('id')->first();
        $this->assertNotNull($lead);
        $this->assertSame($campaign->id, $lead->campaign_id);
        $this->assertSame('WhatsApp', $lead->source);
        $this->assertStringContainsString('Interested in a 2BR', (string) $lead->notes);
        $this->assertStringContainsString('CTWA: Spring Offer', (string) $lead->notes);
        $this->assertSame('wamid.abc123', data_get($lead->attributes, 'whatsapp.message_id'));
        $this->assertSame('phone-111', data_get($lead->attributes, 'whatsapp.phone_number_id'));
        $this->assertSame('Jane', $lead->contact->first_name);
        Tenant::forgetCurrent();
    }

    public function test_duplicate_message_id_is_idempotent(): void
    {
        $tenant = $this->createConnectedWhatsAppTenant('tenant_wa_webhook_idempotent', phoneNumberId: 'phone-111');

        $tenant->makeCurrent();
        LeadStage::factory()->newLead()->create();
        Campaign::factory()->create([
            'source_type' => Campaign::SOURCE_WHATSAPP,
            'status' => Campaign::STATUS_ACTIVE,
            'source_config' => ['phone_number_id' => 'phone-111'],
        ]);
        Tenant::forgetCurrent();

        $payload = [
            'object' => 'whatsapp_business_account',
            'entry' => [
                [
                    'id' => 'waba-111',
                    'changes' => [
                        [
                            'field' => 'messages',
                            'value' => [
                                'metadata' => [
                                    'phone_number_id' => 'phone-111',
                                    'display_phone_number' => '15550100',
                                ],
                                'contacts' => [
                                    ['profile' => ['name' => 'Sam'], 'wa_id' => '15559876543'],
                                ],
                                'messages' => [
                                    [
                                        'from' => '15559876543',
                                        'id' => 'wamid.same',
                                        'timestamp' => (string) now()->timestamp,
                                        'type' => 'text',
                                        'text' => ['body' => 'Hello once'],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ];

        $this->postJson(Domain::campaign('/webhooks/whatsapp/'.$tenant->identifier), $payload)->assertOk();
        $this->postJson(Domain::campaign('/webhooks/whatsapp/'.$tenant->identifier), $payload)->assertOk();

        $tenant->makeCurrent();
        $this->assertSame(1, Lead::query()->count());
        Tenant::forgetCurrent();
    }

    public function test_webhook_receive_rejects_invalid_signature_when_secret_configured(): void
    {
        config(['services.whatsapp.app_secret' => 'wa-app-secret']);

        $tenant = $this->createConnectedWhatsAppTenant('tenant_wa_webhook_sig');

        $this->postJson(
            Domain::campaign('/webhooks/whatsapp/'.$tenant->identifier),
            ['object' => 'whatsapp_business_account', 'entry' => []],
            ['X-Hub-Signature-256' => 'sha256=invalid']
        )->assertForbidden();
    }

    protected function createConnectedWhatsAppTenant(
        string $database,
        string $phoneNumberId = 'phone-111',
    ): Tenant {
        $user = User::factory()->tenant()->create();
        $tenant = Tenant::factory()->create([
            'database' => $database,
            'identifier' => $database,
        ]);

        TenantUser::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'role' => 'owner',
        ]);

        $tenant->makeCurrent();
        Integration::factory()->connected()->create([
            'provider' => Integration::PROVIDER_WHATSAPP,
            'external_id' => $phoneNumberId,
            'external_name' => 'Acme Sales',
            'access_token' => 'wa-token',
            'webhook_verify_token' => 'tenant-verify-token',
            'leads_synced_count' => 0,
            'settings' => [
                'connected_via' => 'facebook_login',
                'primary_phone_number_id' => $phoneNumberId,
                'primary_waba_id' => 'waba-111',
                'wabas' => [
                    [
                        'id' => 'waba-111',
                        'name' => 'Acme WABA',
                        'phone_numbers' => [
                            [
                                'id' => $phoneNumberId,
                                'display_phone_number' => '+1 555 0100',
                                'verified_name' => 'Acme Sales',
                                'quality_rating' => 'GREEN',
                            ],
                        ],
                    ],
                ],
                'lead_settings' => [
                    'sync_frequency' => 'realtime',
                    'default_owner' => 'round_robin',
                    'default_lead_stage_id' => null,
                    'notify_on_new_leads' => false,
                    'deduplicate_by_phone' => false,
                    'auto_tag_source' => true,
                ],
            ],
        ]);
        Tenant::forgetCurrent();

        return $tenant;
    }
}

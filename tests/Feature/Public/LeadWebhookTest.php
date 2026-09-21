<?php

namespace Tests\Feature\Public;

use App\Models\Campaign;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\LeadWebhook;
use App\Models\LeadWebhookDelivery;
use App\Models\Project;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Domain;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class LeadWebhookTest extends TestCase
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

    public function test_unknown_tenant_is_not_found(): void
    {
        $this->postJson(Domain::campaign('/webhooks/leads/missing-tenant'), [
            'email_address' => 'cathy@example.com',
        ])->assertNotFound();
    }

    public function test_disabled_webhook_is_not_found(): void
    {
        $tenant = $this->createTenant('tenant_lead_webhook_disabled');
        $tenant->makeCurrent();
        LeadWebhook::factory()->create(['enabled' => false]);
        Tenant::forgetCurrent();

        $this->postSigned($tenant, ['email_address' => 'cathy@example.com'], 'ignored')
            ->assertNotFound();

        $tenant->makeCurrent();
        $this->assertSame(0, LeadWebhookDelivery::query()->count());
        Tenant::forgetCurrent();
    }

    public function test_invalid_signature_is_rejected_without_creating_a_lead(): void
    {
        $tenant = $this->enableWebhook('tenant_lead_webhook_bad_signature');

        $this->postSigned($tenant, [
            'email_address' => 'cathy@example.com',
        ], 'wrong-secret')->assertUnauthorized()
            ->assertJsonPath('message', 'The signature is invalid.');

        $tenant->makeCurrent();
        $this->assertSame(0, Lead::query()->count());
        $this->assertSame(1, LeadWebhookDelivery::query()->where('status', LeadWebhookDelivery::STATUS_REJECTED)->count());
        Tenant::forgetCurrent();
    }

    public function test_payload_without_phone_or_email_is_rejected(): void
    {
        $tenant = $this->enableWebhook('tenant_lead_webhook_missing_contact');

        $this->postSigned($tenant, [
            'first_name' => 'Cathy',
            'source' => 'Partner CRM',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['phone_number']);

        $tenant->makeCurrent();
        $this->assertSame(0, Lead::query()->count());
        $this->assertSame(1, LeadWebhookDelivery::query()->where('http_status', 422)->count());
        Tenant::forgetCurrent();
    }

    public function test_signed_payload_creates_a_lead_and_returns_its_code(): void
    {
        $tenant = $this->enableWebhook('tenant_lead_webhook_create', [
            'default_source' => 'Fallback source',
        ]);

        $response = $this->postSigned($tenant, [
            'first_name' => 'Cathy',
            'last_name' => 'Grady',
            'phone_number' => '+923001234567',
            'email_address' => 'cathy@example.com',
            'source' => 'Partner CRM',
            'budget' => 2500000,
            'notes' => 'Asked about the corner unit.',
        ]);

        $response->assertCreated();

        $tenant->makeCurrent();
        $lead = Lead::query()->with('contact')->first();
        $this->assertNotNull($lead);
        $response->assertJsonPath('lead.code', $lead->code);
        $this->assertSame('Partner CRM', $lead->source);
        $this->assertSame('2500000.00', $lead->budget);
        $this->assertSame('Asked about the corner unit.', $lead->notes);
        $this->assertSame('cathy@example.com', $lead->contact->email_address);
        $this->assertNull($lead->campaign_id);
        $delivery = LeadWebhookDelivery::query()
            ->where('status', LeadWebhookDelivery::STATUS_ACCEPTED)
            ->where('lead_id', $lead->id)
            ->first();
        $this->assertNotNull($delivery);
        $this->assertSame(201, $delivery->http_status);
        Tenant::forgetCurrent();
    }

    public function test_missing_source_uses_the_webhook_default(): void
    {
        $tenant = $this->enableWebhook('tenant_lead_webhook_default_source', [
            'default_source' => 'Partner site',
        ]);

        $this->postSigned($tenant, [
            'email_address' => 'cathy@example.com',
        ])->assertCreated();

        $tenant->makeCurrent();
        $this->assertSame('Partner site', Lead::query()->value('source'));
        Tenant::forgetCurrent();
    }

    public function test_missing_source_and_default_uses_webhook(): void
    {
        $tenant = $this->enableWebhook('tenant_lead_webhook_generic_source');

        $this->postSigned($tenant, [
            'email_address' => 'cathy@example.com',
        ])->assertCreated();

        $tenant->makeCurrent();
        $this->assertSame('Webhook', Lead::query()->value('source'));
        Tenant::forgetCurrent();
    }

    public function test_campaign_code_attaches_the_active_campaign(): void
    {
        $tenant = Tenant::factory()->create(['database' => 'tenant_lead_webhook_campaign']);
        $assignee = User::factory()->tenant()->create();
        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $project = Project::factory()->create();
        $campaign = Campaign::factory()->active()->create([
            'project_id' => $project->id,
            'default_assignee_id' => $assignee->id,
            'default_lead_stage_id' => $stage->id,
        ]);
        LeadWebhook::factory()->enabled()->create([
            'signing_secret' => 'test-signing-secret',
        ]);
        Tenant::forgetCurrent();

        $this->postSigned($tenant, [
            'email_address' => 'cathy@example.com',
            'campaign_code' => $campaign->public_id,
            'source' => 'Partner CRM',
        ])->assertCreated();

        $tenant->makeCurrent();
        $lead = Lead::query()->first();
        $this->assertSame($campaign->id, $lead->campaign_id);
        $this->assertSame($project->id, $lead->project_id);
        $this->assertSame($assignee->id, $lead->assigned_to);
        $this->assertSame($stage->id, $lead->lead_stage_id);
        $this->assertSame('Partner CRM', $lead->source);
        Tenant::forgetCurrent();
    }

    public function test_unknown_campaign_code_is_rejected(): void
    {
        $tenant = $this->enableWebhook('tenant_lead_webhook_unknown_campaign');

        $this->postSigned($tenant, [
            'email_address' => 'cathy@example.com',
            'campaign_code' => (string) Str::uuid(),
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['campaign_code']);

        $tenant->makeCurrent();
        $this->assertSame(0, Lead::query()->count());
        Tenant::forgetCurrent();
    }

    public function test_inactive_campaign_code_is_rejected(): void
    {
        $tenant = Tenant::factory()->create(['database' => 'tenant_lead_webhook_inactive']);
        $tenant->makeCurrent();
        $campaign = Campaign::factory()->create(['status' => Campaign::STATUS_DRAFT]);
        LeadWebhook::factory()->enabled()->create([
            'signing_secret' => 'test-signing-secret',
        ]);
        Tenant::forgetCurrent();

        $this->postSigned($tenant, [
            'email_address' => 'cathy@example.com',
            'campaign_code' => $campaign->public_id,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['campaign_code']);

        $tenant->makeCurrent();
        $this->assertSame(0, Lead::query()->count());
        Tenant::forgetCurrent();
    }

    public function test_omitted_campaign_code_uses_the_default_campaign(): void
    {
        $tenant = Tenant::factory()->create(['database' => 'tenant_lead_webhook_default_campaign']);
        $tenant->makeCurrent();
        $campaign = Campaign::factory()->active()->create();
        LeadWebhook::factory()->enabled()->create([
            'signing_secret' => 'test-signing-secret',
            'default_campaign_id' => $campaign->id,
        ]);
        Tenant::forgetCurrent();

        $this->postSigned($tenant, [
            'phone_number' => '+923001234567',
        ])->assertCreated();

        $tenant->makeCurrent();
        $this->assertSame($campaign->id, Lead::query()->value('campaign_id'));
        Tenant::forgetCurrent();
    }

    protected function createTenant(string $database): Tenant
    {
        return Tenant::factory()->create(['database' => $database]);
    }

    /**
     * @param  array<string, mixed>  $webhook
     */
    protected function enableWebhook(string $database, array $webhook = []): Tenant
    {
        $tenant = $this->createTenant($database);
        $tenant->makeCurrent();
        LeadStage::factory()->newLead()->create();
        LeadWebhook::factory()->enabled()->create([
            'signing_secret' => 'test-signing-secret',
            ...$webhook,
        ]);
        Tenant::forgetCurrent();

        return $tenant;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    protected function postSigned(Tenant $tenant, array $payload, string $secret = 'test-signing-secret'): TestResponse
    {
        $body = json_encode($payload);

        return $this->call(
            'POST',
            Domain::campaign('/webhooks/leads/'.$tenant->identifier),
            [],
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_ACCEPT' => 'application/json',
                'HTTP_X_PROPFLOW_SIGNATURE' => LeadWebhook::sign((string) $body, $secret),
            ],
            $body === false ? '' : $body,
        );
    }
}

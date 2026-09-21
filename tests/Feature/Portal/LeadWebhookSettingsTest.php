<?php

namespace Tests\Feature\Portal;

use App\Models\Campaign;
use App\Models\LeadStage;
use App\Models\LeadWebhook;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class LeadWebhookSettingsTest extends TestCase
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

    public function test_guest_cannot_update_the_lead_webhook(): void
    {
        $this->put(Domain::portal('/settings/lead-webhook'), [
            'enabled' => true,
        ])->assertRedirect(Domain::auth());
    }

    public function test_developer_section_shows_the_webhook_url(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_webhook_settings');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/settings/developer'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('settings/index', false)
                ->where('section', 'developer')
                ->where('leadWebhook.enabled', false)
                ->where('leadWebhook.signing_secret', null)
                ->where('leadWebhook.url', Domain::campaign('/webhooks/leads/'.$tenant->identifier))
                ->where('leadWebhook.signature_header', LeadWebhook::SIGNATURE_HEADER)
                ->where('sections', function ($sections): bool {
                    $developer = collect($sections)->firstWhere('id', 'developer');

                    return is_array($developer)
                        && ($developer['label'] ?? null) === 'Developer'
                        && ! array_key_exists('coming_soon', $developer);
                })
            );
    }

    public function test_enabling_the_webhook_generates_a_signing_secret(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_webhook_enable');
        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $campaign = Campaign::factory()->active()->create();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/settings/lead-webhook'), [
            'enabled' => true,
            'default_source' => 'Partner CRM',
            'default_campaign_id' => $campaign->id,
            'default_lead_stage_id' => $stage->id,
            'default_assignee_id' => $user->id,
        ])->assertRedirect();

        $tenant->makeCurrent();
        $webhook = LeadWebhook::query()->first();
        $this->assertNotNull($webhook);
        $this->assertTrue($webhook->enabled);
        $this->assertNotSame('', (string) $webhook->signing_secret);
        $this->assertSame('Partner CRM', $webhook->default_source);
        $this->assertSame($campaign->id, $webhook->default_campaign_id);
        $this->assertSame($stage->id, $webhook->default_lead_stage_id);
        $this->assertSame($user->id, $webhook->default_assignee_id);
        Tenant::forgetCurrent();
    }

    public function test_rotating_the_secret_replaces_it(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_webhook_rotate');
        $tenant->makeCurrent();
        $webhook = LeadWebhook::factory()->enabled()->create([
            'signing_secret' => 'original-secret',
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/settings/lead-webhook/rotate'))
            ->assertRedirect();

        $tenant->makeCurrent();
        $webhook->refresh();
        $this->assertNotSame('original-secret', $webhook->signing_secret);
        $this->assertTrue($webhook->enabled);
        Tenant::forgetCurrent();
    }

    public function test_assignee_must_belong_to_the_workspace(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_webhook_assignee');
        $outsider = User::factory()->tenant()->create();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/settings/developer'))
            ->put(Domain::portal('/settings/lead-webhook'), [
                'enabled' => true,
                'default_assignee_id' => $outsider->id,
            ])->assertRedirect()
            ->assertSessionHasErrors('default_assignee_id');
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

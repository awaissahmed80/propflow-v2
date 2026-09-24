<?php

namespace Tests\Feature\Portal;

use App\Models\Contact;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class LeadScoreTest extends TestCase
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

    public function test_creating_a_lead_persists_a_score(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_score_store');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/leads'), [
            'contact' => [
                'first_name' => 'Score',
                'last_name' => 'Lead',
                'phone_number' => '03001112233',
            ],
            'lead_stage_id' => $stage->id,
            'tag' => Lead::TAG_HOT,
            'budget' => 2_500_000,
        ])->assertRedirect(Domain::portal('/leads'));

        $tenant->makeCurrent();
        $lead = Lead::query()->first();
        $this->assertNotNull($lead);
        $this->assertNotNull($lead->score);
        $this->assertGreaterThanOrEqual(0, (int) $lead->score);
        $this->assertLessThanOrEqual(100, (int) $lead->score);
        Tenant::forgetCurrent();
    }

    public function test_stage_change_recomputes_score(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_score_stage');

        $tenant->makeCurrent();
        $new = LeadStage::factory()->newLead()->create();
        $negotiation = LeadStage::factory()->create([
            'label' => 'negotiation',
            'title' => 'Negotiation',
            'priority' => 5,
        ]);
        $lead = Lead::factory()->create([
            'lead_stage_id' => $new->id,
            'tag' => Lead::TAG_HOT,
            'budget' => 3_000_000,
            'user_id' => $user->id,
            'score' => 20,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/leads'))
            ->patch(Domain::portal('/leads/'.$lead->code), [
                'lead_stage_id' => $negotiation->id,
            ])
            ->assertRedirect(Domain::portal('/leads'));

        $tenant->makeCurrent();
        $lead->refresh();
        $this->assertNotSame(20, (int) $lead->score);
        $this->assertGreaterThan(20, (int) $lead->score);
        Tenant::forgetCurrent();
    }

    public function test_opened_lead_includes_score_engagement_and_contact_type_tag(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_score_payload');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $contact = Contact::factory()->create([
            'type' => Contact::TYPE_LEAD,
            'tag' => Contact::TAG_GENERAL,
        ]);
        $lead = Lead::factory()->create([
            'contact_id' => $contact->id,
            'lead_stage_id' => $stage->id,
            'tag' => Lead::TAG_MODERATE,
            'score' => 55,
            'contacted_at' => now(),
            'source' => 'Website',
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/leads?lead='.$lead->code))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('leads/index', false)
                ->where('openedLead.id', $lead->id)
                ->where('openedLead.score', 55)
                ->has('openedLead.engagement')
                ->where('openedLead.contact.type', $contact->type)
                ->where('openedLead.contact.tag', $contact->tag)
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

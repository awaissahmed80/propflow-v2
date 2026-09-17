<?php

namespace Tests\Feature\Portal;

use App\Models\Contact;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Project;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\Unit;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class LeadStoreTest extends TestCase
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

    public function test_lead_can_be_created_with_auto_code_and_contact(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_store');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        $stage = LeadStage::factory()->newLead()->create();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->post(Domain::portal('/leads'), [
            'contact' => [
                'first_name' => 'Sara',
                'last_name' => 'Ahmed',
                'phone_number' => '03001234567',
                'email_address' => 'sara@example.com',
                'reference' => 'Acme Corp',
            ],
            'project_id' => $project->id,
            'lead_stage_id' => $stage->id,
            'source' => 'Referral',
            'tag' => Lead::TAG_HOT,
            'budget' => 4500000,
            'notes' => 'Interested in 2 bed',
        ]);

        $response->assertRedirect(Domain::portal('/leads'));

        $tenant->makeCurrent();
        $lead = Lead::query()->with('contact')->first();
        $this->assertNotNull($lead);
        $this->assertNotEmpty($lead->code);
        $this->assertStringStartsWith('l', $lead->code);
        $this->assertSame($user->id, $lead->user_id);
        $this->assertSame($user->id, $lead->assigned_to);
        $this->assertSame('Referral', $lead->source);
        $this->assertSame(Lead::TAG_HOT, $lead->tag);
        $this->assertSame('Sara', $lead->contact->first_name);
        $this->assertSame('03001234567', $lead->contact->phone_number);
        $this->assertSame(1, Contact::query()->count());
        Tenant::forgetCurrent();
    }

    public function test_lead_reuses_existing_contact_matched_by_email(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_reuse_email');

        $tenant->makeCurrent();
        $existing = Contact::factory()->create([
            'first_name' => 'Existing',
            'last_name' => 'Contact',
            'email_address' => 'sonia@hollandtrix.io',
            'phone_number' => '03001110000',
            'type' => 'LEAD',
        ]);
        $stage = LeadStage::factory()->newLead()->create();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->post(Domain::portal('/leads'), [
            'contact' => [
                'first_name' => 'Sonia',
                'last_name' => 'Koll',
                'phone_number' => '+91 12354 16548',
                'email_address' => 'Sonia@Hollandtrix.io',
                'reference' => 'Holland Trix',
            ],
            'lead_stage_id' => $stage->id,
            'source' => 'Google',
            'tag' => Lead::TAG_MODERATE,
            'budget' => 16100,
        ]);

        $response->assertRedirect(Domain::portal('/leads'));
        $response->assertSessionHas('contact_reused', true);

        $tenant->makeCurrent();
        $this->assertSame(1, Contact::query()->count());
        $lead = Lead::query()->with('contact')->first();
        $this->assertNotNull($lead);
        $this->assertSame($existing->id, $lead->contact_id);
        $this->assertSame('Sonia', $lead->contact->first_name);
        $this->assertSame('Holland Trix', $lead->contact->reference);
        $this->assertSame('+91 12354 16548', $lead->contact->phone_number);
        Tenant::forgetCurrent();
    }

    public function test_lead_reuses_existing_contact_matched_by_normalized_phone(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_reuse_phone');

        $tenant->makeCurrent();
        $existing = Contact::factory()->create([
            'first_name' => 'Phone',
            'last_name' => 'Match',
            'email_address' => null,
            'phone_number' => '03001234567',
            'type' => 'LEAD',
        ]);
        $stage = LeadStage::factory()->newLead()->create();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->post(Domain::portal('/leads'), [
            'contact' => [
                'first_name' => 'Phone',
                'last_name' => 'Match',
                'phone_number' => '+92 300 1234567',
            ],
            'lead_stage_id' => $stage->id,
        ]);

        $response->assertRedirect(Domain::portal('/leads'));
        $response->assertSessionHas('contact_reused', true);

        $tenant->makeCurrent();
        $this->assertSame(1, Contact::query()->count());
        $lead = Lead::query()->first();
        $this->assertNotNull($lead);
        $this->assertSame($existing->id, $lead->contact_id);
        Tenant::forgetCurrent();
    }

    public function test_lead_requires_phone_or_email_when_creating_contact(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_store_contact');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->from(Domain::portal('/leads'))
            ->post(Domain::portal('/leads'), [
                'contact' => [
                    'first_name' => 'No',
                    'last_name' => 'Channel',
                ],
                'lead_stage_id' => $stage->id,
            ]);

        $response->assertRedirect(Domain::portal('/leads'));
        $response->assertSessionHasErrors(['contact.phone_number', 'contact.email_address']);

        $tenant->makeCurrent();
        $this->assertSame(0, Lead::query()->count());
        $this->assertSame(0, Contact::query()->count());
        Tenant::forgetCurrent();
    }

    public function test_lead_unit_must_belong_to_project(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_store_unit');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        $otherProject = Project::factory()->create();
        $unit = Unit::factory()->create(['project_id' => $otherProject->id]);
        $stage = LeadStage::factory()->newLead()->create();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->from(Domain::portal('/leads'))
            ->post(Domain::portal('/leads'), [
                'contact' => [
                    'first_name' => 'Mismatch',
                    'phone_number' => '03001112233',
                ],
                'project_id' => $project->id,
                'unit_id' => $unit->id,
                'lead_stage_id' => $stage->id,
            ]);

        $response->assertRedirect(Domain::portal('/leads'));
        $response->assertSessionHasErrors('unit_id');

        $tenant->makeCurrent();
        $this->assertSame(0, Lead::query()->count());
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

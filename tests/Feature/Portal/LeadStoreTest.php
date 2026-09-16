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

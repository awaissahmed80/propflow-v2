<?php

namespace Tests\Feature\Portal;

use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Project;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class LeadUpdateTest extends TestCase
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

    public function test_lead_can_be_updated(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_update');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        $stage = LeadStage::factory()->newLead()->create();
        $qualified = LeadStage::factory()->create([
            'label' => 'qualified',
            'title' => 'Qualified',
            'priority' => 3,
        ]);
        $lead = Lead::factory()->create([
            'project_id' => $project->id,
            'lead_stage_id' => $stage->id,
            'source' => 'Website',
            'tag' => Lead::TAG_MODERATE,
            'user_id' => $user->id,
        ]);
        $originalCode = $lead->code;
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->from(Domain::portal('/leads'))
            ->put(Domain::portal('/leads/'.$lead->id), [
                'contact' => [
                    'first_name' => 'Updated',
                    'last_name' => 'Name',
                    'phone_number' => '03009998877',
                    'email_address' => 'updated@example.com',
                ],
                'project_id' => $project->id,
                'lead_stage_id' => $qualified->id,
                'source' => 'Call',
                'tag' => Lead::TAG_VERY_HOT,
                'budget' => 8000000,
                'notes' => 'Ready to visit',
            ]);

        $response->assertRedirect(Domain::portal('/leads'));

        $tenant->makeCurrent();
        $lead->refresh()->load('contact');
        $this->assertSame($originalCode, $lead->code);
        $this->assertSame($qualified->id, $lead->lead_stage_id);
        $this->assertSame('Call', $lead->source);
        $this->assertSame(Lead::TAG_VERY_HOT, $lead->tag);
        $this->assertSame('Updated', $lead->contact->first_name);
        $this->assertSame('03009998877', $lead->contact->phone_number);
        Tenant::forgetCurrent();
    }

    public function test_lead_stage_and_heat_can_be_patched_inline(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_inline_patch');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $contacted = LeadStage::factory()->create([
            'label' => 'contacted',
            'title' => 'Contacted',
            'priority' => 2,
        ]);
        $lead = Lead::factory()->create([
            'lead_stage_id' => $stage->id,
            'tag' => Lead::TAG_MODERATE,
            'user_id' => $user->id,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->from(Domain::portal('/leads'))
            ->patch(Domain::portal('/leads/'.$lead->id), [
                'lead_stage_id' => $contacted->id,
                'tag' => Lead::TAG_HOT,
            ]);

        $response->assertRedirect(Domain::portal('/leads'));

        $tenant->makeCurrent();
        $lead->refresh();
        $this->assertSame($contacted->id, $lead->lead_stage_id);
        $this->assertSame(Lead::TAG_HOT, $lead->tag);
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

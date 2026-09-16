<?php

namespace Tests\Feature\Portal;

use App\Models\Contact;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Project;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class LeadIndexTest extends TestCase
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

    public function test_guest_cannot_view_leads_page(): void
    {
        $this->get(Domain::portal('/leads'))
            ->assertRedirect(Domain::auth());
    }

    public function test_authenticated_tenant_user_sees_leads_payload(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_leads_index');

        $tenant->makeCurrent();
        $project = Project::factory()->active()->create(['title' => 'Marina Residences']);
        $stage = LeadStage::factory()->newLead()->create();
        $lead = Lead::factory()->create([
            'project_id' => $project->id,
            'lead_stage_id' => $stage->id,
            'source' => 'Website',
            'tag' => Lead::TAG_HOT,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/leads'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('leads/index', false)
            ->has('leads', 1)
            ->where('leads.0.code', $lead->code)
            ->where('leads.0.source', 'Website')
            ->where('leads.0.project.title', 'Marina Residences')
            ->has('formOptions.projects')
            ->has('formOptions.stages')
            ->has('formOptions.tags')
        );
    }

    public function test_leads_can_be_filtered_by_project_code(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_leads_project_filter');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $marina = Project::factory()->create(['title' => 'Marina Residences']);
        $harbor = Project::factory()->create(['title' => 'Harbor Towers']);
        Lead::factory()->create([
            'project_id' => $marina->id,
            'lead_stage_id' => $stage->id,
            'contact_id' => Contact::factory()->create([
                'first_name' => 'Marina',
                'last_name' => 'Buyer',
            ])->id,
        ]);
        Lead::factory()->create([
            'project_id' => $harbor->id,
            'lead_stage_id' => $stage->id,
            'contact_id' => Contact::factory()->create([
                'first_name' => 'Harbor',
                'last_name' => 'Buyer',
            ])->id,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/leads?project='.$marina->code));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('leads/index', false)
            ->has('leads', 1)
            ->where('leads.0.contact.first_name', 'Marina')
            ->where('filters.project', $marina->code)
        );
    }

    public function test_leads_can_be_filtered_by_stage(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_leads_stage_filter');

        $tenant->makeCurrent();
        $newStage = LeadStage::factory()->newLead()->create();
        $wonStage = LeadStage::factory()->create([
            'label' => 'closed_won',
            'title' => 'Closed Won',
            'priority' => 6,
        ]);
        $project = Project::factory()->create();
        Lead::factory()->create([
            'project_id' => $project->id,
            'lead_stage_id' => $newStage->id,
        ]);
        Lead::factory()->create([
            'project_id' => $project->id,
            'lead_stage_id' => $wonStage->id,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/leads?stage=closed_won'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('leads/index', false)
            ->has('leads', 1)
            ->where('leads.0.stage.label', 'closed_won')
            ->where('filters.stage', 'closed_won')
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

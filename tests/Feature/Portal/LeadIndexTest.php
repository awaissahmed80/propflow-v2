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
            ->where('view', 'table')
            ->has('leads', 1)
            ->where('leads.0.code', $lead->code)
            ->where('leads.0.source', 'Website')
            ->where('leads.0.project.title', 'Marina Residences')
            ->has('board', 0)
            ->where('pagination.total', 1)
            ->has('formOptions.projects')
            ->has('formOptions.stages')
            ->has('formOptions.tags')
            ->where('openedLead', null)
        );
    }

    public function test_lead_query_includes_that_lead_for_the_detail_panel(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_leads_opened');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $lead = Lead::factory()->create([
            'user_id' => $user->id,
            'lead_stage_id' => $stage->id,
            'source' => 'Referral',
        ]);
        $contactName = $lead->contact->display_name;
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/leads?lead='.$lead->code))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('leads/index', false)
                ->where('openedLead.id', $lead->id)
                ->where('openedLead.source', 'Referral')
                ->where('openedLead.contact.display_name', $contactName)
            );
    }

    public function test_leads_are_paginated(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_leads_pagination');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        Lead::factory()->count(21)->create([
            'lead_stage_id' => $stage->id,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $firstPage = $this->get(Domain::portal('/leads?view=table'));
        $firstPage->assertOk();
        $firstPage->assertInertia(fn ($page) => $page
            ->component('leads/index', false)
            ->where('view', 'table')
            ->has('leads', 20)
            ->where('pagination.total', 21)
            ->where('pagination.current_page', 1)
            ->where('pagination.last_page', 2)
            ->where('pagination.from', 1)
            ->where('pagination.to', 20)
        );

        $secondPage = $this->get(Domain::portal('/leads?view=table&page=2'));
        $secondPage->assertOk();
        $secondPage->assertInertia(fn ($page) => $page
            ->component('leads/index', false)
            ->where('view', 'table')
            ->has('leads', 1)
            ->where('pagination.current_page', 2)
            ->where('pagination.from', 21)
            ->where('pagination.to', 21)
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
            ->where('filters.project.0', $marina->code)
            ->has('filters.project', 1)
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
        $qualifiedStage = LeadStage::factory()->create([
            'label' => 'qualified',
            'title' => 'Qualified',
            'priority' => 3,
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
        Lead::factory()->create([
            'project_id' => $project->id,
            'lead_stage_id' => $qualifiedStage->id,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/leads?stage=qualified,closed_won'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('leads/index', false)
            ->has('leads', 2)
            ->where('filters.stage.0', 'qualified')
            ->where('filters.stage.1', 'closed_won')
        );
    }

    public function test_leads_can_be_filtered_by_next_action(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_leads_next_action_filter');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $project = Project::factory()->create();
        Lead::factory()->create([
            'project_id' => $project->id,
            'lead_stage_id' => $stage->id,
            'next_action' => Lead::NEXT_ACTION_FOLLOW_UP,
        ]);
        Lead::factory()->create([
            'project_id' => $project->id,
            'lead_stage_id' => $stage->id,
            'next_action' => Lead::NEXT_ACTION_ARRANGE_MEETING,
        ]);
        Lead::factory()->create([
            'project_id' => $project->id,
            'lead_stage_id' => $stage->id,
            'next_action' => Lead::NEXT_ACTION_DO_NOTHING,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/leads?next_action=Follow-up,Arrange Meeting'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('leads/index', false)
            ->has('leads', 2)
            ->where('filters.next_action.0', 'Follow-up')
            ->where('filters.next_action.1', 'Arrange Meeting')
            ->has('formOptions.next_actions')
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

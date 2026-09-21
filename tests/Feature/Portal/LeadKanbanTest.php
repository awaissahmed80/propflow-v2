<?php

namespace Tests\Feature\Portal;

use App\Http\Controllers\Portal\LeadController;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class LeadKanbanTest extends TestCase
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

    public function test_leads_index_kanban_board_payload(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_leads_kanban_default');

        $tenant->makeCurrent();
        $newStage = LeadStage::factory()->newLead()->create([
            'title' => 'New',
            'priority' => 1,
            'color' => '#64748B',
        ]);
        $qualified = LeadStage::factory()->create([
            'label' => 'qualified',
            'title' => 'Qualified',
            'priority' => 3,
            'color' => '#F59E0B',
        ]);
        $newLead = Lead::factory()->create([
            'lead_stage_id' => $newStage->id,
            'budget' => 4200,
            'source' => 'Meta',
        ]);
        Lead::factory()->create([
            'lead_stage_id' => $qualified->id,
            'budget' => 18000,
            'source' => 'Google',
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/leads?view=kanban'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('leads/index', false)
            ->where('view', 'kanban')
            ->has('board', 2)
            ->where('board.0.stage.label', 'new')
            ->where('board.0.count', 1)
            ->where('board.0.budget_sum', 4200)
            ->where('board.0.has_more', false)
            ->where('board.0.leads.0.code', $newLead->code)
            ->where('board.1.stage.label', 'qualified')
            ->where('board.1.count', 1)
            ->where('board.1.budget_sum', 18000)
            ->has('leads', 2)
        );
    }

    public function test_kanban_columns_page_leads_and_expose_has_more(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_leads_kanban_page');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        Lead::factory()
            ->count(LeadController::KANBAN_COLUMN_PAGE_SIZE + 5)
            ->create([
                'lead_stage_id' => $stage->id,
            ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/leads?view=kanban'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('leads/index', false)
            ->where('view', 'kanban')
            ->where('board.0.count', LeadController::KANBAN_COLUMN_PAGE_SIZE + 5)
            ->has('board.0.leads', LeadController::KANBAN_COLUMN_PAGE_SIZE)
            ->where('board.0.has_more', true)
            ->where('pagination.total', LeadController::KANBAN_COLUMN_PAGE_SIZE + 5)
        );
    }

    public function test_kanban_board_column_endpoint_returns_next_page(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_leads_kanban_column');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $leads = Lead::factory()
            ->count(LeadController::KANBAN_COLUMN_PAGE_SIZE + 3)
            ->create([
                'lead_stage_id' => $stage->id,
            ]);
        $ordered = $leads->sortByDesc('id')->values();
        $cursor = $ordered->get(LeadController::KANBAN_COLUMN_PAGE_SIZE - 1)->code;
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->getJson(Domain::portal('/leads/board/'.$stage->label.'?cursor='.$cursor));

        $response->assertOk();
        $response->assertJsonPath('has_more', false);
        $response->assertJsonCount(3, 'leads');
        $this->assertSame(
            $ordered->slice(LeadController::KANBAN_COLUMN_PAGE_SIZE)->pluck('id')->values()->all(),
            collect($response->json('leads'))->pluck('id')->all(),
        );
    }

    public function test_kanban_stage_move_persists_and_returns_to_board(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_leads_kanban_move');

        $tenant->makeCurrent();
        $newStage = LeadStage::factory()->newLead()->create();
        $qualified = LeadStage::factory()->create([
            'label' => 'qualified',
            'title' => 'Qualified',
            'priority' => 3,
        ]);
        $lead = Lead::factory()->create([
            'lead_stage_id' => $newStage->id,
            'user_id' => $user->id,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->from(Domain::portal('/leads'))
            ->patch(Domain::portal('/leads/'.$lead->code), [
                'lead_stage_id' => $qualified->id,
            ]);

        $response->assertRedirect(Domain::portal('/leads'));

        $tenant->makeCurrent();
        $lead->refresh();
        $this->assertSame($qualified->id, $lead->lead_stage_id);
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

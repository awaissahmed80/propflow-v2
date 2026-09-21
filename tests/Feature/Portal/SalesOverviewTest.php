<?php

namespace Tests\Feature\Portal;

use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class SalesOverviewTest extends TestCase
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

    public function test_sales_overview_page_loads(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_sales_overview');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/sales'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('sales/overview', false)
                ->where('title', 'Sales Overview')
                ->where('period', 'month')
                ->where('periodLabel', 'This month')
                ->has('from')
                ->has('to')
                ->has('metrics')
                ->has('leadsByDay')
                ->has('channels')
                ->has('funnel')
                ->has('agents')
            );
    }

    public function test_sales_overview_includes_period_metrics_and_breakdowns(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_sales_overview_metrics');

        $tenant->makeCurrent();

        $newStage = LeadStage::factory()->newLead()->create();
        $wonStage = LeadStage::factory()->create([
            'label' => 'closed_won',
            'title' => 'Closed Won',
            'priority' => 6,
            'color' => '#059669',
            'is_system' => true,
            'is_enabled' => true,
        ]);

        Lead::factory()->count(3)->create([
            'lead_stage_id' => $newStage->id,
            'assigned_to' => $user->id,
            'source' => 'Meta',
            'budget' => 100_000,
            'created_at' => now()->subHours(6),
            'updated_at' => now()->subHours(6),
        ]);

        Lead::factory()->create([
            'lead_stage_id' => $wonStage->id,
            'assigned_to' => $user->id,
            'source' => 'Google',
            'budget' => 250_000,
            'created_at' => now()->startOfWeek()->addHours(2),
            'updated_at' => now()->subHours(2),
        ]);

        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/sales?period=week'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('sales/overview', false)
                ->where('period', 'week')
                ->where('periodLabel', 'This week')
                ->where('metrics.total_leads', 4)
                ->where('metrics.conversion_rate', 25)
                ->has('channels', 2)
                ->has('agents', 1)
                ->where('agents.0.leads', 4)
                ->where('agents.0.won', 1)
            );
    }

    public function test_sales_overview_accepts_custom_date_range(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_sales_overview_custom');

        $tenant->makeCurrent();

        $stage = LeadStage::factory()->newLead()->create();

        Lead::factory()->create([
            'lead_stage_id' => $stage->id,
            'source' => 'Meta',
            'created_at' => now()->subDays(3)->setTime(10, 0),
            'updated_at' => now()->subDays(3)->setTime(10, 0),
        ]);

        Lead::factory()->create([
            'lead_stage_id' => $stage->id,
            'source' => 'Google',
            'created_at' => now()->subDays(20)->setTime(10, 0),
            'updated_at' => now()->subDays(20)->setTime(10, 0),
        ]);

        Tenant::forgetCurrent();

        $from = now()->subDays(5)->toDateString();
        $to = now()->toDateString();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/sales?period=custom&from='.$from.'&to='.$to))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('sales/overview', false)
                ->where('period', 'custom')
                ->where('from', $from)
                ->where('to', $to)
                ->where('metrics.total_leads', 1)
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

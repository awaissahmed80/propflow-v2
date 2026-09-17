<?php

namespace Tests\Feature\Portal;

use App\Models\Contact;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Project;
use App\Models\Setting;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\Unit;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class DashboardTest extends TestCase
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

    public function test_guest_cannot_view_dashboard(): void
    {
        $this->get(Domain::portal())
            ->assertRedirect(Domain::auth());
    }

    public function test_authenticated_tenant_user_sees_dashboard_payload(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_dashboard_index');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create([
            'title' => 'New',
            'priority' => 1,
        ]);
        $project = Project::factory()->active()->create([
            'title' => 'Marina Residences',
            'progress' => 40,
        ]);
        $contact = Contact::factory()->create([
            'first_name' => 'Sara',
            'last_name' => 'Ahmed',
            'type' => Contact::TYPE_CLIENT,
        ]);
        Lead::factory()->hot()->create([
            'lead_stage_id' => $stage->id,
            'project_id' => $project->id,
            'contact_id' => $contact->id,
            'budget' => 2_500_000,
            'source' => 'Website',
            'due_date' => now()->addDay(),
            'next_action' => Lead::NEXT_ACTION_FOLLOW_UP,
        ]);
        Unit::factory()->create([
            'project_id' => $project->id,
            'status' => Unit::STATUS_AVAILABLE,
        ]);
        Unit::factory()->sold()->create([
            'project_id' => $project->id,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal());

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('dashboard/index', false)
            ->where('stats.leads_total', 1)
            ->where('stats.hot_leads', 1)
            ->where('stats.contacts_total', 1)
            ->where('stats.clients_total', 1)
            ->where('stats.pipeline_budget', 2500000)
            ->where('stats.available_units', 1)
            ->where('stats.units_total', 2)
            ->where('stats.active_projects', 1)
            ->where('stats.due_soon', 1)
            ->has('pipeline', 1)
            ->where('pipeline.0.title', 'New')
            ->where('pipeline.0.count', 1)
            ->has('heat')
            ->has('inventory')
            ->has('leadSources', 1)
            ->where('leadSources.0.source', 'Website')
            ->has('projects', 1)
            ->where('projects.0.title', 'Marina Residences')
            ->has('dueSoon', 1)
            ->has('recentLeads', 1)
            ->where('recentLeads.0.contact.display_name', 'Sara Ahmed')
            ->where('currency.code', 'USD')
            ->where('currency.symbol', '$')
        );

        $this->get(Domain::portal('/dashboard'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('dashboard/index', false));
    }

    public function test_dashboard_shares_configured_currency(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_dashboard_currency');

        $tenant->makeCurrent();
        Setting::putGroup(Setting::GROUP_CONFIGURATION, 'Configuration', [
            'currency_code' => 'PKR',
            'currency_symbol' => 'Rs',
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal())
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('dashboard/index', false)
                ->where('currency.code', 'PKR')
                ->where('currency.symbol', 'Rs')
            );
    }

    public function test_dashboard_counts_overdue_and_heat_distribution(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_dashboard_overdue');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        Lead::factory()->create([
            'lead_stage_id' => $stage->id,
            'tag' => Lead::TAG_COLD,
            'due_date' => now()->subDay(),
            'next_action' => Lead::NEXT_ACTION_FOLLOW_UP,
        ]);
        Lead::factory()->create([
            'lead_stage_id' => $stage->id,
            'tag' => Lead::TAG_MODERATE,
            'due_date' => null,
            'next_action' => Lead::NEXT_ACTION_DO_NOTHING,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal());

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('dashboard/index', false)
            ->where('stats.overdue', 1)
            ->where('stats.due_soon', 0)
            ->where('stats.leads_total', 2)
            ->has('dueSoon', 1)
            ->has('heat', 5)
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

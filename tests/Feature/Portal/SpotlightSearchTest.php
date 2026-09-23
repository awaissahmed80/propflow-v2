<?php

namespace Tests\Feature\Portal;

use App\Models\Contact;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Order;
use App\Models\Project;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class SpotlightSearchTest extends TestCase
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

    public function test_guest_cannot_search(): void
    {
        $this->getJson(Domain::portal('/search?q=mali'))
            ->assertUnauthorized();
    }

    public function test_short_query_returns_empty_results(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_spotlight_short');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->getJson(Domain::portal('/search?q=a'))
            ->assertOk()
            ->assertJson([
                'query' => 'a',
                'results' => [],
            ]);
    }

    public function test_search_finds_leads_contacts_and_bookings(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_spotlight_match');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $project = Project::factory()->create(['title' => 'Marina Residences']);
        $contact = Contact::factory()->create([
            'first_name' => 'Mali',
            'last_name' => 'Ibrar',
            'phone_number' => '03001234567',
        ]);
        $lead = Lead::factory()->create([
            'contact_id' => $contact->id,
            'project_id' => $project->id,
            'lead_stage_id' => $stage->id,
        ]);
        $order = Order::factory()->create([
            'contact_id' => $contact->id,
            'project_id' => $project->id,
            'lead_id' => $lead->id,
        ]);
        Contact::factory()->create([
            'first_name' => 'Sara',
            'last_name' => 'Khan',
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->getJson(Domain::portal('/search?q=Mali'));

        $response->assertOk()
            ->assertJsonPath('query', 'Mali');

        $types = collect($response->json('results'))->pluck('type')->all();

        $this->assertContains('Leads', $types);
        $this->assertContains('Contacts', $types);
        $this->assertContains('Bookings', $types);

        $leads = collect($response->json('results'))->firstWhere('type', 'Leads');
        $this->assertSame('/leads?lead='.$lead->code, $leads['items'][0]['url']);

        $bookings = collect($response->json('results'))->firstWhere('type', 'Bookings');
        $this->assertSame('/bookings?booking='.$order->code, $bookings['items'][0]['url']);
    }

    public function test_search_finds_projects_by_title(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_spotlight_projects');

        $tenant->makeCurrent();
        $project = Project::factory()->create(['title' => 'Skyline Towers']);
        Project::factory()->create(['title' => 'Garden Villas']);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->getJson(Domain::portal('/search?q=Skyline'));

        $response->assertOk();

        $projects = collect($response->json('results'))->firstWhere('type', 'Projects');

        $this->assertNotNull($projects);
        $this->assertCount(1, $projects['items']);
        $this->assertSame('/projects/'.$project->code, $projects['items'][0]['url']);
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

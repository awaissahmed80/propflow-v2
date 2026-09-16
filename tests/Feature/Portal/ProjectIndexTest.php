<?php

namespace Tests\Feature\Portal;

use App\Models\Project;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class ProjectIndexTest extends TestCase
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

    public function test_guest_cannot_view_projects_page(): void
    {
        $this->get(Domain::portal('/projects'))
            ->assertRedirect(Domain::auth());
    }

    public function test_authenticated_tenant_user_sees_projects_payload(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_projects_index');

        $tenant->makeCurrent();
        $project = Project::factory()->active()->create([
            'title' => 'Marina Residences',
            'city' => 'Karachi',
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/projects'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('projects/index', false)
            ->has('projects', 1)
            ->where('projects.0.title', 'Marina Residences')
            ->where('projects.0.code', $project->code)
            ->where('projects.0.city', 'Karachi')
            ->where('projects.0.status', 'active')
            ->where('filters.q', '')
        );

        Tenant::forgetCurrent();
    }

    public function test_projects_can_be_filtered_by_query(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_projects_filter');

        $tenant->makeCurrent();
        Project::factory()->create(['title' => 'Marina Residences', 'city' => 'Karachi']);
        Project::factory()->create(['title' => 'Downtown Towers', 'city' => 'Lahore']);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/projects?q=Marina'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('projects/index', false)
            ->has('projects', 1)
            ->where('projects.0.title', 'Marina Residences')
            ->where('filters.q', 'Marina')
        );

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

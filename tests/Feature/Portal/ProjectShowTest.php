<?php

namespace Tests\Feature\Portal;

use App\Models\Project;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\Unit;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class ProjectShowTest extends TestCase
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

    public function test_guest_cannot_view_project_details(): void
    {
        $this->get(Domain::portal('/projects/missing-code'))
            ->assertRedirect(Domain::auth());
    }

    public function test_authenticated_tenant_user_sees_project_details(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_projects_show');

        $tenant->makeCurrent();
        $project = Project::factory()->active()->create([
            'title' => 'Marina Residences',
            'city' => 'Karachi',
            'progress' => 35,
        ]);
        $unit = Unit::factory()->create([
            'project_id' => $project->id,
            'name' => 'Corner Suite',
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/projects/'.$project->code));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('projects/details', false)
            ->where('project.id', $project->id)
            ->where('project.code', $project->code)
            ->where('project.title', 'Marina Residences')
            ->where('project.city', 'Karachi')
            ->where('project.status', 'active')
            ->where('project.progress', 35)
            ->has('project.stats')
            ->where('project.stats.available_count', 1)
            ->has('project.gallery')
            ->has('project.documents')
            ->has('project.phases')
            ->has('project.features')
            ->has('project.inventory.units', 1)
            ->where('project.inventory.units.0.id', $unit->id)
            ->where('project.inventory.units.0.name', 'Corner Suite')
            ->has('meta.CITY')
            ->has('meta.COUNTRY')
            ->has('meta.PROJECT')
            ->has('meta.UNIT')
            ->has('meta.AREA')
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

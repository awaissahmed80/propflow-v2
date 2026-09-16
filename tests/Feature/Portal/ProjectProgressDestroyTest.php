<?php

namespace Tests\Feature\Portal;

use App\Models\Project;
use App\Models\ProjectProgress;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class ProjectProgressDestroyTest extends TestCase
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

    public function test_authenticated_tenant_user_can_delete_milestone(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_progress_destroy');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        $milestone = ProjectProgress::factory()->forProject($project)->create([
            'title' => 'Temporary phase',
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->delete(Domain::portal('/projects/'.$project->code.'/progress/'.$milestone->id))
            ->assertRedirect(Domain::portal('/projects/'.$project->code));

        $tenant->makeCurrent();
        $this->assertSoftDeleted('project_progress', [
            'id' => $milestone->id,
        ], 'tenant');
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

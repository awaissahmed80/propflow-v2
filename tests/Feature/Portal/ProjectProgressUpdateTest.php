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

class ProjectProgressUpdateTest extends TestCase
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

    public function test_authenticated_tenant_user_can_update_milestone(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_progress_update');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        $milestone = ProjectProgress::factory()->forProject($project)->create([
            'title' => 'Structure',
            'status' => 'planned',
            'progress' => 10,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->patch(Domain::portal('/projects/'.$project->code.'/progress/'.$milestone->id), [
            'title' => 'Structure topping out',
            'status' => 'in_progress',
            'progress' => 55,
        ])->assertRedirect(Domain::portal('/projects/'.$project->code));

        $tenant->makeCurrent();
        $milestone->refresh();

        $this->assertSame('Structure topping out', $milestone->title);
        $this->assertSame('in_progress', $milestone->status);
        $this->assertSame(55, $milestone->progress);
        Tenant::forgetCurrent();
    }

    public function test_cannot_update_milestone_for_another_project(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_progress_update_scope');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        $other = Project::factory()->create();
        $milestone = ProjectProgress::factory()->forProject($other)->create([
            'title' => 'Other milestone',
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->patch(Domain::portal('/projects/'.$project->code.'/progress/'.$milestone->id), [
            'title' => 'Hijacked',
        ])->assertNotFound();

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

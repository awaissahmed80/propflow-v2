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

class ProjectProgressStoreTest extends TestCase
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

    public function test_guest_cannot_store_project_progress(): void
    {
        $this->post(Domain::portal('/projects/p10001/progress'), [
            'title' => 'Foundation',
        ])->assertRedirect(Domain::auth());
    }

    public function test_authenticated_tenant_user_can_add_milestone(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_progress_store');

        $tenant->makeCurrent();
        $project = Project::factory()->create(['title' => 'Timeline Project']);
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/projects/'.$project->code.'/progress'), [
            'title' => 'Foundation complete',
            'description' => 'Slab poured',
            'status' => 'completed',
            'progress' => 100,
            'start_date' => '2026-01-01',
            'end_date' => '2026-02-15',
        ])->assertRedirect(Domain::portal('/projects/'.$project->code));

        $tenant->makeCurrent();
        $milestone = ProjectProgress::query()
            ->where('project_id', $project->id)
            ->where('title', 'Foundation complete')
            ->first();

        $this->assertNotNull($milestone);
        $this->assertSame('completed', $milestone->status);
        $this->assertSame(100, $milestone->progress);
        $this->assertSame(1, $milestone->order);
        $this->assertSame('2026-01-01', $milestone->start_date?->toDateString());
        $this->assertSame('2026-02-15', $milestone->end_date?->toDateString());
        Tenant::forgetCurrent();
    }

    public function test_title_is_required(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_progress_store_validation');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/projects/'.$project->code.'/progress'), [
            'title' => '',
        ])->assertSessionHasErrors('title');

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

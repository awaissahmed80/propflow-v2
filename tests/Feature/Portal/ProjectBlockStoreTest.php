<?php

namespace Tests\Feature\Portal;

use App\Models\Project;
use App\Models\ProjectBlock;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class ProjectBlockStoreTest extends TestCase
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

    public function test_project_block_can_be_created(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_block_store');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->postJson(Domain::portal('/project-blocks'), [
            'project_id' => $project->id,
            'title' => 'Tower A',
            'description' => 'North wing',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.title', 'Tower A')
            ->assertJsonPath('data.project_id', $project->id);

        $this->assertDatabaseHas('project_blocks', [
            'project_id' => $project->id,
            'title' => 'Tower A',
        ], 'tenant');
    }

    public function test_project_block_requires_title(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_block_validation');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->postJson(Domain::portal('/project-blocks'), [
            'project_id' => $project->id,
            'title' => '',
        ]);

        $response->assertJsonValidationErrors(['title']);

        $tenant->makeCurrent();
        $this->assertSame(0, ProjectBlock::query()->count());
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

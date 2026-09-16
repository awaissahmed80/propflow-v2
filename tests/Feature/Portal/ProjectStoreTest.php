<?php

namespace Tests\Feature\Portal;

use App\Models\MetaData;
use App\Models\Project;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class ProjectStoreTest extends TestCase
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

    public function test_guest_cannot_store_project(): void
    {
        $this->post(Domain::portal('/projects'), [
            'title' => 'Marina Residences',
        ])->assertRedirect(Domain::auth());
    }

    public function test_authenticated_tenant_user_can_create_project(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_projects_store');

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->post(Domain::portal('/projects'), [
            'title' => 'Marina Residences',
            'type' => 'residential',
            'status' => 'active',
        ]);

        $tenant->makeCurrent();
        $project = Project::query()->where('title', 'Marina Residences')->first();
        Tenant::forgetCurrent();

        $this->assertNotNull($project);
        $response->assertRedirect(Domain::portal('/projects/'.$project->code));

        $tenant->makeCurrent();
        $this->assertSame('residential', $project->type);
        $this->assertSame('active', $project->status);
        $this->assertSame(0, $project->progress);
        $this->assertNull($project->city);
        $this->assertNotEmpty($project->code);
        $this->assertDatabaseHas('meta_data', [
            'type' => MetaData::TYPE_PROJECT,
            'value' => 'residential',
        ], 'tenant');
        Tenant::forgetCurrent();
    }

    public function test_storing_existing_project_type_does_not_duplicate_meta(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_projects_store_meta_skip');

        $tenant->makeCurrent();
        MetaData::query()->create([
            'type' => MetaData::TYPE_PROJECT,
            'value' => 'Residential',
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/projects'), [
            'title' => 'Another Residences',
            'type' => 'residential',
            'status' => 'draft',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $this->assertSame(
            1,
            MetaData::query()
                ->ofType(MetaData::TYPE_PROJECT)
                ->whereRaw('LOWER(value) = ?', ['residential'])
                ->count()
        );
        Tenant::forgetCurrent();
    }

    public function test_title_is_required(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_projects_store_validation');

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/projects'), [
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

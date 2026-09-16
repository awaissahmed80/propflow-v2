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

class ProjectUpdateTest extends TestCase
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

    public function test_authenticated_tenant_user_can_update_project(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_projects_update');

        $tenant->makeCurrent();
        $project = Project::factory()->create([
            'title' => 'Marina Residences',
            'status' => 'draft',
            'progress' => 10,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/projects/'.$project->code), [
            'title' => 'Marina Heights',
            'description' => 'Updated overview',
            'type' => 'mixed',
            'country' => 'Pakistan',
            'city' => 'Karachi',
            'status' => 'active',
            'progress' => 40,
        ])->assertRedirect(Domain::portal('/projects/'.$project->code));

        $tenant->makeCurrent();
        $project->refresh();

        $this->assertSame('Marina Heights', $project->title);
        $this->assertSame('Updated overview', $project->description);
        $this->assertSame('mixed', $project->type);
        $this->assertSame('Pakistan', $project->country);
        $this->assertSame('active', $project->status);
        $this->assertSame(40, $project->progress);
        $this->assertDatabaseHas('meta_data', [
            'type' => MetaData::TYPE_PROJECT,
            'value' => 'mixed',
        ], 'tenant');
        $this->assertDatabaseHas('meta_data', [
            'type' => MetaData::TYPE_COUNTRY,
            'value' => 'Pakistan',
        ], 'tenant');
        $this->assertDatabaseHas('meta_data', [
            'type' => MetaData::TYPE_CITY,
            'value' => 'Karachi',
        ], 'tenant');

        Tenant::forgetCurrent();
    }

    public function test_authenticated_tenant_user_can_update_project_total_area(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_projects_update_area');

        $tenant->makeCurrent();
        $project = Project::factory()->create([
            'title' => 'Area Project',
            'status' => 'draft',
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/projects/'.$project->code), [
            'title' => 'Area Project',
            'status' => 'draft',
            'total_area' => 1250.5,
            'area_unit' => 'Sq. Feet',
            'progress' => 0,
        ])->assertRedirect(Domain::portal('/projects/'.$project->code));

        $tenant->makeCurrent();
        $project->refresh();

        $this->assertSame(1250.5, (float) data_get($project->details, 'total_area'));
        $this->assertSame('Sq. Feet', data_get($project->details, 'area_unit'));

        Tenant::forgetCurrent();
    }

    public function test_authenticated_tenant_user_can_patch_progress_without_wiping_other_fields(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_projects_patch_progress');

        $tenant->makeCurrent();
        $project = Project::factory()->create([
            'title' => 'Progress Project',
            'description' => 'Keep me',
            'status' => 'active',
            'progress' => 10,
            'pin_location' => 'https://maps.google.com/?q=1,1',
            'details' => (object) [
                'area_unit' => 'Sq. Feet',
                'total_area' => 1000,
            ],
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->patch(Domain::portal('/projects/'.$project->code), [
            'progress' => 55,
        ])->assertRedirect(Domain::portal('/projects/'.$project->code));

        $tenant->makeCurrent();
        $project->refresh();

        $this->assertSame('Progress Project', $project->title);
        $this->assertSame('Keep me', $project->description);
        $this->assertSame('active', $project->status);
        $this->assertSame(55, $project->progress);
        $this->assertSame('https://maps.google.com/?q=1,1', $project->pin_location);
        $this->assertSame('Sq. Feet', data_get($project->details, 'area_unit'));
        $this->assertSame(1000.0, (float) data_get($project->details, 'total_area'));

        Tenant::forgetCurrent();
    }

    public function test_authenticated_tenant_user_can_patch_map_embed_only(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_projects_patch_map');

        $tenant->makeCurrent();
        $project = Project::factory()->create([
            'title' => 'Map Project',
            'progress' => 20,
            'pin_location' => null,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $embed = '<iframe src="https://www.openstreetmap.org/export/embed.html?bbox=0,0,1,1"></iframe>';

        $this->patch(Domain::portal('/projects/'.$project->code), [
            'pin_location' => $embed,
        ])->assertRedirect(Domain::portal('/projects/'.$project->code));

        $tenant->makeCurrent();
        $project->refresh();

        $this->assertSame('Map Project', $project->title);
        $this->assertSame(20, $project->progress);
        $this->assertSame($embed, $project->pin_location);

        Tenant::forgetCurrent();
    }

    public function test_authenticated_tenant_user_can_patch_features(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_projects_patch_features');

        $tenant->makeCurrent();
        $project = Project::factory()->create([
            'title' => 'Features Project',
            'features' => ['Parking'],
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->patch(Domain::portal('/projects/'.$project->code), [
            'features' => ['Parking', 'Swimming pool', 'Gym'],
        ])->assertRedirect(Domain::portal('/projects/'.$project->code));

        $tenant->makeCurrent();
        $project->refresh();

        $this->assertSame(['Parking', 'Swimming pool', 'Gym'], $project->features);
        Tenant::forgetCurrent();
    }

    public function test_authenticated_tenant_user_can_clear_features(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_projects_clear_features');

        $tenant->makeCurrent();
        $project = Project::factory()->create([
            'features' => ['Clubhouse'],
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->patch(Domain::portal('/projects/'.$project->code), [
            'features' => [],
        ])->assertRedirect(Domain::portal('/projects/'.$project->code));

        $tenant->makeCurrent();
        $project->refresh();

        $this->assertNull($project->features);
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

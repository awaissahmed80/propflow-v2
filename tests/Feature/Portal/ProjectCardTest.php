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

class ProjectCardTest extends TestCase
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

    public function test_guest_cannot_fetch_project_card(): void
    {
        $this->getJson(Domain::portal('/projects/missing/card'))
            ->assertUnauthorized();
    }

    public function test_authenticated_tenant_user_can_fetch_project_card(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_project_card');

        $tenant->makeCurrent();
        $project = Project::factory()->active()->create([
            'title' => 'Marina Residences',
            'city' => 'Karachi',
            'progress' => 40,
        ]);
        Unit::factory()->count(2)->create(['project_id' => $project->id]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->getJson(Domain::portal('/projects/'.$project->code.'/card'))
            ->assertOk()
            ->assertJsonPath('data.id', $project->id)
            ->assertJsonPath('data.code', $project->code)
            ->assertJsonPath('data.title', 'Marina Residences')
            ->assertJsonPath('data.status', $project->status ?: 'draft')
            ->assertJsonPath('data.city', 'Karachi')
            ->assertJsonPath('data.progress', 40)
            ->assertJsonPath('data.units_count', 2)
            ->assertJsonStructure([
                'data' => [
                    'id',
                    'title',
                    'code',
                    'thumbnail',
                    'status',
                    'type',
                    'city',
                    'location',
                    'country',
                    'progress',
                    'units_count',
                    'blocks_count',
                ],
            ]);
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

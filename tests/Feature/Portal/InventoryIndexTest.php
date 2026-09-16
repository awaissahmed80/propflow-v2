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

class InventoryIndexTest extends TestCase
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

    public function test_guest_cannot_view_inventory_page(): void
    {
        $this->get(Domain::portal('/inventory'))
            ->assertRedirect(Domain::auth());
    }

    public function test_authenticated_tenant_user_sees_inventory_payload(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_inventory_index');

        $tenant->makeCurrent();
        $project = Project::factory()->active()->create(['title' => 'Marina Residences']);
        $unit = Unit::factory()->create([
            'project_id' => $project->id,
            'name' => '1201',
            'type' => 'Apartment',
            'status' => Unit::STATUS_AVAILABLE,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/inventory'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('inventory/index', false)
            ->has('units', 1)
            ->where('units.0.name', '1201')
            ->where('units.0.code', $unit->code)
            ->where('units.0.project.title', 'Marina Residences')
            ->has('formOptions.projects')
            ->has('formOptions.statuses')
        );
    }

    public function test_inventory_can_be_filtered_by_status(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_inventory_filter');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        Unit::factory()->create([
            'project_id' => $project->id,
            'name' => 'Open Unit',
            'status' => Unit::STATUS_AVAILABLE,
        ]);
        Unit::factory()->sold()->create([
            'project_id' => $project->id,
            'name' => 'Sold Unit',
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/inventory?status=SOLD'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('inventory/index', false)
            ->has('units', 1)
            ->where('units.0.name', 'Sold Unit')
            ->where('filters.status', 'SOLD')
        );
    }

    public function test_inventory_can_be_filtered_by_project_code(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_inventory_project_filter');

        $tenant->makeCurrent();
        $marina = Project::factory()->create(['title' => 'Marina Residences']);
        $harbor = Project::factory()->create(['title' => 'Harbor Towers']);
        Unit::factory()->create([
            'project_id' => $marina->id,
            'name' => 'Marina Unit',
        ]);
        Unit::factory()->create([
            'project_id' => $harbor->id,
            'name' => 'Harbor Unit',
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/inventory?project='.$marina->code));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('inventory/index', false)
            ->has('units', 1)
            ->where('units.0.name', 'Marina Unit')
            ->where('filters.project', $marina->code)
        );
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

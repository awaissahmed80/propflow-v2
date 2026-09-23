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
            ->where('pagination.total', 1)
            ->where('pagination.per_page', 20)
            ->has('formOptions.projects')
            ->where('formOptions.projects.0.id', $project->id)
            ->where('formOptions.projects.0.title', 'Marina Residences')
            ->where('formOptions.projects.0.code', $project->code)
            ->has('formOptions.statuses')
        );
    }

    public function test_inventory_is_paginated(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_inventory_pagination');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        Unit::factory()->count(21)->create([
            'project_id' => $project->id,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $firstPage = $this->get(Domain::portal('/inventory'));
        $firstPage->assertOk();
        $firstPage->assertInertia(fn ($page) => $page
            ->component('inventory/index', false)
            ->has('units', 20)
            ->where('pagination.total', 21)
            ->where('pagination.current_page', 1)
            ->where('pagination.last_page', 2)
            ->where('pagination.from', 1)
            ->where('pagination.to', 20)
        );

        $secondPage = $this->get(Domain::portal('/inventory?page=2'));
        $secondPage->assertOk();
        $secondPage->assertInertia(fn ($page) => $page
            ->component('inventory/index', false)
            ->has('units', 1)
            ->where('pagination.current_page', 2)
            ->where('pagination.from', 21)
            ->where('pagination.to', 21)
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
            ->where('filters.status.0', 'SOLD')
            ->has('filters.status', 1)
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
            ->where('filters.project.0', $marina->code)
            ->has('filters.project', 1)
        );
    }

    public function test_inventory_can_be_filtered_by_price_range(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_inventory_price_filter');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        Unit::factory()->create([
            'project_id' => $project->id,
            'name' => 'Budget Unit',
            'price' => 500000,
        ]);
        Unit::factory()->create([
            'project_id' => $project->id,
            'name' => 'Premium Unit',
            'price' => 5000000,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/inventory?price_min=1000000&price_max=5000000'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('inventory/index', false)
            ->has('units', 1)
            ->where('units.0.name', 'Premium Unit')
            ->where('filters.price.0', 1000000)
            ->where('filters.price.1', 5000000)
            ->has('formOptions.price')
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

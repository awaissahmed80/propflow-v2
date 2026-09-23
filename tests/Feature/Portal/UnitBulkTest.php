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

class UnitBulkTest extends TestCase
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

    public function test_bulk_can_update_unit_status(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_unit_bulk_status');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        $units = Unit::factory()->count(3)->create([
            'project_id' => $project->id,
            'status' => Unit::STATUS_AVAILABLE,
        ]);
        $ids = $units->pluck('id')->all();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/inventory'))
            ->post(Domain::portal('/units/bulk'), [
                'ids' => $ids,
                'action' => 'status',
                'status' => Unit::STATUS_HOLD,
            ])
            ->assertRedirect(Domain::portal('/inventory'));

        $tenant->makeCurrent();
        foreach ($ids as $id) {
            $this->assertSame(Unit::STATUS_HOLD, Unit::query()->find($id)?->status);
        }
        Tenant::forgetCurrent();
    }

    public function test_bulk_can_destroy_units(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_unit_bulk_destroy');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        $units = Unit::factory()->count(2)->create(['project_id' => $project->id]);
        $ids = $units->pluck('id')->all();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/inventory'))
            ->post(Domain::portal('/units/bulk'), [
                'ids' => $ids,
                'action' => 'destroy',
            ])
            ->assertRedirect(Domain::portal('/inventory'));

        $tenant->makeCurrent();
        foreach ($ids as $id) {
            $this->assertDatabaseMissing('units', ['id' => $id], 'tenant');
        }
        Tenant::forgetCurrent();
    }

    public function test_bulk_status_requires_valid_status(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_unit_bulk_invalid');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        $unit = Unit::factory()->create(['project_id' => $project->id]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/inventory'))
            ->post(Domain::portal('/units/bulk'), [
                'ids' => [$unit->id],
                'action' => 'status',
                'status' => 'NOT_A_STATUS',
            ])
            ->assertSessionHasErrors('status');
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

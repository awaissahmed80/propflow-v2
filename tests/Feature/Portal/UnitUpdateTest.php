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

class UnitUpdateTest extends TestCase
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

    public function test_unit_can_be_updated(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_unit_update');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        $unit = Unit::factory()->create([
            'project_id' => $project->id,
            'name' => 'Old Name',
            'status' => Unit::STATUS_AVAILABLE,
        ]);
        $unitId = $unit->id;
        $code = $unit->code;
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->put(Domain::portal('/units/'.$code), [
            'project_id' => $project->id,
            'name' => 'New Name',
            'status' => Unit::STATUS_RESERVED,
            'price' => 999000,
        ]);

        $response->assertRedirect(Domain::portal('/inventory'));

        $tenant->makeCurrent();
        $unit->refresh();
        $this->assertSame('New Name', $unit->name);
        $this->assertSame(Unit::STATUS_RESERVED, $unit->status);
        $this->assertSame($code, $unit->code);
        $this->assertEquals(999000.0, (float) $unit->price);
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

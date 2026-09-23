<?php

namespace Tests\Feature\Portal;

use App\Models\Project;
use App\Models\ProjectBlock;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\Unit;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class UnitStoreTest extends TestCase
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

    public function test_unit_can_be_created_with_auto_code(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_unit_store');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->post(Domain::portal('/units'), [
            'project_id' => $project->id,
            'name' => 'A-101',
            'type' => 'Apartment',
            'sector' => 'Floor 1',
            'price' => 2500000,
            'size' => 1250,
            'area_type' => 'Sq. Feet',
            'status' => Unit::STATUS_AVAILABLE,
        ]);

        $response->assertRedirect(Domain::portal('/inventory'));

        $tenant->makeCurrent();
        $unit = Unit::query()->first();
        $this->assertNotNull($unit);
        $this->assertSame('A-101', $unit->name);
        $this->assertSame('Apartment', $unit->type);
        $this->assertSame('Floor 1', $unit->sector);
        $this->assertEquals(1250.0, (float) $unit->size);
        $this->assertSame(1, (int) $unit->quantity);
        $this->assertNotEmpty($unit->code);
        $this->assertStringStartsWith('u', $unit->code);
        Tenant::forgetCurrent();
    }

    public function test_unit_can_be_created_with_custom_quantity(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_unit_store_quantity');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->post(Domain::portal('/units'), [
            'project_id' => $project->id,
            'name' => 'Plot Pack',
            'quantity' => 12,
            'status' => Unit::STATUS_AVAILABLE,
        ]);

        $response->assertRedirect(Domain::portal('/inventory'));

        $tenant->makeCurrent();
        $unit = Unit::query()->first();
        $this->assertNotNull($unit);
        $this->assertSame(12, (int) $unit->quantity);
        $this->assertTrue($unit->isBookable());
        Tenant::forgetCurrent();
    }

    public function test_unit_size_accepts_decimals_and_rounds_to_two_places(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_unit_store_size_decimal');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->post(Domain::portal('/units'), [
            'project_id' => $project->id,
            'name' => 'B-202',
            'size' => 1250.456,
            'area_type' => 'Sq. Feet',
            'status' => Unit::STATUS_AVAILABLE,
        ]);

        $response->assertRedirect(Domain::portal('/inventory'));

        $tenant->makeCurrent();
        $unit = Unit::query()->first();
        $this->assertNotNull($unit);
        $this->assertEquals(1250.46, (float) $unit->size);
        Tenant::forgetCurrent();
    }

    public function test_unit_block_must_belong_to_project(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_unit_store_block');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        $otherProject = Project::factory()->create();
        $block = ProjectBlock::factory()->create(['project_id' => $otherProject->id]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->from(Domain::portal('/inventory'))
            ->post(Domain::portal('/units'), [
                'project_id' => $project->id,
                'project_block_id' => $block->id,
                'name' => 'Mismatch',
            ]);

        $response->assertRedirect(Domain::portal('/inventory'));
        $response->assertSessionHasErrors('project_block_id');

        $tenant->makeCurrent();
        $this->assertSame(0, Unit::query()->count());
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

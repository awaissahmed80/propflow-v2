<?php

namespace Tests\Feature\Portal;

use App\Models\MetaData;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class MetaDataStoreTest extends TestCase
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

    public function test_authenticated_tenant_user_can_create_meta_value(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_meta_store');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->postJson(Domain::portal('/meta-data'), [
            'type' => 'CITY',
            'value' => 'Islamabad',
        ])
            ->assertCreated()
            ->assertJsonPath('data.type', 'CITY')
            ->assertJsonPath('data.value', 'Islamabad');

        $tenant->makeCurrent();
        $this->assertDatabaseHas('meta_data', [
            'type' => 'CITY',
            'value' => 'Islamabad',
        ], 'tenant');
        Tenant::forgetCurrent();
    }

    public function test_creating_duplicate_meta_value_is_idempotent(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_meta_store_dup');

        $tenant->makeCurrent();
        MetaData::query()->create(['type' => 'AREA', 'value' => 'Sq. Feet']);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->postJson(Domain::portal('/meta-data'), [
            'type' => 'AREA',
            'value' => 'sq. feet',
        ])->assertCreated();

        $tenant->makeCurrent();
        $this->assertSame(1, MetaData::query()->ofType('AREA')->count());
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

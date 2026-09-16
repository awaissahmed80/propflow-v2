<?php

namespace Tests\Feature\Portal;

use App\Models\MetaData;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class MetaDataIndexTest extends TestCase
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

    public function test_authenticated_tenant_user_can_list_meta_values_by_type(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_meta_index');

        $tenant->makeCurrent();
        MetaData::query()->create(['type' => 'CITY', 'value' => 'Karachi']);
        MetaData::query()->create(['type' => 'CITY', 'value' => 'Lahore']);
        MetaData::query()->create(['type' => 'PROJECT', 'value' => 'Residential']);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->getJson(Domain::portal('/meta-data?type=CITY'))
            ->assertOk()
            ->assertJsonPath('type', 'CITY')
            ->assertJsonCount(2, 'data')
            ->assertJsonFragment(['Karachi'])
            ->assertJsonFragment(['Lahore']);

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

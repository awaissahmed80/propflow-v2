<?php

namespace Tests\Feature\Portal;

use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class UserDestroyTest extends TestCase
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

    public function test_authenticated_tenant_user_can_delete_non_owner_user(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_users_destroy');
        $member = User::factory()->tenant()->create();
        $membership = TenantUser::factory()->create([
            'user_id' => $member->id,
            'tenant_id' => $tenant->id,
            'is_owner' => false,
        ]);

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->delete(Domain::portal('/users/'.$membership->code))
            ->assertRedirect(Domain::portal('/users'));

        $this->assertSoftDeleted('tenant_users', ['id' => $membership->id], 'landlord');
        $this->assertSoftDeleted('users', ['id' => $member->id], 'landlord');

        Tenant::forgetCurrent();
    }

    public function test_owner_account_cannot_be_deleted(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_users_destroy_owner');
        $owner = User::factory()->tenant()->create();
        $ownerMembership = TenantUser::factory()->owner()->create([
            'user_id' => $owner->id,
            'tenant_id' => $tenant->id,
        ]);

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->delete(Domain::portal('/users/'.$ownerMembership->code))
            ->assertRedirect()
            ->assertSessionHasErrors('message');

        $this->assertDatabaseHas('users', ['id' => $owner->id, 'deleted_at' => null], 'landlord');

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

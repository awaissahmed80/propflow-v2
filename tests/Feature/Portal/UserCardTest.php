<?php

namespace Tests\Feature\Portal;

use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class UserCardTest extends TestCase
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

    public function test_guest_cannot_fetch_user_card(): void
    {
        $this->getJson(Domain::portal('/users/missing/card'))
            ->assertUnauthorized();
    }

    public function test_authenticated_tenant_user_can_fetch_user_card(): void
    {
        [$user, $tenant, $membership] = $this->createTenantUser('tenant_user_card');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->getJson(Domain::portal('/users/'.$membership->code.'/card'))
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.code', $membership->code)
            ->assertJsonPath('data.display_name', $user->display_name)
            ->assertJsonPath('data.email_address', $user->email_address)
            ->assertJsonPath('data.title', $membership->title)
            ->assertJsonPath('data.department', $membership->department)
            ->assertJsonPath('data.is_owner', true)
            ->assertJsonStructure([
                'data' => [
                    'id',
                    'code',
                    'display_name',
                    'first_name',
                    'last_name',
                    'email_address',
                    'phone_number',
                    'title',
                    'department',
                    'manager_id',
                    'is_owner',
                    'roles',
                    'avatar',
                ],
            ]);
    }

    public function test_user_card_is_scoped_to_current_tenant_membership(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_user_card_scope_a');

        $otherTenant = Tenant::factory()->create(['database' => 'tenant_user_card_scope_b']);
        $otherMembership = TenantUser::factory()->create([
            'user_id' => User::factory()->tenant()->create()->id,
            'tenant_id' => $otherTenant->id,
            'title' => 'Other Tenant Role',
        ]);

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->getJson(Domain::portal('/users/'.$otherMembership->code.'/card'))
            ->assertNotFound();
    }

    /**
     * @return array{0: User, 1: Tenant, 2: TenantUser}
     */
    protected function createTenantUser(string $database): array
    {
        $user = User::factory()->tenant()->create([
            'display_name' => 'Sara Khan',
            'first_name' => 'Sara',
            'last_name' => 'Khan',
            'email_address' => 'sara.khan@example.com',
        ]);
        $tenant = Tenant::factory()->create(['database' => $database]);

        $membership = TenantUser::factory()->owner()->create([
            'user_id' => $user->id,
            'tenant_id' => $tenant->id,
            'title' => 'Sales Lead',
            'department' => 'Sales',
        ]);

        return [$user, $tenant, $membership];
    }
}

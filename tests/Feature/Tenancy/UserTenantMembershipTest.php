<?php

namespace Tests\Feature\Tenancy;

use App\Enums\TenantMembershipStatus;
use App\Enums\UserType;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\PermissionConnection;
use Tests\TestCase;

class UserTenantMembershipTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->migrateLandlord();
    }

    public function test_user_can_belong_to_multiple_tenants(): void
    {
        $user = User::factory()->tenant()->create();
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();

        TenantUser::factory()->create([
            'user_id' => $user->id,
            'tenant_id' => $tenantA->id,
        ]);
        TenantUser::factory()->create([
            'user_id' => $user->id,
            'tenant_id' => $tenantB->id,
        ]);

        $this->assertCount(2, app(TenantContext::class)->activeMembershipsFor($user));
        $this->assertTrue($user->activeTenants()->where('tenants.id', $tenantA->id)->exists());
        $this->assertTrue($user->activeTenants()->where('tenants.id', $tenantB->id)->exists());
    }

    public function test_inactive_membership_is_excluded_from_active_tenants(): void
    {
        $user = User::factory()->tenant()->create();
        $tenant = Tenant::factory()->create();

        TenantUser::factory()->create([
            'user_id' => $user->id,
            'tenant_id' => $tenant->id,
            'status' => TenantMembershipStatus::Inactive,
        ]);

        $this->assertCount(0, app(TenantContext::class)->activeMembershipsFor($user));
    }

    public function test_platform_roles_live_on_landlord_connection(): void
    {
        $user = User::factory()->platform()->create();

        $this->assertSame('landlord', PermissionConnection::name());

        $role = Role::query()->create([
            'name' => 'super-admin',
            'guard_name' => 'web',
        ]);

        $user->assignRole($role);

        $this->assertTrue($user->hasRole('super-admin'));
        $this->assertSame('landlord', $role->getConnectionName());
    }

    public function test_tenant_roles_live_on_tenant_connection_and_are_isolated(): void
    {
        $this->migrateTenant();

        $user = User::factory()->tenant()->create();
        $tenantA = Tenant::factory()->create(['database' => 'tenant_a']);
        $tenantB = Tenant::factory()->create(['database' => 'tenant_b']);

        TenantUser::factory()->create(['user_id' => $user->id, 'tenant_id' => $tenantA->id]);
        TenantUser::factory()->create(['user_id' => $user->id, 'tenant_id' => $tenantB->id]);

        $tenantA->makeCurrent();

        $roleA = Role::query()->create([
            'name' => 'sales-agent',
            'guard_name' => 'web',
        ]);
        $user->assignRole($roleA);

        $this->assertSame('tenant', PermissionConnection::name());
        $this->assertTrue($user->hasRole('sales-agent'));

        Tenant::forgetCurrent();
        $user->unsetRelation('roles')->unsetRelation('permissions');

        // Without a current tenant, permission queries hit landlord — role should not exist there.
        $this->assertFalse(Role::query()->where('name', 'sales-agent')->exists());
        $this->assertFalse($user->hasRole('sales-agent'));
    }

    public function test_platform_admin_can_impersonate_and_exit(): void
    {
        $admin = User::factory()->platform()->create();
        $tenantUser = User::factory()->tenant()->create();
        $tenant = Tenant::factory()->create();

        TenantUser::factory()->create([
            'user_id' => $tenantUser->id,
            'tenant_id' => $tenant->id,
        ]);

        $context = app(TenantContext::class);

        $this->actingAs($admin);
        $context->impersonate($admin, $tenantUser, $tenant);

        $this->assertTrue($context->isImpersonating());
        $this->assertSame($tenantUser->id, auth()->id());
        $this->assertSame($tenant->id, $context->currentTenantId());

        $context->stopImpersonating();

        $this->assertFalse($context->isImpersonating());
        $this->assertSame($admin->id, auth()->id());
        $this->assertNull($context->currentTenantId());
        $this->assertSame(UserType::Platform, auth()->user()->type);
    }

    public function test_tenant_user_cannot_enter_tenant_without_membership(): void
    {
        $user = User::factory()->tenant()->create();
        $tenant = Tenant::factory()->create();

        $this->actingAs($user);

        $this->expectException(\InvalidArgumentException::class);
        app(TenantContext::class)->enter($tenant, $user);
    }

    public function test_direct_permissions_on_users_are_rejected(): void
    {
        $user = User::factory()->create();

        $this->expectException(\LogicException::class);

        $user->givePermissionTo('leads.view');
    }

    public function test_role_permissions_grant_ability_within_tenant(): void
    {
        $this->migrateTenant();

        $tenant = Tenant::factory()->create();
        $user = User::factory()->tenant()->create();

        TenantUser::factory()->owner()->create([
            'user_id' => $user->id,
            'tenant_id' => $tenant->id,
        ]);

        $tenant->makeCurrent();

        $permission = Permission::query()->create([
            'name' => 'leads.view',
            'guard_name' => 'web',
        ]);

        $role = Role::query()->create([
            'name' => 'agent',
            'guard_name' => 'web',
        ]);

        $role->givePermissionTo($permission);
        $user->assignRole($role);

        $this->assertTrue($user->hasRole('agent'));
        $this->assertTrue($user->can('leads.view'));
    }
}

<?php

namespace Tests\Feature\Portal;

use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Database\Seeders\TenantDatabaseSeeder;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class RoleDestroyTest extends TestCase
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

    public function test_guest_cannot_destroy_role(): void
    {
        [$user, $tenant] = $this->createTenantUserWithSeededPermissions('tenant_role_destroy_guest');
        $role = Role::query()->where('name', 'Manager')->firstOrFail();

        $this->delete(Domain::portal('/user-roles/'.$role->name))
            ->assertRedirect(Domain::auth());

        $this->assertDatabaseHas('roles', ['id' => $role->id, 'name' => 'Manager'], 'tenant');

        Tenant::forgetCurrent();
        unset($user, $tenant);
    }

    public function test_authenticated_tenant_user_can_destroy_custom_role(): void
    {
        [$user, $tenant] = $this->createTenantUserWithSeededPermissions('tenant_role_destroy_test');

        $tenant->makeCurrent();
        $role = Role::query()->create([
            'name' => 'Temp Role',
            'guard_name' => 'web',
            'description' => 'Custom',
            'is_system' => false,
            'is_enabled' => true,
        ]);
        $roleId = $role->id;
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/settings/roles'))
            ->delete(Domain::portal('/user-roles/'.$role->name))
            ->assertRedirect(route('portal.settings.index', ['section' => 'roles']));

        $tenant->makeCurrent();
        $this->assertDatabaseMissing('roles', ['id' => $roleId], 'tenant');

        Tenant::forgetCurrent();
    }

    public function test_default_role_cannot_be_deleted(): void
    {
        [$user, $tenant] = $this->createTenantUserWithSeededPermissions('tenant_role_destroy_default');
        $role = Role::query()->where('name', 'Manager')->firstOrFail();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);
        Tenant::forgetCurrent();

        $this->from(Domain::portal('/settings/roles'))
            ->delete(Domain::portal('/user-roles/'.$role->name))
            ->assertRedirect(Domain::portal('/settings/roles'))
            ->assertSessionHasErrors('role');

        $tenant->makeCurrent();
        $this->assertDatabaseHas('roles', ['id' => $role->id, 'name' => 'Manager'], 'tenant');
        Tenant::forgetCurrent();
    }

    public function test_default_role_can_be_toggled_off(): void
    {
        [$user, $tenant] = $this->createTenantUserWithSeededPermissions('tenant_role_toggle');
        $role = Role::query()->where('name', 'Sales Executive')->firstOrFail();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);
        Tenant::forgetCurrent();

        $this->put(Domain::portal('/user-roles/'.$role->name), [
            'toggle_only' => true,
            'is_enabled' => false,
        ])->assertRedirect();

        $tenant->makeCurrent();
        $role->refresh();
        $this->assertFalse((bool) $role->is_enabled);
        Tenant::forgetCurrent();
    }

    /**
     * @return array{0: User, 1: Tenant}
     */
    protected function createTenantUserWithSeededPermissions(string $database): array
    {
        $user = User::factory()->tenant()->create();
        $tenant = Tenant::factory()->create(['database' => $database]);

        TenantUser::factory()->owner()->create([
            'user_id' => $user->id,
            'tenant_id' => $tenant->id,
        ]);

        $tenant->makeCurrent();
        config(['seeder.tenant_admin_user' => $user]);
        Artisan::call('db:seed', [
            '--class' => TenantDatabaseSeeder::class,
            '--database' => 'tenant',
            '--force' => true,
        ]);

        return [$user, $tenant];
    }
}

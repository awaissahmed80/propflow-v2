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

class RoleUpdateTest extends TestCase
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

    public function test_guest_cannot_update_role(): void
    {
        [$user, $tenant] = $this->createTenantUserWithSeededPermissions('tenant_role_update_guest');
        $role = Role::query()->where('name', 'Manager')->firstOrFail();

        $this->put(Domain::portal('/user-roles/'.$role->name), [
            'name' => 'Updated Manager',
            'description' => 'Updated',
            'permissions' => ['view users'],
        ])->assertRedirect(Domain::auth());

        Tenant::forgetCurrent();
        unset($user, $tenant);
    }

    public function test_authenticated_tenant_user_can_update_role(): void
    {
        [$user, $tenant] = $this->createTenantUserWithSeededPermissions('tenant_role_update_test');
        $role = Role::query()->where('name', 'Manager')->firstOrFail();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);
        Tenant::forgetCurrent();

        $response = $this->put(Domain::portal('/user-roles/'.$role->name), [
            'name' => 'Updated Manager',
            'description' => 'Updated management role',
            'permissions' => ['view users', 'view teams'],
        ]);

        $response->assertRedirect(route('portal.settings.index', ['section' => 'roles']));

        $tenant->makeCurrent();
        $role->refresh();

        $this->assertSame('Updated Manager', $role->name);
        $this->assertSame('Updated management role', $role->description);
        $this->assertEqualsCanonicalizing(
            ['view users', 'view teams'],
            $role->permissions->pluck('name')->all()
        );

        Tenant::forgetCurrent();
    }

    public function test_updated_role_name_must_be_unique(): void
    {
        [$user, $tenant] = $this->createTenantUserWithSeededPermissions('tenant_role_update_unique');
        $role = Role::query()->where('name', 'Manager')->firstOrFail();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);
        Tenant::forgetCurrent();

        $this->put(Domain::portal('/user-roles/'.$role->name), [
            'name' => 'Admin',
            'description' => 'Duplicate',
            'permissions' => [],
        ])->assertSessionHasErrors('name');

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

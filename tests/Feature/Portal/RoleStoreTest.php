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

class RoleStoreTest extends TestCase
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

    public function test_guest_cannot_store_role(): void
    {
        $this->post(Domain::portal('/user-roles'), [
            'name' => 'Viewer',
            'description' => 'Can view only',
            'permissions' => ['view users'],
        ])->assertRedirect(Domain::auth());
    }

    public function test_authenticated_tenant_user_can_create_role_with_permissions(): void
    {
        [$user, $tenant] = $this->createTenantUserWithSeededPermissions();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->post(Domain::portal('/user-roles'), [
            'name' => 'Viewer',
            'description' => 'Can view users and teams',
            'permissions' => ['view users', 'view teams'],
        ]);

        $response->assertRedirect(route('portal.settings.index', ['section' => 'roles']));

        $role = Role::query()->where('name', 'Viewer')->first();

        $this->assertNotNull($role);
        $this->assertSame('Can view users and teams', $role->description);
        $this->assertEqualsCanonicalizing(
            ['view users', 'view teams'],
            $role->permissions->pluck('name')->all()
        );

        Tenant::forgetCurrent();
    }

    public function test_role_name_must_be_unique(): void
    {
        [$user, $tenant] = $this->createTenantUserWithSeededPermissions();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/user-roles'), [
            'name' => 'Admin',
            'description' => 'Duplicate',
            'permissions' => [],
        ])->assertSessionHasErrors('name');

        Tenant::forgetCurrent();
    }

    /**
     * @return array{0: User, 1: Tenant}
     */
    protected function createTenantUserWithSeededPermissions(): array
    {
        $user = User::factory()->tenant()->create();
        $tenant = Tenant::factory()->create(['database' => 'tenant_role_store_test']);

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

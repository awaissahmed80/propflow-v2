<?php

namespace Tests\Feature\Portal;

use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use App\Support\TenantPermissions;
use Database\Seeders\TenantDatabaseSeeder;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class RoleIndexTest extends TestCase
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

    public function test_guest_cannot_view_roles_page(): void
    {
        $this->get(Domain::portal('/user-roles'))
            ->assertRedirect(Domain::auth());
    }

    public function test_user_roles_index_redirects_to_settings_roles(): void
    {
        [$user, $tenant] = $this->createTenantUserWithSeededPermissions('tenant_roles_redirect');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);
        Tenant::forgetCurrent();

        $this->get(Domain::portal('/user-roles'))
            ->assertRedirect(route('portal.settings.index', ['section' => 'roles']));
    }

    public function test_authenticated_tenant_user_can_view_roles_in_settings(): void
    {
        [$user, $tenant] = $this->createTenantUserWithSeededPermissions('tenant_roles_test');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/settings/roles'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('settings/index', false)
            ->where('section', 'roles')
            ->has('roles', Role::query()->count())
            ->where('roles.0.name', 'Admin')
            ->has('roles.0.permissions')
            ->where('roles.0.description', 'admin with all permissions')
            ->where('roles.0.is_system', true)
            ->where('roles.0.is_enabled', true)
            ->has('permissionGroups', count(TenantPermissions::groupedForForm()))
            ->where('permissionGroups.0.group', 'Administration')
        );

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

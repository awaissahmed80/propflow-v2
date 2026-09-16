<?php

namespace Tests\Feature\Portal;

use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Database\Seeders\TenantDatabaseSeeder;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class UserIndexTest extends TestCase
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

    public function test_guest_cannot_view_users_page(): void
    {
        $this->get(Domain::portal('/users'))
            ->assertRedirect(Domain::auth());
    }

    public function test_authenticated_tenant_user_sees_users_without_default_selection(): void
    {
        [$user, $tenant, $membership] = $this->createTenantUser('tenant_users_index_default');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);
        Tenant::forgetCurrent();

        $response = $this->get(Domain::portal('/users'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('users/index', false)
            ->has('users', 1)
            ->where('users.0.code', $membership->code)
            ->where('selectedUser', null)
            ->where('filters.q', '')
        );

        Tenant::forgetCurrent();
    }

    public function test_authenticated_tenant_user_can_view_user_by_membership_code(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_users_show_by_code');
        $other = User::factory()->tenant()->create([
            'display_name' => 'Imran Nawaz',
            'first_name' => 'Imran',
            'last_name' => 'Nawaz',
            'email_address' => 'imran.nawaz@example.com',
            'phone_number' => '+922232323232',
        ]);

        $otherMembership = TenantUser::factory()->create([
            'user_id' => $other->id,
            'tenant_id' => $tenant->id,
            'title' => 'Sales Exec',
            'department' => 'Marketing',
            'manager_id' => $user->id,
        ]);

        $tenant->makeCurrent();
        config(['seeder.tenant_admin_user' => $user]);
        Artisan::call('db:seed', [
            '--class' => TenantDatabaseSeeder::class,
            '--database' => 'tenant',
            '--force' => true,
        ]);
        $other->assignRole('Manager');
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/users?user='.$otherMembership->code));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('users/index', false)
            ->has('users', 2)
            ->where('selectedUser.code', $otherMembership->code)
            ->where('selectedUser.display_name', 'Imran Nawaz')
            ->where('selectedUser.email_address', 'imran.nawaz@example.com')
            ->where('selectedUser.phone_number', '+922232323232')
            ->where('selectedUser.subtitle', 'Sales Exec (Marketing)')
            ->where('selectedUser.status', 'ACTIVE')
            ->where('selectedUser.manager.id', $user->id)
            ->has('selectedUser.roles')
            ->has('selectedUser.stats')
            ->has('selectedUser.teams')
        );

        Tenant::forgetCurrent();
    }

    public function test_users_can_be_filtered_by_query(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_users_filter_q');
        $other = User::factory()->tenant()->create([
            'display_name' => 'Imran Nawaz',
            'email_address' => 'imran.nawaz@example.com',
            'phone_number' => '+922232323232',
        ]);

        TenantUser::factory()->create([
            'user_id' => $other->id,
            'tenant_id' => $tenant->id,
            'title' => 'Sales Exec',
        ]);

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);
        Tenant::forgetCurrent();

        $response = $this->get(Domain::portal('/users?q=Imran'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('users/index', false)
            ->has('users', 1)
            ->where('users.0.display_name', 'Imran Nawaz')
            ->where('selectedUser', null)
            ->where('filters.q', 'Imran')
        );

        Tenant::forgetCurrent();
    }

    /**
     * @return array{0: User, 1: Tenant, 2: TenantUser}
     */
    protected function createTenantUser(string $database): array
    {
        $user = User::factory()->tenant()->create();
        $tenant = Tenant::factory()->create(['database' => $database]);

        $membership = TenantUser::factory()->owner()->create([
            'user_id' => $user->id,
            'tenant_id' => $tenant->id,
            'title' => 'Admin',
        ]);

        return [$user, $tenant, $membership];
    }
}

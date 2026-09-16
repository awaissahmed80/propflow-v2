<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Enums\UserType;
use App\Models\LeadStage;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Support\TenantPermissions;
use Database\Seeders\TenantDatabaseSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class MakeTenantCommandTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->migrateLandlord();
    }

    public function test_make_tenant_requires_name_database_and_identifier(): void
    {
        $this->artisan('make:tenant')
            ->assertFailed();
    }

    public function test_make_tenant_rejects_invalid_database_name(): void
    {
        $this->artisan('make:tenant', [
            '--name' => 'Acme',
            '--database' => 'bad-name!',
            '--identifier' => 'acme',
        ])->assertFailed();
    }

    public function test_make_tenant_rejects_duplicate_identifier(): void
    {
        Tenant::factory()->create(['identifier' => 'acme', 'database' => 'tenant_acme']);

        $this->artisan('make:tenant', [
            '--name' => 'Acme',
            '--database' => 'tenant_acme_2',
            '--identifier' => 'acme',
        ])->assertFailed();
    }

    public function test_make_tenant_requires_password_option(): void
    {
        $this->artisan('make:tenant', [
            '--name' => 'Acme',
            '--database' => 'tenant_acme',
            '--identifier' => 'acme',
            '--admin_email' => 'admin@acme.test',
        ])->assertFailed();
    }

    public function test_admin_password_option_is_stored_for_login(): void
    {
        $user = User::query()->firstOrNew(['email_address' => 'admin@acme.test']);
        $user->fill([
            'display_name' => 'Acme Admin',
            'first_name' => 'Acme',
            'last_name' => 'Admin',
            'password' => 'secret',
            'type' => UserType::Tenant,
            'status' => UserStatus::Active,
        ]);
        $user->save();

        $this->assertTrue(
            Hash::check('secret', $user->fresh()->getRawOriginal('password'))
        );
        $this->assertTrue(
            Auth::attempt([
                'email_address' => 'admin@acme.test',
                'password' => 'secret',
            ])
        );
    }

    public function test_tenant_database_seeder_creates_admin_role_permissions_and_stages(): void
    {
        $this->migrateTenant();

        $tenant = Tenant::factory()->create();
        $admin = User::factory()->tenant()->create();

        $tenant->makeCurrent();
        config(['seeder.tenant_admin_user' => $admin]);

        Artisan::call('db:seed', [
            '--class' => TenantDatabaseSeeder::class,
            '--database' => 'tenant',
            '--force' => true,
        ]);

        $this->assertTrue(Role::query()->where('name', 'Admin')->exists());
        $this->assertTrue(Role::query()->where('name', 'Team Lead')->exists());
        $this->assertTrue(Role::query()->where('name', 'Manager')->exists());
        $this->assertTrue(Role::query()->where('name', 'Sales Executive')->exists());

        $this->assertSame(
            count(TenantPermissions::names()),
            Permission::query()->count()
        );

        $adminRole = Role::query()->where('name', 'Admin')->first();
        $this->assertSame('admin with all permissions', $adminRole?->description);
        $this->assertTrue($admin->fresh()->hasRole('Admin'));
        $this->assertTrue($admin->can('manage admin'));
        $this->assertTrue($admin->can('work lead'));

        $sales = Role::query()->where('name', 'Sales Executive')->first();
        $this->assertEqualsCanonicalizing(['work lead'], $sales?->permissions->pluck('name')->all());

        $this->assertSame('Administration', Permission::query()->where('name', 'manage admin')->value('group'));
        $this->assertGreaterThan(0, LeadStage::query()->count());
        $this->assertCount(5, TenantPermissions::groupedForForm());

        Tenant::forgetCurrent();
    }

    public function test_tenant_migrate_fails_for_unknown_tenant(): void
    {
        $this->artisan('tenant:migrate', ['tenant' => 'missing-tenant'])
            ->assertFailed();
    }
}

<?php

namespace Tests\Feature;

use App\Models\LeadStage;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Support\TenantPermissions;
use Database\Seeders\TenantDatabaseSeeder;
use Illuminate\Support\Facades\Artisan;
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

        $this->assertTrue(Role::query()->where('name', 'admin')->exists());
        $this->assertSame(
            count(TenantPermissions::names()),
            Permission::query()->count()
        );
        $this->assertTrue($admin->fresh()->hasRole('admin'));
        $this->assertTrue($admin->can('leads.view'));
        $this->assertGreaterThan(0, LeadStage::query()->count());

        Tenant::forgetCurrent();
    }

    public function test_tenant_migrate_fails_for_unknown_tenant(): void
    {
        $this->artisan('tenant:migrate', ['tenant' => 'missing-tenant'])
            ->assertFailed();
    }
}

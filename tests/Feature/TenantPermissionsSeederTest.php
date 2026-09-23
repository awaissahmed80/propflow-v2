<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Support\TenantPermissions;
use Database\Seeders\TenantPermissionsSeeder;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class TenantPermissionsSeederTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->migrateLandlord();
        $this->migrateTenant();
    }

    public function test_seeder_creates_all_catalog_permissions_with_groups(): void
    {
        $tenant = Tenant::factory()->create();
        $tenant->makeCurrent();

        Artisan::call('db:seed', [
            '--class' => TenantPermissionsSeeder::class,
            '--database' => 'tenant',
            '--force' => true,
        ]);

        $names = TenantPermissions::names();

        $this->assertSame(count($names), Permission::query()->count());
        $this->assertContains('manage booking', $names);
        $this->assertContains('manage contact', $names);
        $this->assertContains('view reports', $names);

        $this->assertSame(
            'Users & Teams',
            Permission::query()->where('name', 'manage user')->value('group')
        );
        $this->assertSame(
            'Leads & Contacts',
            Permission::query()->where('name', 'work lead')->value('group')
        );
        $this->assertSame(
            'Accounts & Operations',
            Permission::query()->where('name', 'record payment')->value('group')
        );
        $this->assertSame(
            'Projects & Inventory',
            Permission::query()->where('name', 'manage inventory')->value('group')
        );

        Tenant::forgetCurrent();
    }

    public function test_seeder_syncs_default_system_roles(): void
    {
        $tenant = Tenant::factory()->create();
        $tenant->makeCurrent();

        Artisan::call('db:seed', [
            '--class' => TenantPermissionsSeeder::class,
            '--database' => 'tenant',
            '--force' => true,
        ]);

        foreach (TenantPermissions::defaultRoles() as $roleData) {
            $role = Role::query()->where('name', $roleData['name'])->first();

            $this->assertNotNull($role, "Missing role {$roleData['name']}");
            $this->assertTrue($role->is_system);
            $this->assertTrue($role->is_enabled);
            $this->assertEqualsCanonicalizing(
                $roleData['permissions'],
                $role->permissions->pluck('name')->all()
            );
        }

        $this->assertCount(7, TenantPermissions::defaultRoles());
        $this->assertTrue(TenantPermissions::isLockedRole('Admin'));
        $this->assertFalse(TenantPermissions::isLockedRole('Business Manager'));

        $admin = Role::query()->where('name', 'Admin')->first();
        $this->assertSame(count(TenantPermissions::names()), $admin?->permissions->count());

        $businessManager = Role::query()->where('name', 'Business Manager')->first();
        $this->assertFalse($businessManager?->hasPermissionTo('manage admin'));
        $this->assertSame(count(TenantPermissions::names()) - 1, $businessManager?->permissions->count());

        Tenant::forgetCurrent();
    }

    public function test_seeder_is_idempotent_and_refreshes_labels(): void
    {
        $tenant = Tenant::factory()->create();
        $tenant->makeCurrent();

        Artisan::call('db:seed', [
            '--class' => TenantPermissionsSeeder::class,
            '--database' => 'tenant',
            '--force' => true,
        ]);

        Permission::query()->where('name', 'manage admin')->update([
            'label' => 'stale label',
            'group' => 'Old Group',
        ]);

        Artisan::call('db:seed', [
            '--class' => TenantPermissionsSeeder::class,
            '--database' => 'tenant',
            '--force' => true,
        ]);

        $permission = Permission::query()->where('name', 'manage admin')->first();

        $this->assertSame(count(TenantPermissions::names()), Permission::query()->count());
        $this->assertSame('Administration', $permission?->group);
        $this->assertStringContainsString('Full admin access', (string) $permission?->label);

        Tenant::forgetCurrent();
    }
}

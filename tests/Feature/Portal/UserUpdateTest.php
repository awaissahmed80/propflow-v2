<?php

namespace Tests\Feature\Portal;

use App\Models\AssetLink;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\AssetManager;
use App\Support\Domain;
use Database\Seeders\TenantDatabaseSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class UserUpdateTest extends TestCase
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

    protected function tearDown(): void
    {
        File::deleteDirectory(public_path('assets/avatars'));

        parent::tearDown();
    }

    public function test_guest_cannot_update_user(): void
    {
        [$actor, $tenant, $membership] = $this->createTenantUserWithSeededRoles('tenant_user_update_guest');

        $this->put(Domain::portal('/users/'.$actor->id), [
            'first_name' => 'Changed',
            'last_name' => 'Name',
            'title' => $membership->title,
            'email_address' => $actor->email_address,
            'phone_number' => '+923001111111',
        ])->assertRedirect(Domain::auth());

        Tenant::forgetCurrent();
    }

    public function test_authenticated_tenant_user_can_update_user_and_replace_avatar(): void
    {
        [$actor, $tenant] = $this->createTenantUserWithSeededRoles('tenant_user_update_avatar');

        $target = User::factory()->tenant()->create([
            'first_name' => 'Imran',
            'last_name' => 'Nawaz',
            'display_name' => 'Imran Nawaz',
            'email_address' => 'imran.nawaz@example.com',
            'phone_number' => '+923001234567',
        ]);

        $membership = TenantUser::factory()->create([
            'user_id' => $target->id,
            'tenant_id' => $tenant->id,
            'title' => 'Sales Exec',
            'department' => 'Marketing',
        ]);

        $tenant->makeCurrent();
        $target->assignRole('Manager');

        $firstAvatar = UploadedFile::fake()->image('first.jpg', 100, 100);
        app(AssetManager::class)->attach($target, $firstAvatar, AssetManager::LINKAGE_AVATAR, 'avatars');

        $firstLink = AssetLink::query()
            ->where('assetable_type', User::class)
            ->where('assetable_id', $target->id)
            ->where('linkage', AssetManager::LINKAGE_AVATAR)
            ->first();
        $firstPath = public_path('assets/'.$firstLink->asset->path);
        $this->assertFileExists($firstPath);

        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $replacement = UploadedFile::fake()->image('second.png', 140, 140);

        $response = $this->put(Domain::portal('/users/'.$target->id), [
            'first_name' => 'Imran',
            'last_name' => 'Updated',
            'title' => 'Team Lead',
            'department' => 'Sales',
            'manager_id' => $actor->id,
            'email_address' => 'imran.updated@example.com',
            'phone_number' => '+923009876543',
            'roles' => ['Manager'],
            'avatar' => $replacement,
        ]);

        $response->assertRedirect(Domain::portal('/users?user='.$membership->code));

        $target->refresh();
        $membership->refresh();

        $this->assertSame('Imran Updated', $target->display_name);
        $this->assertSame('imran.updated@example.com', $target->email_address);
        $this->assertSame('Team Lead', $membership->title);
        $this->assertSame('Sales', $membership->department);
        $this->assertSame($actor->id, $membership->manager_id);
        $this->assertFileDoesNotExist($firstPath);

        $tenant->makeCurrent();
        $link = AssetLink::query()
            ->where('assetable_type', User::class)
            ->where('assetable_id', $target->id)
            ->where('linkage', AssetManager::LINKAGE_AVATAR)
            ->first();

        $this->assertNotNull($link);
        $this->assertFileExists(public_path('assets/'.$link->asset->path));
        $this->assertNotSame($firstLink->asset_id, $link->asset_id);

        Tenant::forgetCurrent();
    }

    public function test_authenticated_tenant_user_can_remove_avatar(): void
    {
        [$actor, $tenant] = $this->createTenantUserWithSeededRoles('tenant_user_remove_avatar');

        $target = User::factory()->tenant()->create();
        $membership = TenantUser::factory()->create([
            'user_id' => $target->id,
            'tenant_id' => $tenant->id,
            'title' => 'Sales Exec',
        ]);

        $tenant->makeCurrent();
        app(AssetManager::class)->attach(
            $target,
            UploadedFile::fake()->image('keep.jpg'),
            AssetManager::LINKAGE_AVATAR,
            'avatars',
        );
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/users/'.$target->id), [
            'first_name' => $target->first_name,
            'last_name' => $target->last_name,
            'title' => $membership->title,
            'email_address' => $target->email_address,
            'phone_number' => $target->phone_number ?? '+923001234567',
            'remove_avatar' => true,
        ])->assertRedirect(Domain::portal('/users?user='.$membership->code));

        $tenant->makeCurrent();
        $this->assertNull(
            AssetLink::query()
                ->where('assetable_type', User::class)
                ->where('assetable_id', $target->id)
                ->where('linkage', AssetManager::LINKAGE_AVATAR)
                ->first()
        );
        Tenant::forgetCurrent();
    }

    /**
     * @return array{0: User, 1: Tenant, 2: TenantUser}
     */
    protected function createTenantUserWithSeededRoles(string $database): array
    {
        $user = User::factory()->tenant()->create();
        $tenant = Tenant::factory()->create(['database' => $database]);

        $membership = TenantUser::factory()->owner()->create([
            'user_id' => $user->id,
            'tenant_id' => $tenant->id,
            'title' => 'Admin',
        ]);

        $tenant->makeCurrent();
        config(['seeder.tenant_admin_user' => $user]);
        Artisan::call('db:seed', [
            '--class' => TenantDatabaseSeeder::class,
            '--database' => 'tenant',
            '--force' => true,
        ]);

        $this->assertNotNull(Role::query()->where('name', 'Manager')->first());

        return [$user, $tenant, $membership];
    }
}

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

class UserStoreTest extends TestCase
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

    public function test_guest_cannot_store_user(): void
    {
        $this->post(Domain::portal('/users'), [
            'first_name' => 'Imran',
            'last_name' => 'Nawaz',
            'title' => 'Sales Exec',
            'email_address' => 'imran@example.com',
            'phone_number' => '+923001234567',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertRedirect(Domain::auth());
    }

    public function test_authenticated_tenant_user_can_create_user_with_avatar(): void
    {
        [$actor, $tenant] = $this->createTenantUserWithSeededRoles('tenant_user_store_avatar');

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $avatar = UploadedFile::fake()->image('avatar.jpg', 120, 120);

        $response = $this->post(Domain::portal('/users'), [
            'first_name' => 'Imran',
            'last_name' => 'Nawaz',
            'title' => 'Sales Exec',
            'department' => 'Marketing',
            'manager_id' => $actor->id,
            'email_address' => 'imran.nawaz@example.com',
            'phone_number' => '+923001234567',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'roles' => ['Manager'],
            'avatar' => $avatar,
        ]);

        $created = User::query()->where('email_address', 'imran.nawaz@example.com')->first();
        $this->assertNotNull($created);

        $membership = TenantUser::query()
            ->where('tenant_id', $tenant->id)
            ->where('user_id', $created->id)
            ->first();

        $this->assertNotNull($membership);
        $response->assertRedirect(Domain::portal('/users?user='.$membership->code));

        $this->assertSame('Imran Nawaz', $created->display_name);
        $this->assertSame('Sales Exec', $membership->title);
        $this->assertSame('Marketing', $membership->department);
        $this->assertSame($actor->id, $membership->manager_id);

        $tenant->makeCurrent();
        $this->assertTrue($created->hasRole('Manager'));

        $link = AssetLink::query()
            ->where('assetable_type', User::class)
            ->where('assetable_id', $created->id)
            ->where('linkage', AssetManager::LINKAGE_AVATAR)
            ->first();

        $this->assertNotNull($link);
        $this->assertNotNull($link->asset);
        $this->assertFileExists(public_path('assets/'.$link->asset->path));

        Tenant::forgetCurrent();
        $this->get(Domain::portal('/users?user='.$membership->code))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('users/index', false)
                ->where('selectedUser.email_address', 'imran.nawaz@example.com')
                ->where('selectedUser.avatar', url('assets/'.$link->asset->path))
            );

        Tenant::forgetCurrent();
    }

    public function test_email_must_be_unique(): void
    {
        [$actor, $tenant] = $this->createTenantUserWithSeededRoles('tenant_user_store_unique');

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/users'), [
            'first_name' => 'Dup',
            'last_name' => 'User',
            'title' => 'Sales',
            'email_address' => $actor->email_address,
            'phone_number' => '+923009999999',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertSessionHasErrors('email_address');

        Tenant::forgetCurrent();
    }

    /**
     * @return array{0: User, 1: Tenant}
     */
    protected function createTenantUserWithSeededRoles(string $database): array
    {
        $user = User::factory()->tenant()->create();
        $tenant = Tenant::factory()->create(['database' => $database]);

        TenantUser::factory()->owner()->create([
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

        return [$user, $tenant];
    }
}

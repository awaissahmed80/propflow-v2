<?php

namespace Tests\Feature\Portal;

use App\Mail\WorkspaceInviteMail;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantInvitation;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Database\Seeders\TenantDatabaseSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class UserStoreTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'app.base_domain' => 'propflow.test',
            'app.url_scheme' => 'https',
            'mail.default' => 'array',
        ]);

        $this->migrateLandlord();
        $this->migrateTenant();
        Mail::fake();
    }

    public function test_guest_cannot_store_user(): void
    {
        $this->post(Domain::portal('/users'), [
            'title' => 'Sales Exec',
            'email_address' => 'imran@example.com',
        ])->assertRedirect(Domain::auth());
    }

    public function test_authenticated_tenant_user_can_invite_new_member(): void
    {
        [$actor, $tenant] = $this->createTenantUserWithSeededRoles('tenant_user_store_invite');

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->post(Domain::portal('/users'), [
            'title' => 'Sales Exec',
            'department' => 'Marketing',
            'manager_id' => $actor->id,
            'email_address' => 'imran.nawaz@example.com',
            'roles' => ['Business Manager'],
        ]);

        $response->assertRedirect(Domain::portal('/users'));

        $this->assertNull(User::query()->where('email_address', 'imran.nawaz@example.com')->first());

        $invitation = TenantInvitation::query()
            ->where('tenant_id', $tenant->id)
            ->where('email', 'imran.nawaz@example.com')
            ->first();

        $this->assertNotNull($invitation);
        $this->assertSame('Sales Exec', $invitation->title);
        $this->assertSame(['Business Manager'], $invitation->roles);

        Mail::assertSent(WorkspaceInviteMail::class);

        Tenant::forgetCurrent();
    }

    public function test_inviting_existing_user_does_not_create_membership_yet(): void
    {
        [$actor, $tenant] = $this->createTenantUserWithSeededRoles('tenant_user_store_existing');

        $existing = User::factory()->tenant()->create([
            'email_address' => 'imran.nawaz@example.com',
        ]);

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->post(Domain::portal('/users'), [
            'title' => 'Sales Exec',
            'department' => 'Marketing',
            'manager_id' => $actor->id,
            'email_address' => 'imran.nawaz@example.com',
            'roles' => ['Business Manager'],
        ]);

        $response->assertRedirect(Domain::portal('/users'));

        $this->assertNull(
            TenantUser::query()
                ->where('tenant_id', $tenant->id)
                ->where('user_id', $existing->id)
                ->first()
        );

        $this->assertNotNull(
            TenantInvitation::query()
                ->where('tenant_id', $tenant->id)
                ->where('email', 'imran.nawaz@example.com')
                ->first()
        );

        Mail::assertSent(WorkspaceInviteMail::class);

        Tenant::forgetCurrent();
    }

    public function test_email_must_not_already_belong_to_workspace(): void
    {
        [$actor, $tenant] = $this->createTenantUserWithSeededRoles('tenant_user_store_unique');

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/users'), [
            'title' => 'Sales',
            'email_address' => $actor->email_address,
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

        $this->assertNotNull(Role::query()->where('name', 'Business Manager')->first());

        return [$user, $tenant];
    }
}

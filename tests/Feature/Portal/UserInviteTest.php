<?php

namespace Tests\Feature\Portal;

use App\Enums\TenantInvitationStatus;
use App\Enums\UserType;
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

class UserInviteTest extends TestCase
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

    public function test_inviting_new_email_creates_pending_invitation_and_sends_mail(): void
    {
        [$actor, $tenant] = $this->createTenantUserWithSeededRoles('tenant_invite_new');

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->post(Domain::portal('/users'), [
            'title' => 'Sales Exec',
            'department' => 'Sales',
            'email_address' => 'sara.khan@example.com',
            'roles' => ['Sales Executive'],
        ]);

        $response->assertRedirect(Domain::portal('/users'));

        $this->assertNull(User::query()->where('email_address', 'sara.khan@example.com')->first());

        $invitation = TenantInvitation::query()
            ->where('tenant_id', $tenant->id)
            ->where('email', 'sara.khan@example.com')
            ->first();

        $this->assertNotNull($invitation);
        $this->assertSame(TenantInvitationStatus::Pending, $invitation->status);
        $this->assertSame(['Sales Executive'], $invitation->roles);

        Mail::assertSent(WorkspaceInviteMail::class, function (WorkspaceInviteMail $mail) use ($invitation): bool {
            return $mail->invitation->is($invitation)
                && $mail->hasTo('sara.khan@example.com');
        });

        Tenant::forgetCurrent();
    }

    public function test_inviting_existing_user_creates_pending_invitation_without_membership(): void
    {
        [$actor, $tenant] = $this->createTenantUserWithSeededRoles('tenant_invite_existing');

        $existing = User::factory()->tenant()->create([
            'email_address' => 'existing@example.com',
            'first_name' => 'Existing',
            'last_name' => 'User',
        ]);

        $otherTenant = Tenant::factory()->create(['database' => 'tenant_invite_other']);
        TenantUser::factory()->create([
            'user_id' => $existing->id,
            'tenant_id' => $otherTenant->id,
            'title' => 'Agent',
        ]);

        $usersBefore = User::query()->count();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->post(Domain::portal('/users'), [
            'title' => 'Business Manager',
            'department' => 'Sales',
            'email_address' => 'existing@example.com',
            'roles' => ['Business Manager'],
        ]);

        $response->assertRedirect(Domain::portal('/users'));

        $this->assertSame($usersBefore, User::query()->count());
        $this->assertNull(
            TenantUser::query()
                ->where('tenant_id', $tenant->id)
                ->where('user_id', $existing->id)
                ->first()
        );
        $this->assertSame(1, TenantUser::query()->where('user_id', $existing->id)->count());

        $invitation = TenantInvitation::query()
            ->where('tenant_id', $tenant->id)
            ->where('email', 'existing@example.com')
            ->first();

        $this->assertNotNull($invitation);
        $this->assertSame(TenantInvitationStatus::Pending, $invitation->status);
        $this->assertSame(['Business Manager'], $invitation->roles);

        Mail::assertSent(WorkspaceInviteMail::class, function (WorkspaceInviteMail $mail) use ($invitation): bool {
            return $mail->invitation->is($invitation)
                && $mail->hasTo('existing@example.com');
        });

        Tenant::forgetCurrent();
    }

    public function test_cannot_invite_user_already_in_workspace(): void
    {
        [$actor, $tenant] = $this->createTenantUserWithSeededRoles('tenant_invite_dup');

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/users'), [
            'title' => 'Sales',
            'email_address' => $actor->email_address,
        ])->assertSessionHasErrors('email_address');

        Tenant::forgetCurrent();
    }

    public function test_cannot_invite_platform_user(): void
    {
        [$actor, $tenant] = $this->createTenantUserWithSeededRoles('tenant_invite_platform');

        User::factory()->create([
            'email_address' => 'platform@example.com',
            'type' => UserType::Platform,
        ]);

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/users'), [
            'title' => 'Sales',
            'email_address' => 'platform@example.com',
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

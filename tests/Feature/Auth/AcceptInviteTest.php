<?php

namespace Tests\Feature\Auth;

use App\Enums\TenantInvitationStatus;
use App\Enums\TenantMembershipStatus;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantInvitation;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Database\Seeders\TenantDatabaseSeeder;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class AcceptInviteTest extends TestCase
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
    }

    public function test_guest_can_view_pending_invite(): void
    {
        [$invitation] = $this->createPendingInvitation();

        $this->get(Domain::auth('/invites/'.$invitation->token))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('auth/accept-invite')
                ->where('invalid', false)
                ->where('invitation.email', $invitation->email)
            );
    }

    public function test_guest_can_accept_invite_and_join_workspace(): void
    {
        [$invitation, $tenant] = $this->createPendingInvitation(['roles' => ['Sales Executive']]);

        $response = $this->post(Domain::auth('/invites/'.$invitation->token), [
            'first_name' => 'Ayesha',
            'last_name' => 'Ali',
            'phone_number' => '+923005555555',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertOk()->assertInertia(fn ($page) => $page
            ->component('auth/accept-invite')
            ->where('status', 'accepted')
            ->where('redirect', Domain::portal())
        );

        $user = User::query()->where('email_address', $invitation->email)->first();
        $this->assertNotNull($user);
        $this->assertAuthenticatedAs($user);

        $membership = TenantUser::query()
            ->where('tenant_id', $tenant->id)
            ->where('user_id', $user->id)
            ->first();

        $this->assertNotNull($membership);
        $this->assertSame(TenantMembershipStatus::Active, $membership->status);
        $this->assertSame(TenantInvitationStatus::Accepted, $invitation->fresh()->status);
        $this->assertSame($tenant->id, session(TenantContext::SESSION_TENANT_ID));

        $tenant->makeCurrent();
        $this->assertTrue($user->fresh()->hasRole('Sales Executive'));
        Tenant::forgetCurrent();
    }

    public function test_existing_user_accepts_invite_with_password_and_gains_membership(): void
    {
        $existing = User::factory()->tenant()->create([
            'email_address' => 'existing.member@example.com',
            'password' => 'password123',
        ]);

        [$invitation, $tenant] = $this->createPendingInvitation([
            'email' => $existing->email_address,
            'roles' => ['Business Manager'],
        ]);

        $this->assertNull(
            TenantUser::query()
                ->where('tenant_id', $tenant->id)
                ->where('user_id', $existing->id)
                ->first()
        );

        $this->get(Domain::auth('/invites/'.$invitation->token))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('auth/accept-invite')
                ->where('existing_account', true)
                ->where('authenticated_as_invitee', false)
            );

        $response = $this->post(Domain::auth('/invites/'.$invitation->token), [
            'password' => 'password123',
        ]);

        $response->assertOk()->assertInertia(fn ($page) => $page
            ->component('auth/accept-invite')
            ->where('status', 'accepted')
        );

        $membership = TenantUser::query()
            ->where('tenant_id', $tenant->id)
            ->where('user_id', $existing->id)
            ->first();

        $this->assertNotNull($membership);
        $this->assertSame(TenantMembershipStatus::Active, $membership->status);
        $this->assertSame(TenantInvitationStatus::Accepted, $invitation->fresh()->status);
        $this->assertAuthenticatedAs($existing);

        $tenant->makeCurrent();
        $this->assertTrue($existing->fresh()->hasRole('Business Manager'));
        Tenant::forgetCurrent();
    }

    public function test_logged_in_invitee_can_accept_without_password(): void
    {
        $existing = User::factory()->tenant()->create([
            'email_address' => 'logged.in@example.com',
            'password' => 'password123',
        ]);

        [$invitation, $tenant] = $this->createPendingInvitation([
            'email' => $existing->email_address,
            'roles' => ['Sales Executive'],
        ]);

        $this->actingAs($existing);

        $this->get(Domain::auth('/invites/'.$invitation->token))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('existing_account', true)
                ->where('authenticated_as_invitee', true)
            );

        $this->post(Domain::auth('/invites/'.$invitation->token), [])
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('status', 'accepted'));

        $this->assertNotNull(
            TenantUser::query()
                ->where('tenant_id', $tenant->id)
                ->where('user_id', $existing->id)
                ->first()
        );

        Tenant::forgetCurrent();
    }

    public function test_expired_invite_cannot_be_accepted(): void
    {
        [$invitation] = $this->createPendingInvitation([
            'expires_at' => now()->subDay(),
        ]);

        $this->post(Domain::auth('/invites/'.$invitation->token), [
            'first_name' => 'Ayesha',
            'last_name' => 'Ali',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertOk()->assertInertia(fn ($page) => $page
            ->component('auth/accept-invite')
            ->where('invalid', true)
        );

        $this->assertNull(User::query()->where('email_address', $invitation->email)->first());
        $this->assertGuest();
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array{0: TenantInvitation, 1: Tenant}
     */
    protected function createPendingInvitation(array $overrides = []): array
    {
        $owner = User::factory()->tenant()->create();
        $tenant = Tenant::factory()->create(['database' => 'tenant_accept_invite']);

        TenantUser::factory()->owner()->create([
            'user_id' => $owner->id,
            'tenant_id' => $tenant->id,
            'title' => 'Admin',
        ]);

        $tenant->makeCurrent();
        config(['seeder.tenant_admin_user' => $owner]);
        Artisan::call('db:seed', [
            '--class' => TenantDatabaseSeeder::class,
            '--database' => 'tenant',
            '--force' => true,
        ]);
        $this->assertNotNull(Role::query()->where('name', 'Sales Executive')->first());
        Tenant::forgetCurrent();

        $invitation = TenantInvitation::factory()->create(array_merge([
            'tenant_id' => $tenant->id,
            'invited_by' => $owner->id,
            'email' => 'new.member@example.com',
            'roles' => ['Sales Executive'],
        ], $overrides));

        return [$invitation, $tenant];
    }
}

<?php

namespace Tests\Feature\Auth;

use App\Enums\TenantMembershipStatus;
use App\Enums\UserStatus;
use App\Enums\UserType;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class TenantLoginTest extends TestCase
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

    public function test_login_page_is_available_on_auth_domain(): void
    {
        $this->get(Domain::auth())
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('auth/login', false));
    }

    public function test_guest_cannot_access_portal(): void
    {
        $this->get(Domain::portal())
            ->assertRedirect(Domain::auth());
    }

    public function test_tenant_user_can_login_and_is_redirected_to_portal(): void
    {
        $user = User::factory()->tenant()->create([
            'email_address' => 'owner@example.com',
            'password' => Hash::make('password'),
            'status' => UserStatus::Active,
        ]);

        $tenant = Tenant::factory()->create();

        TenantUser::factory()->owner()->create([
            'user_id' => $user->id,
            'tenant_id' => $tenant->id,
            'status' => TenantMembershipStatus::Active,
        ]);

        $response = $this->from(Domain::auth())->post(Domain::auth('/login'), [
            'email_address' => 'owner@example.com',
            'password' => 'password',
        ]);

        $this->assertAuthenticatedAs($user);
        $this->assertSame($tenant->id, session(TenantContext::SESSION_TENANT_ID));
        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('auth/login', false)
            ->where('status', 'authenticated')
            ->where('redirect', Domain::portal())
        );
    }

    public function test_invalid_credentials_return_validation_error(): void
    {
        User::factory()->tenant()->create([
            'email_address' => 'owner@example.com',
            'password' => Hash::make('password'),
        ]);

        $response = $this->from(Domain::auth())->post(Domain::auth('/login'), [
            'email_address' => 'owner@example.com',
            'password' => 'wrong-password',
        ]);

        $response->assertRedirect(Domain::auth());
        $response->assertSessionHasErrors('email_address');
        $this->assertGuest();
    }

    public function test_platform_user_cannot_login_via_tenant_auth(): void
    {
        User::factory()->platform()->create([
            'email_address' => 'admin@propflow.test',
            'password' => Hash::make('password'),
            'type' => UserType::Platform,
        ]);

        $response = $this->from(Domain::auth())->post(Domain::auth('/login'), [
            'email_address' => 'admin@propflow.test',
            'password' => 'password',
        ]);

        $response->assertSessionHasErrors('email_address');
        $this->assertGuest();
    }

    public function test_tenant_user_without_membership_cannot_login(): void
    {
        User::factory()->tenant()->create([
            'email_address' => 'orphan@example.com',
            'password' => Hash::make('password'),
        ]);

        $response = $this->from(Domain::auth())->post(Domain::auth('/login'), [
            'email_address' => 'orphan@example.com',
            'password' => 'password',
        ]);

        $response->assertSessionHasErrors('email_address');
        $this->assertGuest();
    }

    public function test_authenticated_user_can_access_portal(): void
    {
        $user = User::factory()->tenant()->create();
        $tenant = Tenant::factory()->create();

        TenantUser::factory()->create([
            'user_id' => $user->id,
            'tenant_id' => $tenant->id,
        ]);

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);
        $tenant->makeCurrent();

        $this->get(Domain::portal())
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('dashboard/index', false));

        $this->get(Domain::portal('/dashboard'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('dashboard/index', false));
    }

    public function test_authenticated_user_can_logout_and_is_sent_to_auth(): void
    {
        $user = User::factory()->tenant()->create();
        $tenant = Tenant::factory()->create();

        TenantUser::factory()->create([
            'user_id' => $user->id,
            'tenant_id' => $tenant->id,
        ]);

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->from(Domain::portal())->post(Domain::portal('/logout'));

        $this->assertGuest();
        $this->assertNull(session(TenantContext::SESSION_TENANT_ID));
        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('auth/login', false)
            ->where('status', 'logged_out')
            ->where('redirect', Domain::auth())
        );
    }
}

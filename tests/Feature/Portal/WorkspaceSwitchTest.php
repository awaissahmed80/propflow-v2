<?php

namespace Tests\Feature\Portal;

use App\Enums\TenantMembershipStatus;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class WorkspaceSwitchTest extends TestCase
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

    public function test_portal_shares_available_workspaces(): void
    {
        [$user, $tenantA, $tenantB] = $this->createMultiWorkspaceUser();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenantA->id]);
        $tenantA->makeCurrent();

        $this->get(Domain::portal())
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('dashboard/index', false)
                ->where('tenant.current.id', $tenantA->id)
                ->has('tenant.available', 2)
                ->where('tenant.available.0.name', 'Alpha Realty')
                ->where('tenant.available.1.name', 'Beta Homes')
                ->where('tenant.available.1.id', $tenantB->id)
            );
    }

    public function test_user_can_switch_workspace_from_portal(): void
    {
        [$user, $tenantA, $tenantB] = $this->createMultiWorkspaceUser();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenantA->id]);
        $tenantA->makeCurrent();

        $response = $this->from(Domain::portal())
            ->post(Domain::portal('/workspaces/switch'), [
                'tenant_id' => $tenantB->id,
            ]);

        $this->assertSame($tenantB->id, session(TenantContext::SESSION_TENANT_ID));
        $response->assertRedirect(Domain::portal());
    }

    public function test_cannot_switch_to_workspace_without_membership(): void
    {
        [$user, $tenantA] = $this->createMultiWorkspaceUser();
        $other = Tenant::factory()->create(['database' => 'tenant_switch_forbidden']);

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenantA->id]);
        $tenantA->makeCurrent();

        $this->from(Domain::portal())
            ->post(Domain::portal('/workspaces/switch'), [
                'tenant_id' => $other->id,
            ])
            ->assertSessionHasErrors('tenant_id');

        $this->assertSame($tenantA->id, session(TenantContext::SESSION_TENANT_ID));
    }

    /**
     * @return array{0: User, 1: Tenant, 2: Tenant}
     */
    protected function createMultiWorkspaceUser(): array
    {
        $user = User::factory()->tenant()->create();

        $tenantA = Tenant::factory()->create([
            'name' => 'Alpha Realty',
            'database' => 'tenant_switch_alpha',
        ]);
        $tenantB = Tenant::factory()->create([
            'name' => 'Beta Homes',
            'database' => 'tenant_switch_beta',
        ]);

        TenantUser::factory()->create([
            'user_id' => $user->id,
            'tenant_id' => $tenantA->id,
            'status' => TenantMembershipStatus::Active,
        ]);
        TenantUser::factory()->create([
            'user_id' => $user->id,
            'tenant_id' => $tenantB->id,
            'status' => TenantMembershipStatus::Active,
        ]);

        return [$user, $tenantA, $tenantB];
    }
}

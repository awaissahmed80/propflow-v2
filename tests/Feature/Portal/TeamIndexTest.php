<?php

namespace Tests\Feature\Portal;

use App\Models\Team;
use App\Models\TeamUser;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class TeamIndexTest extends TestCase
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

    public function test_guest_cannot_view_teams_page(): void
    {
        $this->get(Domain::portal('/teams'))
            ->assertRedirect(Domain::auth());
    }

    public function test_authenticated_tenant_user_sees_teams_as_cards_payload(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_teams_index');

        $member = User::factory()->tenant()->create([
            'display_name' => 'Imran Nawaz',
        ]);
        TenantUser::factory()->create([
            'user_id' => $member->id,
            'tenant_id' => $tenant->id,
            'title' => 'Sales Exec',
        ]);

        $tenant->makeCurrent();
        $team = Team::query()->create([
            'title' => 'Sales North',
            'description' => 'North region closers',
            'color' => '#0f766e',
            'user_id' => $user->id,
        ]);
        TeamUser::query()->create([
            'team_id' => $team->id,
            'user_id' => $user->id,
            'is_lead' => true,
        ]);
        TeamUser::query()->create([
            'team_id' => $team->id,
            'user_id' => $member->id,
            'is_lead' => false,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/teams'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('teams/index', false)
            ->has('teams', 1)
            ->where('teams.0.title', 'Sales North')
            ->where('teams.0.code', $team->code)
            ->where('teams.0.leader.display_name', $user->display_name)
            ->where('teams.0.member_count', 2)
            ->has('formOptions.members')
        );

        Tenant::forgetCurrent();
    }

    public function test_teams_can_be_filtered_by_query(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_teams_filter');

        $tenant->makeCurrent();
        Team::query()->create([
            'title' => 'Sales North',
            'user_id' => $user->id,
        ]);
        Team::query()->create([
            'title' => 'Marketing Ops',
            'user_id' => $user->id,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/teams?q=Marketing'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('teams/index', false)
                ->has('teams', 1)
                ->where('teams.0.title', 'Marketing Ops')
                ->where('filters.q', 'Marketing')
            );

        Tenant::forgetCurrent();
    }

    /**
     * @return array{0: User, 1: Tenant, 2: TenantUser}
     */
    protected function createTenantUser(string $database): array
    {
        $user = User::factory()->tenant()->create();
        $tenant = Tenant::factory()->create(['database' => $database]);

        $membership = TenantUser::factory()->owner()->create([
            'user_id' => $user->id,
            'tenant_id' => $tenant->id,
            'title' => 'Admin',
        ]);

        return [$user, $tenant, $membership];
    }
}

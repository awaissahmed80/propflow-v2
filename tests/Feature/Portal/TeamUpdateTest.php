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

class TeamUpdateTest extends TestCase
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

    public function test_authenticated_tenant_user_can_update_team_membership(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_teams_update');
        $member = User::factory()->tenant()->create();
        TenantUser::factory()->create([
            'user_id' => $member->id,
            'tenant_id' => $tenant->id,
        ]);

        $tenant->makeCurrent();
        $team = Team::query()->create([
            'title' => 'Sales North',
            'user_id' => $actor->id,
            'color' => '#3847d0',
        ]);
        TeamUser::query()->create([
            'team_id' => $team->id,
            'user_id' => $actor->id,
            'is_lead' => true,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/teams/'.$team->id), [
            'title' => 'Sales Central',
            'description' => 'Updated focus',
            'color' => '#b45309',
            'leader_id' => $member->id,
            'member_ids' => [$actor->id, $member->id],
        ])->assertRedirect(Domain::portal('/teams'));

        $tenant->makeCurrent();
        $team->refresh();

        $this->assertSame('Sales Central', $team->title);
        $this->assertSame('Updated focus', $team->description);
        $this->assertSame('#b45309', $team->color);
        $this->assertSame($member->id, $team->user_id);
        $this->assertTrue(
            TeamUser::query()
                ->where('team_id', $team->id)
                ->where('user_id', $member->id)
                ->where('is_lead', true)
                ->exists()
        );

        Tenant::forgetCurrent();
    }

    public function test_leader_is_required_when_updating_team(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_teams_update_lead');

        $tenant->makeCurrent();
        $team = Team::query()->create([
            'title' => 'Sales North',
            'user_id' => $actor->id,
            'color' => '#3847d0',
        ]);
        TeamUser::query()->create([
            'team_id' => $team->id,
            'user_id' => $actor->id,
            'is_lead' => true,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/teams/'.$team->id), [
            'title' => 'Sales North',
            'member_ids' => [$actor->id],
        ])->assertSessionHasErrors('leader_id');

        Tenant::forgetCurrent();
    }

    /**
     * @return array{0: User, 1: Tenant}
     */
    protected function createTenantUser(string $database): array
    {
        $user = User::factory()->tenant()->create();
        $tenant = Tenant::factory()->create(['database' => $database]);

        TenantUser::factory()->owner()->create([
            'user_id' => $user->id,
            'tenant_id' => $tenant->id,
        ]);

        return [$user, $tenant];
    }
}

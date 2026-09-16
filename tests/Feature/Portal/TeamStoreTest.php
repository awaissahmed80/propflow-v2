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

class TeamStoreTest extends TestCase
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

    public function test_guest_cannot_store_team(): void
    {
        $this->post(Domain::portal('/teams'), [
            'title' => 'Sales North',
        ])->assertRedirect(Domain::auth());
    }

    public function test_authenticated_tenant_user_can_create_team_with_lead_and_members(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_teams_store');
        $member = User::factory()->tenant()->create();
        TenantUser::factory()->create([
            'user_id' => $member->id,
            'tenant_id' => $tenant->id,
            'title' => 'Sales Exec',
        ]);

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->post(Domain::portal('/teams'), [
            'title' => 'Sales North',
            'description' => 'North region',
            'color' => '#0f766e',
            'leader_id' => $actor->id,
            'member_ids' => [$member->id],
        ]);

        $response->assertRedirect(Domain::portal('/teams'));

        $tenant->makeCurrent();
        $team = Team::query()->where('title', 'Sales North')->first();

        $this->assertNotNull($team);
        $this->assertSame('#0f766e', $team->color);
        $this->assertSame($actor->id, $team->user_id);
        $this->assertNotEmpty($team->code);
        $this->assertEqualsCanonicalizing(
            [$actor->id, $member->id],
            TeamUser::query()->where('team_id', $team->id)->pluck('user_id')->all()
        );
        $this->assertTrue(
            TeamUser::query()
                ->where('team_id', $team->id)
                ->where('user_id', $actor->id)
                ->where('is_lead', true)
                ->exists()
        );

        Tenant::forgetCurrent();
    }

    public function test_title_is_required(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_teams_store_validation');

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/teams'), [
            'title' => '',
        ])->assertSessionHasErrors('title');

        Tenant::forgetCurrent();
    }

    public function test_leader_is_required_when_creating_team(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_teams_store_lead');

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/teams'), [
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
            'title' => 'Admin',
        ]);

        return [$user, $tenant];
    }
}

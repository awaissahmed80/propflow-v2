<?php

namespace Tests\Feature\Portal;

use App\Models\Campaign;
use App\Models\CampaignGoalType;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class CampaignGoalTypeSettingsTest extends TestCase
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

    public function test_campaign_goal_type_can_be_created(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_campaign_goal_store');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/settings/campaign-goals'), [
            'title' => 'Site Visits',
            'color' => '#F59E0B',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $goal = CampaignGoalType::query()->where('title', 'Site Visits')->first();
        $this->assertNotNull($goal);
        $this->assertSame('site_visits', $goal->label);
        $this->assertSame('#F59E0B', $goal->color);
        Tenant::forgetCurrent();
    }

    public function test_campaign_goal_type_can_be_updated(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_campaign_goal_update');

        $tenant->makeCurrent();
        $goal = CampaignGoalType::factory()->create([
            'title' => 'Total Leads',
            'label' => 'total_leads',
            'priority' => 1,
            'color' => '#64748B',
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/settings/campaign-goals/'.$goal->label), [
            'title' => 'All Leads',
            'color' => '#EF4444',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $goal->refresh();
        $this->assertSame('All Leads', $goal->title);
        $this->assertSame('#EF4444', $goal->color);
        Tenant::forgetCurrent();
    }

    public function test_campaign_goal_types_can_be_reordered(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_campaign_goal_reorder');

        $tenant->makeCurrent();
        $first = CampaignGoalType::factory()->create(['title' => 'A', 'label' => 'a', 'priority' => 1]);
        $second = CampaignGoalType::factory()->create(['title' => 'B', 'label' => 'b', 'priority' => 2]);
        $third = CampaignGoalType::factory()->create(['title' => 'C', 'label' => 'c', 'priority' => 3]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/settings/campaign-goals/reorder'), [
            'order' => [$third->id, $first->id, $second->id],
        ])->assertRedirect();

        $tenant->makeCurrent();
        $this->assertSame(1, (int) $third->fresh()->priority);
        $this->assertSame(2, (int) $first->fresh()->priority);
        $this->assertSame(3, (int) $second->fresh()->priority);
        Tenant::forgetCurrent();
    }

    public function test_deleting_goal_type_removes_key_from_campaigns(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_campaign_goal_delete');

        $tenant->makeCurrent();
        $keep = CampaignGoalType::factory()->create(['title' => 'Keep', 'label' => 'keep', 'priority' => 1]);
        $drop = CampaignGoalType::factory()->create(['title' => 'Drop', 'label' => 'drop', 'priority' => 2]);
        $campaign = Campaign::factory()->create([
            'goals' => [
                'keep' => ['enabled' => true, 'target' => 10],
                'drop' => ['enabled' => true, 'target' => 5],
            ],
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->delete(Domain::portal('/settings/campaign-goals/'.$drop->label))
            ->assertRedirect();

        $tenant->makeCurrent();
        $this->assertNull(CampaignGoalType::query()->find($drop->id));
        $this->assertSame(1, (int) $keep->fresh()->priority);

        $campaign->refresh();
        $this->assertArrayHasKey('keep', $campaign->goals);
        $this->assertArrayNotHasKey('drop', $campaign->goals);
        Tenant::forgetCurrent();
    }

    public function test_last_campaign_goal_cannot_be_deleted(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_campaign_goal_delete_last');

        $tenant->makeCurrent();
        $goal = CampaignGoalType::factory()->create([
            'title' => 'Only',
            'label' => 'only',
            'priority' => 1,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/settings/campaigns'))
            ->delete(Domain::portal('/settings/campaign-goals/'.$goal->label))
            ->assertRedirect(Domain::portal('/settings/campaigns'))
            ->assertSessionHasErrors('goal_type');

        $tenant->makeCurrent();
        $this->assertNotNull(CampaignGoalType::query()->find($goal->id));
        Tenant::forgetCurrent();
    }

    public function test_settings_campaigns_section_loads_goal_types(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_campaign_goal_settings');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/settings/campaigns'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('settings/index', false)
                ->where('section', 'campaigns')
                ->has('campaignGoalTypes', 4)
            );
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

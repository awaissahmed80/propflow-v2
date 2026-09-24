<?php

namespace Tests\Unit;

use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\LeadScoreCalculator;
use Tests\TestCase;

class LeadScoreCalculatorTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->migrateLandlord();
        $this->migrateTenant();
    }

    public function test_closed_won_and_closed_lost_cap_scores(): void
    {
        [$tenant] = $this->bootTenant('tenant_score_caps');
        $calculator = app(LeadScoreCalculator::class);

        $wonStage = LeadStage::factory()->create([
            'label' => 'closed_won',
            'title' => 'Closed Won',
            'priority' => 6,
        ]);
        $lostStage = LeadStage::factory()->create([
            'label' => 'closed_lost',
            'title' => 'Closed Lost',
            'priority' => 7,
        ]);

        $won = Lead::factory()->create([
            'lead_stage_id' => $wonStage->id,
            'tag' => Lead::TAG_COLD,
            'budget' => 0,
        ]);
        $lost = Lead::factory()->create([
            'lead_stage_id' => $lostStage->id,
            'tag' => Lead::TAG_VERY_HOT,
            'budget' => 9_000_000,
        ]);

        $this->assertSame(98, $calculator->score($won->load('stage')));
        $this->assertSame(5, $calculator->score($lost->load('stage')));

        Tenant::forgetCurrent();
        unset($tenant);
    }

    public function test_hotter_leads_score_higher_than_colder_at_same_stage(): void
    {
        [$tenant] = $this->bootTenant('tenant_score_heat');
        $calculator = app(LeadScoreCalculator::class);

        $stage = LeadStage::factory()->create([
            'label' => 'qualified',
            'title' => 'Qualified',
            'priority' => 3,
        ]);

        $hot = Lead::factory()->create([
            'lead_stage_id' => $stage->id,
            'tag' => Lead::TAG_VERY_HOT,
            'budget' => 1_000_000,
            'next_action' => 'Follow-up',
            'due_date' => now()->addDay(),
            'contacted_at' => now(),
        ]);
        $cold = Lead::factory()->create([
            'lead_stage_id' => $stage->id,
            'tag' => Lead::TAG_VERY_COLD,
            'budget' => 1_000_000,
            'next_action' => 'Follow-up',
            'due_date' => now()->addDay(),
            'contacted_at' => now(),
        ]);

        $hotScore = $calculator->score($hot->load('stage'));
        $coldScore = $calculator->score($cold->load('stage'));

        $this->assertGreaterThan($coldScore, $hotScore);

        Tenant::forgetCurrent();
        unset($tenant);
    }

    public function test_overdue_follow_up_lowers_score_versus_upcoming_due(): void
    {
        [$tenant] = $this->bootTenant('tenant_score_due');
        $calculator = app(LeadScoreCalculator::class);

        $stage = LeadStage::factory()->create([
            'label' => 'contacted',
            'title' => 'Contacted',
            'priority' => 2,
        ]);

        $overdue = Lead::factory()->create([
            'lead_stage_id' => $stage->id,
            'tag' => Lead::TAG_MODERATE,
            'budget' => 500_000,
            'next_action' => 'Follow-up',
            'due_date' => now()->subDays(3),
            'contacted_at' => now()->subDays(10),
        ]);
        $upcoming = Lead::factory()->create([
            'lead_stage_id' => $stage->id,
            'tag' => Lead::TAG_MODERATE,
            'budget' => 500_000,
            'next_action' => 'Follow-up',
            'due_date' => now()->addDays(2),
            'contacted_at' => now()->subDays(10),
        ]);

        $this->assertGreaterThan(0, $calculator->score($overdue->load('stage')));
        $this->assertGreaterThan(
            $calculator->score($overdue->load('stage')),
            $calculator->score($upcoming->load('stage')),
        );

        Tenant::forgetCurrent();
        unset($tenant);
    }

    public function test_engagement_is_higher_when_recently_contacted(): void
    {
        [$tenant] = $this->bootTenant('tenant_score_engagement');
        $calculator = app(LeadScoreCalculator::class);

        $stage = LeadStage::factory()->newLead()->create();

        $fresh = Lead::factory()->create([
            'lead_stage_id' => $stage->id,
            'contacted_at' => now(),
            'next_action' => 'Arrange Site Visit',
        ]);
        $stale = Lead::factory()->create([
            'lead_stage_id' => $stage->id,
            'contacted_at' => now()->subDays(45),
            'next_action' => null,
        ]);

        $this->assertGreaterThan(0, $calculator->engagement($stale));
        $this->assertGreaterThan(
            $calculator->engagement($stale),
            $calculator->engagement($fresh),
        );

        Tenant::forgetCurrent();
        unset($tenant);
    }

    /**
     * @return array{0: Tenant, 1: User}
     */
    protected function bootTenant(string $database): array
    {
        $user = User::factory()->tenant()->create();
        $tenant = Tenant::factory()->create(['database' => $database]);

        TenantUser::factory()->owner()->create([
            'user_id' => $user->id,
            'tenant_id' => $tenant->id,
        ]);

        $tenant->makeCurrent();

        return [$tenant, $user];
    }
}

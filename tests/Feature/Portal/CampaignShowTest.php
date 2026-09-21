<?php

namespace Tests\Feature\Portal;

use App\Models\Campaign;
use App\Models\CampaignForm;
use App\Models\CampaignGoalType;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class CampaignShowTest extends TestCase
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

    public function test_campaign_show_includes_insights_and_tools_payload(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_campaign_show');

        $tenant->makeCurrent();
        CampaignGoalType::ensureDefaults();
        $stage = LeadStage::factory()->newLead()->create();
        $form = CampaignForm::factory()->create();
        $campaign = Campaign::factory()->create([
            'title' => 'Launch Insights',
            'campaign_form_id' => $form->id,
            'goals' => [
                'total_leads' => ['enabled' => true, 'target' => 50],
                'qualified_leads' => ['enabled' => false, 'target' => 0],
                'engagement' => ['enabled' => false, 'target' => 0],
                'closed_deals' => ['enabled' => false, 'target' => 0],
            ],
        ]);
        Lead::factory()->count(3)->create([
            'campaign_id' => $campaign->id,
            'lead_stage_id' => $stage->id,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/campaigns/'.$campaign->slug))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('campaigns/details', false)
                ->where('campaign.title', 'Launch Insights')
                ->where('campaign.slug', $campaign->slug)
                ->where(
                    'campaign.landing_url',
                    Domain::campaign('/'.$tenant->identifier.'/c/'.$campaign->slug)
                )
                ->where('insights.leads_count', 3)
                ->where('insights.submissions_count', 0)
                ->has('insights.goals')
                ->has('form')
                ->has('formOptions')
                ->has('campaign.gallery')
                ->where('campaign.hero_image_id', null)
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

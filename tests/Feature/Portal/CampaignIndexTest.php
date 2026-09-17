<?php

namespace Tests\Feature\Portal;

use App\Models\Campaign;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CampaignIndexTest extends TestCase
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

    public function test_campaigns_index_lists_campaigns(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_campaign_index');

        $tenant->makeCurrent();
        $campaign = Campaign::factory()->create(['title' => 'Launch Week']);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/campaigns'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('campaigns/index')
                ->has('campaigns', 1)
                ->where('campaigns.0.id', $campaign->id)
                ->where('campaigns.0.title', 'Launch Week')
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

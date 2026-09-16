<?php

namespace Tests\Feature\Portal;

use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Project;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class LeadDestroyTest extends TestCase
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

    public function test_lead_can_be_soft_deleted(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_destroy');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        $stage = LeadStage::factory()->newLead()->create();
        $lead = Lead::factory()->create([
            'project_id' => $project->id,
            'lead_stage_id' => $stage->id,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->delete(Domain::portal('/leads/'.$lead->id));

        $response->assertRedirect(Domain::portal('/leads'));

        $tenant->makeCurrent();
        $this->assertSoftDeleted('leads', ['id' => $lead->id], 'tenant');
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

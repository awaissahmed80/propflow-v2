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
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class LeadArchiveTest extends TestCase
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

    public function test_archived_leads_are_hidden_from_pipeline_and_shown_in_archive_view(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_archive_index');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $active = Lead::factory()->create([
            'lead_stage_id' => $stage->id,
            'budget' => 1000,
        ]);
        $archived = Lead::factory()->archived()->create([
            'lead_stage_id' => $stage->id,
            'budget' => 5000,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/leads?view=kanban'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('leads/index')
                ->where('view', 'kanban')
                ->where('pagination.total', 1)
                ->has('leads', 1)
                ->where('leads.0.id', $active->id)
            );

        $this->get(Domain::portal('/leads?view=archive'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('leads/index')
                ->where('view', 'archive')
                ->where('pagination.total', 1)
                ->has('leads', 1)
                ->where('leads.0.id', $archived->id)
                ->where('leads.0.archived_at', fn ($value) => filled($value))
            );
    }

    public function test_lead_can_be_archived(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_archive');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $lead = Lead::factory()->create(['lead_stage_id' => $stage->id]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/leads'))
            ->post(Domain::portal('/leads/'.$lead->code.'/archive'))
            ->assertRedirect(Domain::portal('/leads'));

        $tenant->makeCurrent();
        $lead->refresh();
        $this->assertNotNull($lead->archived_at);
        $this->assertSame($stage->id, $lead->lead_stage_id);
        Tenant::forgetCurrent();
    }

    public function test_archived_lead_can_be_restored_to_pipeline(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_restore');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $lead = Lead::factory()->archived()->create(['lead_stage_id' => $stage->id]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/leads?view=archive'))
            ->post(Domain::portal('/leads/'.$lead->code.'/restore'))
            ->assertRedirect(Domain::portal('/leads?view=archive'));

        $tenant->makeCurrent();
        $lead->refresh();
        $this->assertNull($lead->archived_at);
        $this->assertSame($stage->id, $lead->lead_stage_id);
        Tenant::forgetCurrent();
    }

    public function test_restore_assigns_default_stage_when_stage_is_missing(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_restore_fallback');

        $tenant->makeCurrent();
        $newStage = LeadStage::factory()->newLead()->create();
        $lead = Lead::factory()->archived()->create([
            'lead_stage_id' => null,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/leads/'.$lead->code.'/restore'))
            ->assertRedirect();

        $tenant->makeCurrent();
        $lead->refresh();
        $this->assertNull($lead->archived_at);
        $this->assertSame($newStage->id, $lead->lead_stage_id);
        Tenant::forgetCurrent();
    }

    public function test_active_lead_cannot_be_deleted(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_destroy_blocked');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $lead = Lead::factory()->create(['lead_stage_id' => $stage->id]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/leads'))
            ->delete(Domain::portal('/leads/'.$lead->code))
            ->assertRedirect(Domain::portal('/leads'))
            ->assertSessionHasErrors('lead');

        $tenant->makeCurrent();
        $this->assertDatabaseHas('leads', ['id' => $lead->id, 'deleted_at' => null], 'tenant');
        Tenant::forgetCurrent();
    }

    public function test_archived_lead_can_be_hard_deleted(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_destroy_archived');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $lead = Lead::factory()->archived()->create([
            'project_id' => Project::factory(),
            'lead_stage_id' => $stage->id,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->delete(Domain::portal('/leads/'.$lead->code))
            ->assertRedirect(Domain::portal('/leads?view=archive'));

        $tenant->makeCurrent();
        $this->assertDatabaseMissing('leads', ['id' => $lead->id], 'tenant');
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

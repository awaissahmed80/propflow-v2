<?php

namespace Tests\Feature\Portal;

use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class LeadStageSettingsTest extends TestCase
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

    public function test_lead_stage_can_be_created(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_stage_store');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/settings/stages'), [
            'title' => 'Negotiation',
            'color' => '#F59E0B',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $stage = LeadStage::query()->where('title', 'Negotiation')->first();
        $this->assertNotNull($stage);
        $this->assertSame('negotiation', $stage->label);
        $this->assertSame('#F59E0B', $stage->color);
        Tenant::forgetCurrent();
    }

    public function test_lead_stage_can_be_updated(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_stage_update');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->create([
            'title' => 'Qualified',
            'label' => 'qualified',
            'priority' => 1,
            'color' => '#64748B',
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/settings/stages/'.$stage->id), [
            'title' => 'Hot Prospect',
            'color' => '#EF4444',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $stage->refresh();
        $this->assertSame('Hot Prospect', $stage->title);
        $this->assertSame('#EF4444', $stage->color);
        Tenant::forgetCurrent();
    }

    public function test_lead_stages_can_be_reordered(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_stage_reorder');

        $tenant->makeCurrent();
        $first = LeadStage::factory()->create(['title' => 'A', 'label' => 'a', 'priority' => 1]);
        $second = LeadStage::factory()->create(['title' => 'B', 'label' => 'b', 'priority' => 2]);
        $third = LeadStage::factory()->create(['title' => 'C', 'label' => 'c', 'priority' => 3]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/settings/stages/reorder'), [
            'order' => [$third->id, $first->id, $second->id],
        ])->assertRedirect();

        $tenant->makeCurrent();
        $this->assertSame(1, (int) $third->fresh()->priority);
        $this->assertSame(2, (int) $first->fresh()->priority);
        $this->assertSame(3, (int) $second->fresh()->priority);
        Tenant::forgetCurrent();
    }

    public function test_deleting_stage_archives_its_leads_and_removes_stage(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_stage_delete_archive');

        $tenant->makeCurrent();
        $keep = LeadStage::factory()->create(['title' => 'Keep', 'label' => 'keep', 'priority' => 1]);
        $drop = LeadStage::factory()->create(['title' => 'Drop', 'label' => 'drop', 'priority' => 2]);
        $activeLead = Lead::factory()->create(['lead_stage_id' => $drop->id]);
        $alreadyArchived = Lead::factory()->archived()->create(['lead_stage_id' => $drop->id]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->delete(Domain::portal('/settings/stages/'.$drop->id))
            ->assertRedirect();

        $tenant->makeCurrent();
        $this->assertNull(LeadStage::query()->find($drop->id));
        $this->assertSame(1, (int) $keep->fresh()->priority);

        $activeLead->refresh();
        $this->assertNotNull($activeLead->archived_at);

        $alreadyArchived->refresh();
        $this->assertNotNull($alreadyArchived->archived_at);
        Tenant::forgetCurrent();
    }

    public function test_last_pipeline_stage_cannot_be_deleted(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_stage_delete_last');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->create([
            'title' => 'Only',
            'label' => 'only',
            'priority' => 1,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/settings/pipeline'))
            ->delete(Domain::portal('/settings/stages/'.$stage->id))
            ->assertRedirect(Domain::portal('/settings/pipeline'))
            ->assertSessionHasErrors('stage');

        $tenant->makeCurrent();
        $this->assertNotNull(LeadStage::query()->find($stage->id));
        Tenant::forgetCurrent();
    }

    public function test_lead_stage_can_be_duplicated_via_store(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_stage_duplicate');

        $tenant->makeCurrent();
        LeadStage::factory()->create([
            'title' => 'Qualified',
            'label' => 'qualified',
            'priority' => 1,
            'color' => '#FFB74D',
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/settings/stages'), [
            'title' => 'Qualified copy',
            'color' => '#FFB74D',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $copy = LeadStage::query()->where('title', 'Qualified copy')->first();
        $this->assertNotNull($copy);
        $this->assertSame('qualified_copy', $copy->label);
        $this->assertSame('#FFB74D', $copy->color);
        $this->assertSame(2, (int) $copy->priority);
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

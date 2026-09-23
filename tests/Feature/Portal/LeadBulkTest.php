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

class LeadBulkTest extends TestCase
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

    public function test_bulk_can_archive_active_leads(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_bulk_archive');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $leads = Lead::factory()->count(3)->create(['lead_stage_id' => $stage->id]);
        $ids = $leads->pluck('id')->all();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/leads'))
            ->post(Domain::portal('/leads/bulk'), [
                'ids' => $ids,
                'action' => 'archive',
            ])
            ->assertRedirect(Domain::portal('/leads'));

        $tenant->makeCurrent();
        foreach ($ids as $id) {
            $this->assertNotNull(Lead::query()->find($id)?->archived_at);
        }
        Tenant::forgetCurrent();
    }

    public function test_bulk_can_restore_archived_leads(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_bulk_restore');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $leads = Lead::factory()->count(2)->archived()->create(['lead_stage_id' => $stage->id]);
        $ids = $leads->pluck('id')->all();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/leads?view=archive'))
            ->post(Domain::portal('/leads/bulk'), [
                'ids' => $ids,
                'action' => 'restore',
            ])
            ->assertRedirect(Domain::portal('/leads?view=archive'));

        $tenant->makeCurrent();
        foreach ($ids as $id) {
            $this->assertNull(Lead::query()->find($id)?->archived_at);
        }
        Tenant::forgetCurrent();
    }

    public function test_bulk_destroy_only_deletes_archived_leads(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_bulk_destroy');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $active = Lead::factory()->create(['lead_stage_id' => $stage->id]);
        $archived = Lead::factory()->archived()->create(['lead_stage_id' => $stage->id]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/leads?view=archive'))
            ->post(Domain::portal('/leads/bulk'), [
                'ids' => [$active->id, $archived->id],
                'action' => 'destroy',
            ])
            ->assertRedirect(Domain::portal('/leads?view=archive'));

        $tenant->makeCurrent();
        $this->assertDatabaseHas('leads', ['id' => $active->id, 'deleted_at' => null], 'tenant');
        $this->assertDatabaseMissing('leads', ['id' => $archived->id], 'tenant');
        Tenant::forgetCurrent();
    }

    public function test_bulk_can_assign_leads(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_bulk_assign');
        $assignee = User::factory()->tenant()->create();

        TenantUser::factory()->create([
            'user_id' => $assignee->id,
            'tenant_id' => $tenant->id,
        ]);

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $leads = Lead::factory()->count(2)->create([
            'lead_stage_id' => $stage->id,
            'assigned_to' => $user->id,
        ]);
        $ids = $leads->pluck('id')->all();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/leads'))
            ->post(Domain::portal('/leads/bulk'), [
                'ids' => $ids,
                'action' => 'assign',
                'assigned_to' => $assignee->id,
            ])
            ->assertRedirect(Domain::portal('/leads'));

        $tenant->makeCurrent();
        foreach ($ids as $id) {
            $this->assertSame($assignee->id, Lead::query()->find($id)?->assigned_to);
        }
        Tenant::forgetCurrent();
    }

    public function test_bulk_can_move_active_leads_to_stage(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_bulk_stage');

        $tenant->makeCurrent();
        $newStage = LeadStage::factory()->newLead()->create();
        $qualified = LeadStage::factory()->create([
            'label' => 'qualified',
            'title' => 'Qualified',
            'priority' => 2,
        ]);
        $active = Lead::factory()->create(['lead_stage_id' => $newStage->id]);
        $archived = Lead::factory()->archived()->create(['lead_stage_id' => $newStage->id]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/leads'))
            ->post(Domain::portal('/leads/bulk'), [
                'ids' => [$active->id, $archived->id],
                'action' => 'stage',
                'lead_stage_id' => $qualified->id,
            ])
            ->assertRedirect(Domain::portal('/leads'));

        $tenant->makeCurrent();
        $this->assertSame($qualified->id, Lead::query()->find($active->id)?->lead_stage_id);
        $this->assertSame($newStage->id, Lead::query()->find($archived->id)?->lead_stage_id);
        Tenant::forgetCurrent();
    }

    public function test_bulk_requires_ids_and_valid_action(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_bulk_validation');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/leads'))
            ->post(Domain::portal('/leads/bulk'), [
                'ids' => [],
                'action' => 'nope',
            ])
            ->assertRedirect(Domain::portal('/leads'))
            ->assertSessionHasErrors(['ids', 'action']);
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

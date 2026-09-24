<?php

namespace Tests\Feature\Portal;

use App\Models\Lead;
use App\Models\LeadShare;
use App\Models\LeadStage;
use App\Models\Task;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class LeadShareTest extends TestCase
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

    public function test_lead_shares_can_be_synced_for_tenant_members(): void
    {
        [$owner, $tenant] = $this->createTenantUser('tenant_lead_share_sync');
        $member = User::factory()->tenant()->create(['display_name' => 'Shared Member']);
        TenantUser::factory()->create([
            'user_id' => $member->id,
            'tenant_id' => $tenant->id,
        ]);

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $lead = Lead::factory()->create([
            'lead_stage_id' => $stage->id,
            'user_id' => $owner->id,
            'assigned_to' => $owner->id,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($owner);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->from(Domain::portal('/leads?lead='.$lead->code))
            ->put(Domain::portal('/leads/'.$lead->code.'/shares'), [
                'user_ids' => [$member->id],
            ]);

        $response->assertRedirect(Domain::portal('/leads?lead='.$lead->code));

        $tenant->makeCurrent();
        $this->assertDatabaseHas('lead_shares', [
            'lead_id' => $lead->id,
            'user_id' => $member->id,
        ], 'tenant');

        $log = Task::query()
            ->where('taskable_type', Lead::class)
            ->where('taskable_id', $lead->id)
            ->where('action', 'Lead shared')
            ->first();

        $this->assertNotNull($log);
        $this->assertSame(Task::TYPE_LOG, $log->type);
        $this->assertStringContainsString('Shared Member', (string) $log->comments);
        Tenant::forgetCurrent();
    }

    public function test_owner_and_assignee_are_stripped_from_shares(): void
    {
        [$owner, $tenant] = $this->createTenantUser('tenant_lead_share_strip');
        $assignee = User::factory()->tenant()->create(['display_name' => 'Assignee']);
        $member = User::factory()->tenant()->create(['display_name' => 'Collaborator']);
        TenantUser::factory()->create([
            'user_id' => $assignee->id,
            'tenant_id' => $tenant->id,
        ]);
        TenantUser::factory()->create([
            'user_id' => $member->id,
            'tenant_id' => $tenant->id,
        ]);

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $lead = Lead::factory()->create([
            'lead_stage_id' => $stage->id,
            'user_id' => $owner->id,
            'assigned_to' => $assignee->id,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($owner);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/leads'))
            ->put(Domain::portal('/leads/'.$lead->code.'/shares'), [
                'user_ids' => [$owner->id, $assignee->id, $member->id],
            ])
            ->assertRedirect(Domain::portal('/leads'));

        $tenant->makeCurrent();
        $shareIds = LeadShare::query()
            ->where('lead_id', $lead->id)
            ->pluck('user_id')
            ->map(fn ($id): int => (int) $id)
            ->sort()
            ->values()
            ->all();

        $this->assertSame([(int) $member->id], $shareIds);
        Tenant::forgetCurrent();
    }

    public function test_non_member_user_ids_are_rejected(): void
    {
        [$owner, $tenant] = $this->createTenantUser('tenant_lead_share_reject');
        $outsider = User::factory()->tenant()->create();

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $lead = Lead::factory()->create([
            'lead_stage_id' => $stage->id,
            'user_id' => $owner->id,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($owner);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/leads'))
            ->put(Domain::portal('/leads/'.$lead->code.'/shares'), [
                'user_ids' => [$outsider->id],
            ])
            ->assertSessionHasErrors('user_ids.0');

        $tenant->makeCurrent();
        $this->assertSame(0, LeadShare::query()->where('lead_id', $lead->id)->count());
        Tenant::forgetCurrent();
    }

    public function test_opened_lead_includes_shared_users(): void
    {
        [$owner, $tenant] = $this->createTenantUser('tenant_lead_share_payload');
        $member = User::factory()->tenant()->create(['display_name' => 'Visible Share']);
        TenantUser::factory()->create([
            'user_id' => $member->id,
            'tenant_id' => $tenant->id,
        ]);

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $lead = Lead::factory()->create([
            'lead_stage_id' => $stage->id,
            'user_id' => $owner->id,
            'assigned_to' => $owner->id,
            'source' => 'Share test',
        ]);
        LeadShare::query()->create([
            'lead_id' => $lead->id,
            'user_id' => $member->id,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($owner);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/leads?lead='.$lead->code))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('leads/index', false)
                ->where('openedLead.id', $lead->id)
                ->where('openedLead.shared_users.0.id', $member->id)
                ->where('openedLead.shared_users.0.display_name', 'Visible Share')
                ->has('openedLead.shared_users.0.code')
            );
    }

    public function test_shares_can_be_cleared(): void
    {
        [$owner, $tenant] = $this->createTenantUser('tenant_lead_share_clear');
        $member = User::factory()->tenant()->create();
        TenantUser::factory()->create([
            'user_id' => $member->id,
            'tenant_id' => $tenant->id,
        ]);

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $lead = Lead::factory()->create([
            'lead_stage_id' => $stage->id,
            'user_id' => $owner->id,
        ]);
        LeadShare::query()->create([
            'lead_id' => $lead->id,
            'user_id' => $member->id,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($owner);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/leads'))
            ->put(Domain::portal('/leads/'.$lead->code.'/shares'), [
                'user_ids' => [],
            ])
            ->assertRedirect(Domain::portal('/leads'));

        $tenant->makeCurrent();
        $this->assertSame(0, LeadShare::query()->where('lead_id', $lead->id)->count());
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

<?php

namespace Tests\Feature\Portal;

use App\Models\Lead;
use App\Models\LeadActionType;
use App\Models\LeadStage;
use App\Models\Order;
use App\Models\Project;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\Unit;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class ClosedLeadLockTest extends TestCase
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

    public function test_active_booking_locks_lead_mutations_until_cancelled(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_lead_lock');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/leads/'.$lead->code.'/convert'), [
            'unit_id' => $unit->id,
            'booking_kind' => Order::KIND_TOKEN,
            'agreed_price' => 1000,
            'token_amount' => 200,
            'installment_count' => 1,
            'first_due_on' => '2026-11-01',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $order = Order::query()->first();
        $openStageId = LeadStage::factory()->newLead()->create()->id;
        Tenant::forgetCurrent();

        $this->get(Domain::portal('/leads'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('leads/index', false)
                ->where('leads.0.deal_locked', true)
                ->where('leads.0.active_order.code', $order->code)
            );

        $this->patch(Domain::portal('/leads/'.$lead->code), [
            'lead_stage_id' => $openStageId,
        ])->assertSessionHasErrors('lead');

        $this->post(Domain::portal('/leads/'.$lead->code.'/tasks'), [
            'action' => 'Call',
            'comments' => 'Should be blocked',
            'next_action' => Lead::NEXT_ACTION_FOLLOW_UP,
            'due_date' => now()->addDay()->toIso8601String(),
        ])->assertSessionHasErrors('lead');

        $this->post(Domain::portal('/leads/'.$lead->code.'/archive'))
            ->assertSessionHasErrors('lead');

        $this->post(Domain::portal('/bookings/'.$order->code.'/cancel'))->assertRedirect();

        $this->get(Domain::portal('/leads'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('leads/index', false)
                ->where('leads.0.deal_locked', false)
                ->where('leads.0.active_order', null)
            );

        $this->patch(Domain::portal('/leads/'.$lead->code), [
            'notes' => 'Unlocked after cancel',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $this->assertSame('Unlocked after cancel', $lead->fresh()->notes);
        Tenant::forgetCurrent();
    }

    /**
     * @return array{0: User, 1: Tenant, 2: Lead, 3: Unit}
     */
    protected function bookableLead(string $database): array
    {
        $user = User::factory()->tenant()->create();
        $tenant = Tenant::factory()->create(['database' => $database]);
        TenantUser::factory()->owner()->create([
            'user_id' => $user->id,
            'tenant_id' => $tenant->id,
        ]);

        $tenant->makeCurrent();
        LeadActionType::ensureDefaults();
        LeadStage::factory()->create([
            'label' => 'closed_won',
            'title' => 'Closed Won',
            'priority' => 9,
        ]);
        $project = Project::factory()->create();
        $unit = Unit::factory()->create([
            'project_id' => $project->id,
            'status' => Unit::STATUS_AVAILABLE,
            'price' => 1000000,
        ]);
        $lead = Lead::factory()->create([
            'project_id' => $project->id,
            'unit_id' => $unit->id,
            'assigned_to' => $user->id,
            'user_id' => $user->id,
            'lead_stage_id' => LeadStage::factory()->newLead(),
            'budget' => 500000,
        ]);
        Tenant::forgetCurrent();

        return [$user, $tenant, $lead, $unit];
    }
}

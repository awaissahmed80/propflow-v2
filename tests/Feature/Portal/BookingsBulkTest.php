<?php

namespace Tests\Feature\Portal;

use App\Models\Lead;
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

class BookingsBulkTest extends TestCase
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

    public function test_bulk_can_assign_bookings(): void
    {
        [$user, $tenant, $order] = $this->bookedOrder('tenant_booking_bulk_assign');
        $assignee = User::factory()->tenant()->create();

        TenantUser::factory()->create([
            'user_id' => $assignee->id,
            'tenant_id' => $tenant->id,
        ]);

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/bookings/bulk'), [
            'ids' => [$order->id],
            'action' => 'assign',
            'assigned_to' => $assignee->id,
        ])->assertRedirect();

        $tenant->makeCurrent();
        $this->assertSame($assignee->id, $order->fresh()->assigned_to);
        Tenant::forgetCurrent();
    }

    public function test_bulk_can_set_status(): void
    {
        [$user, $tenant, $order] = $this->bookedOrder('tenant_booking_bulk_status');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/bookings/bulk'), [
            'ids' => [$order->id],
            'action' => 'status',
            'status' => Order::STATUS_IN_PROGRESS,
        ])->assertRedirect();

        $tenant->makeCurrent();
        $this->assertSame(Order::STATUS_IN_PROGRESS, $order->fresh()->status);
        Tenant::forgetCurrent();
    }

    public function test_bulk_can_cancel_bookings(): void
    {
        [$user, $tenant, $order] = $this->bookedOrder('tenant_booking_bulk_cancel');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/bookings/bulk'), [
            'ids' => [$order->id],
            'action' => 'cancel',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $order->refresh();
        $this->assertSame(Order::STATUS_CANCELLED, $order->status);
        $this->assertSame(Order::STAGE_CLOSED, $order->stage);
        Tenant::forgetCurrent();
    }

    public function test_bookings_index_exposes_filters_and_balance(): void
    {
        [$user, $tenant, $order] = $this->bookedOrder('tenant_booking_filters');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/bookings?q='.$order->code.'&stage=token'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('bookings/index', false)
                ->has('filters')
                ->where('filters.q', $order->code)
                ->has('orderStatuses')
                ->has('orders.0.balance_due')
                ->where('orders.0.code', $order->code)
            );
    }

    public function test_bookings_search_matches_full_contact_name(): void
    {
        [$user, $tenant, $order] = $this->bookedOrder('tenant_booking_fullname_search');

        $tenant->makeCurrent();
        $order->load('contact');
        $order->contact->forceFill([
            'first_name' => 'Mali',
            'last_name' => 'Ibrar',
        ])->save();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/bookings?q='.rawurlencode('Mali Ibrar')))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('bookings/index', false)
                ->has('orders', 1)
                ->where('orders.0.code', $order->code)
            );
    }

    /**
     * @return array{0: User, 1: Tenant, 2: Order}
     */
    protected function bookedOrder(string $database): array
    {
        $user = User::factory()->tenant()->create();
        $tenant = Tenant::factory()->create(['database' => $database]);
        TenantUser::factory()->owner()->create([
            'user_id' => $user->id,
            'tenant_id' => $tenant->id,
        ]);

        $tenant->makeCurrent();
        LeadStage::factory()->create([
            'label' => 'closed_won',
            'title' => 'Closed Won',
            'priority' => 9,
        ]);
        $project = Project::factory()->create();
        $unit = Unit::factory()->create([
            'project_id' => $project->id,
            'status' => Unit::STATUS_AVAILABLE,
            'price' => 10000,
        ]);
        $lead = Lead::factory()->create([
            'project_id' => $project->id,
            'unit_id' => $unit->id,
            'assigned_to' => $user->id,
            'user_id' => $user->id,
            'lead_stage_id' => LeadStage::factory()->newLead(),
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/leads/'.$lead->code.'/convert'), [
            'unit_id' => $unit->id,
            'booking_kind' => Order::KIND_TOKEN,
            'agreed_price' => 5000,
            'token_amount' => 500,
            'installment_count' => 1,
            'first_due_on' => '2026-11-01',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $order = Order::query()->firstOrFail();
        Tenant::forgetCurrent();

        return [$user, $tenant, $order];
    }
}

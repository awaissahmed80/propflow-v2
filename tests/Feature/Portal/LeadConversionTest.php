<?php

namespace Tests\Feature\Portal;

use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Order;
use App\Models\PaymentInstallment;
use App\Models\Project;
use App\Models\Task;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\Unit;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class LeadConversionTest extends TestCase
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

    public function test_token_booking_creates_an_order_plan_and_installments(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_convert_token');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->post(Domain::portal('/leads/'.$lead->code.'/convert'), [
            'unit_id' => $unit->id,
            'booking_kind' => Order::KIND_TOKEN,
            'agreed_price' => 10.01,
            'token_amount' => 1,
            'installment_count' => 3,
            'first_due_on' => '2026-10-15',
        ]);

        $tenant->makeCurrent();
        $order = Order::query()->with('paymentPlan.installments')->first();
        $this->assertNotNull($order);
        Tenant::forgetCurrent();

        $response->assertRedirect(Domain::portal('/bookings?booking='.$order->code));

        $this->get(Domain::portal('/leads'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('leads/index', false)
                ->where('leads.0.active_order.code', $order->code)
            );

        $tenant->makeCurrent();
        $lead->refresh();
        $unit->refresh();
        $order->refresh();
        $order->load('paymentPlan.installments');

        $this->assertSame(LeadStage::query()->where('label', 'closed_won')->value('id'), $lead->lead_stage_id);
        $this->assertSame($unit->id, $lead->unit_id);
        $this->assertSame($unit->project_id, $lead->project_id);
        $this->assertSame(Unit::STATUS_TOKEN, $unit->status);
        $this->assertSame(Order::KIND_TOKEN, $order->booking_kind);
        $this->assertSame(Order::STATUS_BOOKED, $order->status);
        $this->assertSame($user->id, $order->assigned_to);
        $this->assertNotNull($order->booked_at);
        $this->assertSame('10.01', $order->agreed_price);
        $this->assertNotNull($order->paymentPlan);

        $rows = $order->paymentPlan->installments;
        $this->assertCount(4, $rows);
        $this->assertSame('Token', $rows[0]->label);
        $this->assertSame('1.00', $rows[0]->amount);
        $this->assertSame(now()->toDateString(), $rows[0]->due_on->toDateString());
        $this->assertSame('3.00', $rows[1]->amount);
        $this->assertSame('2026-10-15', $rows[1]->due_on->toDateString());
        $this->assertSame('3.00', $rows[2]->amount);
        $this->assertSame('2026-11-15', $rows[2]->due_on->toDateString());
        $this->assertSame('3.01', $rows[3]->amount);
        $this->assertSame('2026-12-15', $rows[3]->due_on->toDateString());
        $this->assertSame(
            1001,
            $rows->sum(fn (PaymentInstallment $row): int => (int) round(((float) $row->amount) * 100)),
        );
        $this->assertTrue(
            Task::query()->whereMorphedTo('taskable', $lead)->where('action', 'Deal booked')->exists(),
        );
        Tenant::forgetCurrent();
    }

    public function test_reserve_booking_splits_the_price_without_a_token_row(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_convert_reserve');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/leads/'.$lead->code.'/convert'), [
            'unit_id' => $unit->id,
            'booking_kind' => Order::KIND_RESERVE,
            'agreed_price' => 100,
            'installment_count' => 2,
            'first_due_on' => '2026-10-01',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $unit->refresh();
        $order = Order::query()->with('paymentPlan.installments')->first();
        $this->assertSame(Unit::STATUS_RESERVED, $unit->status);
        $this->assertSame(Order::KIND_RESERVE, $order->booking_kind);
        $this->assertCount(2, $order->paymentPlan->installments);
        $this->assertSame(['Installment 1', 'Installment 2'], $order->paymentPlan->installments->pluck('label')->all());
        $this->assertSame('50.00', $order->paymentPlan->installments[0]->amount);
        $this->assertSame('50.00', $order->paymentPlan->installments[1]->amount);
        Tenant::forgetCurrent();
    }

    public function test_sold_unit_and_a_second_active_order_are_rejected(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_convert_reject');

        $tenant->makeCurrent();
        $sold = Unit::factory()->sold()->create(['project_id' => $unit->project_id]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/leads/'.$lead->code.'/convert'), $this->payload($sold->id))
            ->assertSessionHasErrors('unit_id');

        $tenant->makeCurrent();
        $this->assertSame(0, Order::query()->count());
        Tenant::forgetCurrent();

        $this->post(Domain::portal('/leads/'.$lead->code.'/convert'), $this->payload($unit->id))
            ->assertRedirect();

        $this->post(Domain::portal('/leads/'.$lead->code.'/convert'), $this->payload($unit->id))
            ->assertSessionHasErrors('lead');

        $tenant->makeCurrent();
        $this->assertSame(1, Order::query()->count());
        Tenant::forgetCurrent();
    }

    public function test_cancelling_a_booking_releases_the_unit_and_allows_another_order(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_convert_cancel');
        $wonId = $lead->getAttribute('won_stage_id');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/leads/'.$lead->code.'/convert'), $this->payload($unit->id));

        $tenant->makeCurrent();
        $order = Order::query()->first();
        Tenant::forgetCurrent();

        $this->post(Domain::portal('/bookings/'.$order->code.'/cancel'))->assertRedirect();

        $tenant->makeCurrent();
        $order->refresh();
        $unit->refresh();
        $lead->refresh();
        $this->assertSame(Order::STATUS_CANCELLED, $order->status);
        $this->assertNotNull($order->cancelled_at);
        $this->assertSame(Unit::STATUS_AVAILABLE, $unit->status);
        $this->assertSame($wonId, $lead->lead_stage_id);
        $this->assertTrue(
            Task::query()->whereMorphedTo('taskable', $lead)->where('action', 'Booking cancelled')->exists(),
        );
        Tenant::forgetCurrent();

        $this->post(Domain::portal('/bookings/'.$order->code.'/allocate'))
            ->assertSessionHasErrors('order');

        $this->post(Domain::portal('/leads/'.$lead->code.'/convert'), $this->payload($unit->id))
            ->assertRedirect();

        $tenant->makeCurrent();
        $this->assertSame(2, Order::query()->count());
        $this->assertSame(1, Order::query()->whereIn('status', Order::activeStatuses())->count());
        Tenant::forgetCurrent();
    }

    public function test_payments_and_allocation_update_the_order_and_operations_pages(): void
    {
        [$user, $tenant, $lead, $unit, $membership] = $this->bookableLead('tenant_convert_allocate', withMembership: true);

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/leads/'.$lead->code.'/convert'), $this->payload($unit->id));

        $tenant->makeCurrent();
        $order = Order::query()->with('paymentPlan.installments')->first();
        $installment = $order->paymentPlan->installments->first();
        Tenant::forgetCurrent();

        $this->get(Domain::portal('/bookings'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('bookings/index', false)
                ->has('orders', 1)
                ->where('orders.0.code', $order->code)
                ->where('orders.0.status', Order::STATUS_BOOKED)
            );

        $this->get(Domain::portal('/bookings/'.$order->code))
            ->assertRedirect('/bookings?booking='.$order->code);

        $this->get(Domain::portal('/bookings?booking='.$order->code))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('bookings/index', false)
                ->where('openedBooking.order.code', $order->code)
                ->has('openedBooking.order.installments')
            );

        $this->get(Domain::portal('/receivables/installments'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('receivables/installments', false)
                ->has('installments', 2)
                ->where('installments.0.status', PaymentInstallment::STATUS_PENDING)
            );

        $this->get(Domain::portal('/bookings/allotment'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('bookings/allotment', false)
                ->has('orders', 1)
                ->where('orders.0.id', $order->id)
            );

        $this->post(Domain::portal('/bookings/'.$order->code.'/installments/'.$installment->sequence.'/pay'))
            ->assertRedirect();

        $tenant->makeCurrent();
        $installment->refresh();
        $this->assertSame(PaymentInstallment::STATUS_PAID, $installment->status);
        $this->assertNotNull($installment->paid_at);
        Tenant::forgetCurrent();

        $this->post(Domain::portal('/bookings/'.$order->code.'/installments/'.$installment->sequence.'/pay'))
            ->assertSessionHasErrors('installment');

        $this->post(Domain::portal('/bookings/'.$order->code.'/allocate'))->assertRedirect();

        $tenant->makeCurrent();
        $order->refresh();
        $unit->refresh();
        $this->assertSame(Order::STATUS_ALLOCATED, $order->status);
        $this->assertNotNull($order->allocated_at);
        $this->assertSame(Unit::STATUS_SOLD, $unit->status);
        $this->assertTrue(
            Task::query()->whereMorphedTo('taskable', $lead)->where('action', 'Unit allocated')->exists(),
        );
        Tenant::forgetCurrent();

        $this->get(Domain::portal('/bookings/allotment'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('bookings/allotment', false)
                ->has('orders', 0)
            );

        $this->get(Domain::portal('/users?user='.$membership->code))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('selectedUser.stats.closed_deals', 1)
            );
    }

    /**
     * @return array{unit_id: int, booking_kind: string, agreed_price: int, token_amount: int, installment_count: int, first_due_on: string}
     */
    protected function payload(int $unitId): array
    {
        return [
            'unit_id' => $unitId,
            'booking_kind' => Order::KIND_TOKEN,
            'agreed_price' => 1000,
            'token_amount' => 200,
            'installment_count' => 1,
            'first_due_on' => '2026-11-01',
        ];
    }

    /**
     * @return array{0: User, 1: Tenant, 2: Lead, 3: Unit, 4?: TenantUser}
     */
    protected function bookableLead(string $database, bool $withMembership = false): array
    {
        $user = User::factory()->tenant()->create();
        $tenant = Tenant::factory()->create(['database' => $database]);
        $membership = TenantUser::factory()->owner()->create([
            'user_id' => $user->id,
            'tenant_id' => $tenant->id,
        ]);

        $tenant->makeCurrent();
        $won = LeadStage::factory()->create([
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
        $lead->setAttribute('won_stage_id', $won->id);
        Tenant::forgetCurrent();

        if ($withMembership) {
            return [$user, $tenant, $lead, $unit, $membership];
        }

        return [$user, $tenant, $lead, $unit];
    }
}

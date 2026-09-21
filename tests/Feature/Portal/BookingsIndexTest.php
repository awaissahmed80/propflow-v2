<?php

namespace Tests\Feature\Portal;

use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Order;
use App\Models\PaymentPlanTemplate;
use App\Models\Project;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\Unit;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class BookingsIndexTest extends TestCase
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

    public function test_bookings_index_opens_panel_for_booking_query(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_bookings_panel');

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
        Tenant::forgetCurrent();

        $this->get(Domain::portal('/bookings/'.$order->code))
            ->assertRedirect('/bookings?booking='.$order->code);

        $this->get(Domain::portal('/bookings?booking='.$order->code))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('bookings/index', false)
                ->has('orders', 1)
                ->where('orders.0.code', $order->code)
                ->where('openedBooking.order.code', $order->code)
                ->where('openedBooking.deal.stage', Order::STAGE_BOOKING)
                ->has('openedBooking.deal.templates')
                ->has('openedBooking.order.lead')
                ->has('openedBooking.order.contact')
                ->has('openedBooking.order.sold_by')
            );
    }

    public function test_plan_stage_accepts_database_template_id(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_bookings_template');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/leads/'.$lead->code.'/convert'), [
            'unit_id' => $unit->id,
            'booking_kind' => Order::KIND_TOKEN,
            'agreed_price' => 10000,
            'token_amount' => 1000,
            'installment_count' => 1,
            'first_due_on' => '2026-11-01',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $order = Order::query()->first();
        $template = PaymentPlanTemplate::factory()->create([
            'title' => 'Project monthly',
            'project_id' => $unit->project_id,
            'frequency' => 'monthly',
            'installment_count' => 6,
            'down_payment_percent' => 10,
            'handover_percent' => 10,
        ]);
        Tenant::forgetCurrent();

        $this->post(Domain::portal('/bookings/'.$order->code.'/booking'), [
            'identity_kind' => 'cnic',
            'identity_number' => '42101-1234567-1',
            'nominee_name' => 'Sara',
            'nominee_relation' => 'Spouse',
            'nominee_cnic' => '42101-7654321-1',
            'plot_or_file' => 'F-1',
            'category' => 'standard',
            'premium' => 0,
            'discount' => 0,
        ])->assertRedirect();

        $this->post(Domain::portal('/bookings/'.$order->code.'/plan'), [
            'template_id' => $template->id,
            'down_payment' => 1000,
            'handover_percent' => 10,
            'first_due_on' => '2026-10-01',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $order->refresh();
        $order->load('paymentPlan');
        $this->assertSame(Order::STAGE_TRACKING, $order->stage);
        $this->assertSame('template:'.$template->id, $order->paymentPlan->template);
        $this->assertSame(6, (int) $order->paymentPlan->installment_count);
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

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

class UnitQuantityTest extends TestCase
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

    public function test_multi_quantity_unit_stays_available_when_booked_and_keeps_configured_quantity(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead(
            'tenant_unit_qty_multi',
            quantity: 3,
        );

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/leads/'.$lead->code.'/convert'), [
            'unit_id' => $unit->id,
            'booking_kind' => Order::KIND_TOKEN,
            'agreed_price' => 1000000,
            'token_amount' => 100000,
            'installment_count' => 2,
            'first_due_on' => now()->addDays(30)->toDateString(),
        ])->assertRedirect();

        $tenant->makeCurrent();
        $unit->refresh();
        $order = Order::query()->first();
        $this->assertSame(Unit::STATUS_AVAILABLE, $unit->status);
        $this->assertSame(3, (int) $unit->quantity);
        $this->assertSame(1, $unit->bookedCount());
        $this->assertSame(2, $unit->stock());
        Tenant::forgetCurrent();

        $this->post(Domain::portal('/bookings/'.$order->code.'/allocate'))->assertRedirect();

        $tenant->makeCurrent();
        $unit->refresh();
        $this->assertSame(3, (int) $unit->quantity);
        $this->assertSame(1, $unit->bookedCount());
        $this->assertSame(2, $unit->stock());
        $this->assertSame(Unit::STATUS_AVAILABLE, $unit->status);
        Tenant::forgetCurrent();
    }

    public function test_single_quantity_unit_is_reserved_then_sold_on_allocate(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead(
            'tenant_unit_qty_single',
            quantity: 1,
        );

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/leads/'.$lead->code.'/convert'), [
            'unit_id' => $unit->id,
            'booking_kind' => Order::KIND_RESERVE,
            'agreed_price' => 1000000,
            'installment_count' => 2,
            'first_due_on' => now()->addDays(30)->toDateString(),
        ])->assertRedirect();

        $tenant->makeCurrent();
        $unit->refresh();
        $order = Order::query()->first();
        $this->assertSame(Unit::STATUS_RESERVED, $unit->status);
        $this->assertSame(1, (int) $unit->quantity);
        $this->assertSame(0, $unit->stock());
        Tenant::forgetCurrent();

        $this->post(Domain::portal('/bookings/'.$order->code.'/allocate'))->assertRedirect();

        $tenant->makeCurrent();
        $unit->refresh();
        $this->assertSame(1, (int) $unit->quantity);
        $this->assertSame(0, $unit->stock());
        $this->assertSame(Unit::STATUS_SOLD, $unit->status);
        Tenant::forgetCurrent();
    }

    public function test_unit_quantity_can_be_updated(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_unit_qty_update');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        $unit = Unit::factory()->create([
            'project_id' => $project->id,
            'quantity' => 2,
        ]);
        $code = $unit->code;
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/units/'.$code), [
            'project_id' => $project->id,
            'quantity' => 8,
        ])->assertRedirect(Domain::portal('/inventory'));

        $tenant->makeCurrent();
        $unit->refresh();
        $this->assertSame(8, (int) $unit->quantity);
        $this->assertSame(8, $unit->stock());
        Tenant::forgetCurrent();
    }

    public function test_inventory_payload_includes_remaining_from_bookings(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_unit_qty_inventory');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        $unit = Unit::factory()->create([
            'project_id' => $project->id,
            'name' => 'Bulk-A',
            'quantity' => 5,
            'status' => Unit::STATUS_AVAILABLE,
        ]);
        Order::factory()->create([
            'project_id' => $project->id,
            'unit_id' => $unit->id,
            'status' => Order::STATUS_IN_PROGRESS,
            'stage' => Order::STAGE_BOOKING_KYC,
        ]);
        Order::factory()->create([
            'project_id' => $project->id,
            'unit_id' => $unit->id,
            'status' => Order::STATUS_CANCELLED,
            'stage' => Order::STAGE_CLOSED,
            'cancelled_at' => now(),
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/inventory'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('inventory/index', false)
                ->where('units.0.code', $unit->code)
                ->where('units.0.quantity', 5)
                ->where('units.0.remaining', 4)
            );
    }

    /**
     * @return array{0: User, 1: Tenant, 2: Lead, 3: Unit}
     */
    protected function bookableLead(string $database, int $quantity = 1): array
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
        $openStage = LeadStage::factory()->newLead()->create();
        $project = Project::factory()->create();
        $unit = Unit::factory()->create([
            'project_id' => $project->id,
            'status' => Unit::STATUS_AVAILABLE,
            'quantity' => $quantity,
            'price' => 1000000,
        ]);
        $lead = Lead::factory()->create([
            'project_id' => $project->id,
            'unit_id' => $unit->id,
            'lead_stage_id' => $openStage->id,
            'assigned_to' => $user->id,
            'user_id' => $user->id,
        ]);
        Tenant::forgetCurrent();

        return [$user, $tenant, $lead, $unit];
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

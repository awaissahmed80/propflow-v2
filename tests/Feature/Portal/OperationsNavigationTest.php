<?php

namespace Tests\Feature\Portal;

use App\Models\Order;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class OperationsNavigationTest extends TestCase
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

    public function test_operations_overview_is_removed(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_ops_overview_gone');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/operations'))
            ->assertNotFound();
    }

    public function test_legacy_orders_path_redirects_to_bookings(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_ops_redirect_orders');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/orders'))
            ->assertRedirect('/bookings');
    }

    public function test_bookings_and_allotment_pages_load(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_ops_bookings_pages');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/bookings/applications'))
            ->assertRedirect('/bookings');

        $this->get(Domain::portal('/bookings'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('bookings/index', false)
            );

        $this->get(Domain::portal('/bookings/allotment'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('bookings/allotment', false)
            );

        $this->get(Domain::portal('/plan-templates'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('plan-templates/index', false)
            );

        $this->get(Domain::portal('/allocation'))
            ->assertRedirect('/bookings/allotment');
    }

    public function test_operations_hubs_redirect_to_default_sections(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_ops_hub_redirects');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/receivables'))
            ->assertRedirect('/receivables/installments');

        $this->get(Domain::portal('/commissions'))
            ->assertRedirect('/commissions/agents');
    }

    public function test_receivables_and_commissions_pages_load(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_ops_receivables');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/receivables/installments'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('receivables/installments', false)
            );

        $this->get(Domain::portal('/receivables/vouchers'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('operations/coming-soon', false)
                ->where('title', 'Payment Vouchers')
            );

        $this->get(Domain::portal('/commissions/agents'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('operations/coming-soon', false)
                ->where('title', 'Agent Commissions')
            );

        $this->get(Domain::portal('/commissions/dealers'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('operations/coming-soon', false)
                ->where('title', 'Dealer / Broker Network')
            );
    }

    public function test_verification_queue_lists_token_stage_bookings(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_verification_queue');

        $tenant->makeCurrent();
        $mine = Order::factory()->create([
            'assigned_to' => $user->id,
            'stage' => Order::STAGE_TOKEN,
            'status' => Order::STATUS_HOLD,
        ]);
        Order::factory()->create([
            'assigned_to' => null,
            'stage' => Order::STAGE_TOKEN,
            'status' => Order::STATUS_HOLD,
        ]);
        Order::factory()->create([
            'assigned_to' => $user->id,
            'stage' => Order::STAGE_ACTIVE,
            'status' => Order::STATUS_IN_PROGRESS,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/receivables/verification'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('receivables/verification', false)
                ->has('bookings', 2)
            );

        $this->get(Domain::portal('/receivables/verification?mine=1'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('receivables/verification', false)
                ->has('bookings', 1)
                ->where('bookings.0.code', $mine->code)
                ->where('filters.mine', true)
            );
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

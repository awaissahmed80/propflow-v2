<?php

namespace Tests\Feature\Portal;

use App\Models\Order;
use App\Models\OrderStage;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class OrderStageSettingsTest extends TestCase
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

    public function test_bookings_settings_section_loads_default_stages(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_order_stage_index');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/settings/bookings'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('settings/index', false)
                ->where('section', 'bookings')
                ->has('orderStages', 6)
                ->where('orderStages.0.label', Order::STAGE_BOOKING)
            );
    }

    public function test_order_stage_can_be_created(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_order_stage_store');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/settings/order-stages'), [
            'title' => 'Legal review',
            'color' => '#F59E0B',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $stage = OrderStage::query()->where('title', 'Legal review')->first();
        $this->assertNotNull($stage);
        $this->assertSame('legal_review', $stage->label);
        $this->assertSame('#F59E0B', $stage->color);
        $this->assertFalse($stage->is_system);
        Tenant::forgetCurrent();
    }

    public function test_order_stage_can_be_updated_and_reordered(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_order_stage_update');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/settings/bookings'))->assertOk();

        $tenant->makeCurrent();
        $first = OrderStage::query()->orderBy('priority')->first();
        $second = OrderStage::query()->orderBy('priority')->skip(1)->first();
        Tenant::forgetCurrent();

        $this->put(Domain::portal('/settings/order-stages/'.$first->label), [
            'title' => 'Booking verified',
            'color' => '#EF4444',
        ])->assertRedirect();

        $this->put(Domain::portal('/settings/order-stages/reorder'), [
            'order' => [$second->id, $first->id],
        ])->assertRedirect();

        $tenant->makeCurrent();
        $first->refresh();
        $second->refresh();
        $this->assertSame('Booking verified', $first->title);
        $this->assertSame('#EF4444', $first->color);
        $this->assertSame(Order::STAGE_BOOKING, $first->label);
        $this->assertSame(1, (int) $second->priority);
        $this->assertSame(2, (int) $first->priority);
        Tenant::forgetCurrent();
    }

    public function test_system_order_stage_cannot_be_deleted(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_order_stage_system');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/settings/bookings'))->assertOk();

        $tenant->makeCurrent();
        $stage = OrderStage::query()->where('label', Order::STAGE_BOOKING)->firstOrFail();
        Tenant::forgetCurrent();

        $this->from(Domain::portal('/settings/bookings'))
            ->delete(Domain::portal('/settings/order-stages/'.$stage->label))
            ->assertRedirect(Domain::portal('/settings/bookings'))
            ->assertSessionHasErrors('stage');

        $tenant->makeCurrent();
        $this->assertNotNull(OrderStage::query()->find($stage->id));
        Tenant::forgetCurrent();
    }

    public function test_custom_order_stage_can_be_deleted(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_order_stage_delete');

        $tenant->makeCurrent();
        OrderStage::ensureDefaults();
        $custom = OrderStage::factory()->create([
            'title' => 'Drop me',
            'label' => 'drop_me',
            'priority' => 99,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->delete(Domain::portal('/settings/order-stages/'.$custom->label))->assertRedirect();

        $tenant->makeCurrent();
        $this->assertNull(OrderStage::query()->find($custom->id));
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

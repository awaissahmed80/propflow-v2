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
                ->has('orderStages', 4)
                ->where('orderStages.0.label', Order::STAGE_TOKEN)
                ->has('orderStages.0.statuses')
                ->where('orderStages.2.label', Order::STAGE_ACTIVE)
            );
    }

    public function test_order_stage_cannot_be_created(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_order_stage_store');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/settings/bookings'))
            ->post(Domain::portal('/settings/order-stages'), [
                'title' => 'Legal review',
                'color' => '#F59E0B',
            ])
            ->assertRedirect(Domain::portal('/settings/bookings'))
            ->assertSessionHasErrors('stage');
    }

    public function test_order_stage_title_and_color_can_be_updated(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_order_stage_update');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/settings/bookings'))->assertOk();

        $tenant->makeCurrent();
        $first = OrderStage::query()->orderBy('priority')->first();
        Tenant::forgetCurrent();

        $this->put(Domain::portal('/settings/order-stages/'.$first->label), [
            'title' => 'Token hold',
            'color' => '#EF4444',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $first->refresh();
        $this->assertSame('Token hold', $first->title);
        $this->assertSame('#EF4444', $first->color);
        $this->assertSame(Order::STAGE_TOKEN, $first->label);
        Tenant::forgetCurrent();
    }

    public function test_order_stages_cannot_be_reordered(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_order_stage_reorder');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/settings/bookings'))->assertOk();

        $tenant->makeCurrent();
        $ids = OrderStage::query()->orderBy('priority')->pluck('id')->all();
        Tenant::forgetCurrent();

        $this->from(Domain::portal('/settings/bookings'))
            ->put(Domain::portal('/settings/order-stages/reorder'), [
                'order' => array_reverse($ids),
            ])
            ->assertRedirect(Domain::portal('/settings/bookings'))
            ->assertSessionHasErrors('stage');
    }

    public function test_order_stage_cannot_be_deleted(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_order_stage_system');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/settings/bookings'))->assertOk();

        $tenant->makeCurrent();
        $stage = OrderStage::query()->where('label', Order::STAGE_TOKEN)->firstOrFail();
        Tenant::forgetCurrent();

        $this->from(Domain::portal('/settings/bookings'))
            ->delete(Domain::portal('/settings/order-stages/'.$stage->label))
            ->assertRedirect(Domain::portal('/settings/bookings'))
            ->assertSessionHasErrors('stage');

        $tenant->makeCurrent();
        $this->assertNotNull(OrderStage::query()->find($stage->id));
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

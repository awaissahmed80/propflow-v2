<?php

namespace Tests\Feature\Portal;

use App\Models\LeadActionType;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class LeadActionTypeColorTest extends TestCase
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

    public function test_settings_pipeline_includes_action_type_colors(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_action_colors');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/settings/pipeline'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('settings/index', false)
            ->where('activityActionTypes.0.color', '#64B5F6')
            ->where('activityActionTypes.0.label', 'call')
            ->where('nextActionTypes.0.color', '#16A34A')
            ->where('nextActionTypes.0.label', 'follow_up')
        );
    }

    public function test_action_type_color_can_be_updated(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_action_color_update');

        $tenant->makeCurrent();
        LeadActionType::ensureDefaults();
        $call = LeadActionType::query()
            ->ofKind(LeadActionType::KIND_ACTIVITY)
            ->where('label', 'call')
            ->firstOrFail();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/settings/lead-actions/'.$call->id), [
            'title' => $call->title,
            'color' => '#E57373',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $call->refresh();
        $this->assertSame('#E57373', $call->color);
        Tenant::forgetCurrent();
    }

    public function test_created_action_type_stores_color(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_action_color_store');

        $tenant->makeCurrent();
        LeadActionType::ensureDefaults();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/settings/lead-actions'), [
            'kind' => LeadActionType::KIND_ACTIVITY,
            'title' => 'Video Call',
            'color' => '#0284C7',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $row = LeadActionType::query()
            ->ofKind(LeadActionType::KIND_ACTIVITY)
            ->where('title', 'Video Call')
            ->first();
        $this->assertNotNull($row);
        $this->assertSame('#0284C7', $row->color);
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

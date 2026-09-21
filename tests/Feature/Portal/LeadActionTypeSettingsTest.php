<?php

namespace Tests\Feature\Portal;

use App\Models\Lead;
use App\Models\LeadActionType;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class LeadActionTypeSettingsTest extends TestCase
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

    public function test_settings_pipeline_loads_action_catalogs(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_actions_settings');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/settings/pipeline'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('settings/index', false)
            ->has('activityActionTypes', 8)
            ->has('nextActionTypes', 4)
            ->where('activityActionTypes.0.is_system', true)
            ->where('activityActionTypes.0.is_enabled', true)
            ->where('nextActionTypes.3.is_system', true)
            ->where('nextActionTypes.3.is_enabled', true)
            ->where('nextActionTypes.3.label', 'do_nothing')
            ->where('nextActionTypes.3.title', 'Do Nothing')
        );
    }

    public function test_activity_action_type_can_be_created(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_action_store');

        $tenant->makeCurrent();
        LeadActionType::ensureDefaults();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/settings/lead-actions'), [
            'kind' => LeadActionType::KIND_ACTIVITY,
            'title' => 'Video Call',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $row = LeadActionType::query()
            ->ofKind(LeadActionType::KIND_ACTIVITY)
            ->where('title', 'Video Call')
            ->first();
        $this->assertNotNull($row);
        $this->assertSame('video_call', $row->label);
        Tenant::forgetCurrent();
    }

    public function test_default_next_action_cannot_be_deleted(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_action_system');

        $tenant->makeCurrent();
        LeadActionType::ensureDefaults();
        $system = LeadActionType::query()
            ->ofKind(LeadActionType::KIND_NEXT_ACTION)
            ->where('label', LeadActionType::LABEL_DO_NOTHING)
            ->firstOrFail();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->delete(Domain::portal('/settings/lead-actions/'.$system->id))
            ->assertRedirect()
            ->assertSessionHasErrors('action_type');

        $tenant->makeCurrent();
        $this->assertNotNull(LeadActionType::query()->find($system->id));
        Tenant::forgetCurrent();
    }

    public function test_default_action_can_be_toggled_off(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_action_toggle');

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
            'is_enabled' => false,
        ])->assertRedirect();

        $tenant->makeCurrent();
        $call->refresh();
        $this->assertFalse($call->is_enabled);
        $this->assertNotContains('Call', LeadActionType::titles(LeadActionType::KIND_ACTIVITY));
        Tenant::forgetCurrent();
    }

    public function test_last_enabled_action_cannot_be_disabled(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_action_last_toggle');

        $tenant->makeCurrent();
        LeadActionType::query()->delete();
        $only = LeadActionType::factory()->activity()->create([
            'title' => 'Only Action',
            'label' => 'only_action',
            'is_system' => true,
            'is_enabled' => true,
            'priority' => 1,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/settings/lead-actions/'.$only->id), [
            'is_enabled' => false,
        ])
            ->assertRedirect()
            ->assertSessionHasErrors('action_type');

        $tenant->makeCurrent();
        $only->refresh();
        $this->assertTrue($only->is_enabled);
        Tenant::forgetCurrent();
    }

    public function test_renaming_next_action_updates_leads(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_action_rename');

        $tenant->makeCurrent();
        LeadActionType::ensureDefaults();
        $followUp = LeadActionType::query()
            ->ofKind(LeadActionType::KIND_NEXT_ACTION)
            ->where('label', 'follow_up')
            ->firstOrFail();
        Lead::factory()->create(['next_action' => 'Follow-up']);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/settings/lead-actions/'.$followUp->id), [
            'title' => 'Call Back',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $followUp->refresh();
        $this->assertSame('Call Back', $followUp->title);
        $this->assertSame(1, Lead::query()->where('next_action', 'Call Back')->count());
        $this->assertSame(0, Lead::query()->where('next_action', 'Follow-up')->count());
        Tenant::forgetCurrent();
    }

    public function test_action_types_can_be_reordered(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_action_reorder');

        $tenant->makeCurrent();
        $first = LeadActionType::factory()->activity()->create(['title' => 'A', 'label' => 'a', 'priority' => 1]);
        $second = LeadActionType::factory()->activity()->create(['title' => 'B', 'label' => 'b', 'priority' => 2]);
        $third = LeadActionType::factory()->activity()->create(['title' => 'C', 'label' => 'c', 'priority' => 3]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/settings/lead-actions/reorder'), [
            'kind' => LeadActionType::KIND_ACTIVITY,
            'order' => [$third->id, $first->id, $second->id],
        ])->assertRedirect();

        $tenant->makeCurrent();
        $this->assertSame(1, LeadActionType::query()->find($third->id)?->priority);
        $this->assertSame(2, LeadActionType::query()->find($first->id)?->priority);
        $this->assertSame(3, LeadActionType::query()->find($second->id)?->priority);
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

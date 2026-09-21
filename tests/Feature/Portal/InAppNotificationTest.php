<?php

namespace Tests\Feature\Portal;

use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Setting;
use App\Models\Task;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Notifications\WorkspaceNotification;
use App\Services\TenantContext;
use App\Support\Domain;
use App\Support\Notifications\NotificationSettings;
use Illuminate\Support\Str;
use Tests\TestCase;

class InAppNotificationTest extends TestCase
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

    public function test_new_lead_notifies_the_assignee(): void
    {
        [$owner, $tenant, $assignee] = $this->createWorkspace('tenant_notify_lead');

        $this->actingAs($owner);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);
        $tenant->makeCurrent();

        $lead = Lead::factory()->create([
            'user_id' => $owner->id,
            'assigned_to' => $assignee->id,
            'source' => 'Website',
        ]);

        $notification = $assignee->notifications()->first();
        $this->assertNotNull($notification);
        $this->assertSame('lead_created', $notification->data['event']);
        $this->assertSame('/leads#'.$lead->code, $notification->data['href']);
        $this->assertSame($tenant->id, $notification->data['tenant_id']);
        $this->assertSame(0, $owner->notifications()->count());

        Tenant::forgetCurrent();
    }

    public function test_in_app_channel_can_be_turned_off(): void
    {
        [$owner, $tenant, $assignee] = $this->createWorkspace('tenant_notify_off');

        $tenant->makeCurrent();
        Setting::putGroup(Setting::GROUP_NOTIFICATIONS, 'Notifications', [
            ...NotificationSettings::defaults(),
            'in_app' => false,
        ]);

        $this->actingAs($owner);

        Lead::factory()->create([
            'user_id' => $owner->id,
            'assigned_to' => $assignee->id,
        ]);

        $this->assertSame(0, $assignee->notifications()->count());
        Tenant::forgetCurrent();
    }

    public function test_stage_change_respects_the_event_setting(): void
    {
        [$owner, $tenant, $assignee] = $this->createWorkspace('tenant_notify_stage');

        $tenant->makeCurrent();
        $first = LeadStage::factory()->create(['title' => 'New', 'priority' => 1]);
        $second = LeadStage::factory()->create(['title' => 'Contacted', 'priority' => 2]);
        $lead = Lead::factory()->create([
            'user_id' => $owner->id,
            'assigned_to' => $assignee->id,
            'lead_stage_id' => $first->id,
        ]);
        $assignee->notifications()->delete();

        $this->actingAs($owner);
        $lead->update(['lead_stage_id' => $second->id]);
        $this->assertSame(0, $assignee->notifications()->count());

        Setting::putGroup(Setting::GROUP_NOTIFICATIONS, 'Notifications', [
            ...NotificationSettings::defaults(),
            'lead_stage_changed' => true,
        ]);

        $lead->update(['lead_stage_id' => $first->id]);
        $notification = $assignee->notifications()->first();
        $this->assertNotNull($notification);
        $this->assertSame('lead_stage_changed', $notification->data['event']);
        $this->assertSame('/leads#'.$lead->code, $notification->data['href']);
        $this->assertStringContainsString('New', $notification->data['body']);

        Tenant::forgetCurrent();
    }

    public function test_task_assignment_notifies_the_other_user(): void
    {
        [$owner, $tenant, $assignee] = $this->createWorkspace('tenant_notify_task');

        $tenant->makeCurrent();
        $lead = Lead::factory()->create([
            'user_id' => $owner->id,
            'assigned_to' => $owner->id,
        ]);
        $assignee->notifications()->delete();
        $owner->notifications()->delete();

        $this->actingAs($owner);

        Task::factory()->create([
            'lead_id' => $lead->id,
            'user_id' => $assignee->id,
            'action' => 'Call the client',
            'type' => Task::TYPE_ACTION,
        ]);

        $notification = $assignee->notifications()->first();
        $this->assertNotNull($notification);
        $this->assertSame('task_assigned', $notification->data['event']);
        $this->assertSame('/leads#'.$lead->code, $notification->data['href']);
        $this->assertSame('Call the client', $notification->data['body']);

        Tenant::forgetCurrent();
    }

    public function test_notification_inbox_is_limited_to_the_current_tenant(): void
    {
        [$owner, $tenant, $assignee] = $this->createWorkspace('tenant_notify_inbox');
        $other = Tenant::factory()->create(['database' => 'tenant_notify_inbox_other']);

        $tenant->makeCurrent();
        Lead::factory()->create([
            'user_id' => $owner->id,
            'assigned_to' => $assignee->id,
        ]);
        Tenant::forgetCurrent();

        $assignee->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => WorkspaceNotification::class,
            'data' => [
                'tenant_id' => $other->id,
                'event' => 'lead_created',
                'title' => 'Other workspace',
                'body' => 'Should stay hidden',
                'href' => '/leads',
            ],
        ]);

        $this->actingAs($assignee);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->getJson(Domain::portal('/notifications'))
            ->assertOk()
            ->assertJsonPath('unread_count', 1)
            ->assertJsonCount(1, 'notifications')
            ->assertJsonPath('notifications.0.event', 'lead_created')
            ->assertJsonMissing(['title' => 'Other workspace']);

        $id = $assignee->notifications()->where('data->tenant_id', $tenant->id)->value('id');

        $this->postJson(Domain::portal('/notifications/'.$id.'/read'))
            ->assertOk()
            ->assertJsonPath('unread_count', 0);

        $this->assertNotNull($assignee->notifications()->find($id)->read_at);
    }

    /**
     * @return array{0: User, 1: Tenant, 2: User}
     */
    protected function createWorkspace(string $database): array
    {
        $owner = User::factory()->tenant()->create();
        $assignee = User::factory()->tenant()->create();
        $tenant = Tenant::factory()->create(['database' => $database]);

        TenantUser::factory()->owner()->create([
            'user_id' => $owner->id,
            'tenant_id' => $tenant->id,
        ]);
        TenantUser::factory()->create([
            'user_id' => $assignee->id,
            'tenant_id' => $tenant->id,
        ]);

        return [$owner, $tenant, $assignee];
    }
}

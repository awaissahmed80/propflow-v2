<?php

namespace Tests\Feature\Portal;

use App\Models\Contact;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Order;
use App\Models\PaymentInstallment;
use App\Models\PaymentPlan;
use App\Models\PersonalReminder;
use App\Models\Setting;
use App\Models\Task;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Notifications\WorkspaceNotification;
use App\Services\CriticalDueNotifier;
use App\Services\TenantContext;
use App\Support\Domain;
use App\Support\Notifications\NotificationSettings;
use Illuminate\Notifications\Events\BroadcastNotificationCreated;
use Illuminate\Support\Facades\Event;
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
            'taskable_type' => $lead->getMorphClass(),
            'taskable_id' => $lead->id,
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

        $this->getJson(Domain::portal('/notifications/feed'))
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

        $this->getJson(Domain::portal('/notifications/feed'))
            ->assertOk()
            ->assertJsonPath('unread_count', 0)
            ->assertJsonCount(0, 'notifications');
    }

    public function test_notifications_index_lists_all_and_supports_unread_and_delete(): void
    {
        [$owner, $tenant, $assignee] = $this->createWorkspace('tenant_notify_modal');

        $tenant->makeCurrent();
        Lead::factory()->create([
            'user_id' => $owner->id,
            'assigned_to' => $assignee->id,
        ]);
        Tenant::forgetCurrent();

        $id = $assignee->notifications()->where('data->tenant_id', $tenant->id)->value('id');
        $this->assertNotNull($id);

        $this->actingAs($assignee);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->postJson(Domain::portal('/notifications/'.$id.'/read'))
            ->assertOk()
            ->assertJsonPath('unread_count', 0);

        $this->getJson(Domain::portal('/notifications'))
            ->assertOk()
            ->assertJsonCount(1, 'notifications')
            ->assertJsonPath('unread_count', 0)
            ->assertJsonPath('notifications.0.id', $id)
            ->assertJsonPath('notifications.0.icon', 'customer-service-line');

        $this->postJson(Domain::portal('/notifications/'.$id.'/unread'))
            ->assertOk()
            ->assertJsonPath('unread_count', 1);

        $this->assertNull($assignee->notifications()->find($id)?->read_at);

        $this->deleteJson(Domain::portal('/notifications/'.$id))
            ->assertOk()
            ->assertJsonPath('unread_count', 0);

        $this->assertNull($assignee->notifications()->find($id));
    }

    public function test_critical_due_notifier_sends_personal_reminder_and_follow_up_alerts(): void
    {
        [$owner, $tenant, $assignee] = $this->createWorkspace('tenant_notify_critical');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        Lead::factory()->create([
            'user_id' => $owner->id,
            'assigned_to' => $assignee->id,
            'lead_stage_id' => $stage->id,
            'next_action' => Lead::NEXT_ACTION_FOLLOW_UP,
            'due_date' => now()->subDay(),
            'contact_id' => Contact::factory()->create([
                'first_name' => 'Sara',
                'last_name' => 'Ali',
            ]),
        ]);
        $assignee->notifications()->delete();

        PersonalReminder::factory()->forUser($assignee->id)->create([
            'title' => 'Call the bank',
            'due_at' => now()->subDay(),
        ]);

        $sent = app(CriticalDueNotifier::class)->notify();
        $this->assertSame(2, $sent);

        $events = $assignee->notifications()->get()->pluck('data.event')->all();
        $this->assertContains('follow_up_overdue', $events);
        $this->assertContains('personal_reminder_overdue', $events);

        $sentAgain = app(CriticalDueNotifier::class)->notify();
        $this->assertSame(0, $sentAgain);
        $this->assertSame(2, $assignee->notifications()->count());

        Tenant::forgetCurrent();
    }

    public function test_creating_a_due_personal_reminder_sends_in_app_notification(): void
    {
        [$owner, $tenant, $assignee] = $this->createWorkspace('tenant_notify_reminder_create');

        $this->actingAs($assignee);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);
        $assignee->notifications()->delete();

        Event::fake([BroadcastNotificationCreated::class]);

        $this->post(Domain::portal('/todos/reminders'), [
            'title' => 'Site visit today',
            'due_at' => now()->format('Y-m-d\TH:i'),
        ])->assertRedirect(Domain::portal('/todos'));

        $notification = $assignee->notifications()
            ->where('data->event', 'personal_reminder_due')
            ->first();

        $this->assertNotNull($notification);
        $this->assertSame('Reminder due', $notification->data['title']);
        $this->assertSame('Site visit today', $notification->data['body']);
        $this->assertSame('/todos', $notification->data['href']);

        Event::assertDispatched(BroadcastNotificationCreated::class, function (BroadcastNotificationCreated $event) use ($assignee, $tenant): bool {
            return (int) $event->notifiable->id === (int) $assignee->id
                && ($event->data['event'] ?? null) === 'personal_reminder_due'
                && (int) ($event->data['tenant_id'] ?? 0) === (int) $tenant->id
                && ($event->data['body'] ?? null) === 'Site visit today';
        });
    }

    public function test_future_personal_reminder_does_not_notify_until_due(): void
    {
        [$owner, $tenant, $assignee] = $this->createWorkspace('tenant_notify_reminder_future');

        $this->actingAs($assignee);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);
        $assignee->notifications()->delete();

        $this->post(Domain::portal('/todos/reminders'), [
            'title' => 'Tomorrow call',
            'due_at' => now()->addDay()->format('Y-m-d\TH:i'),
        ])->assertRedirect(Domain::portal('/todos'));

        $this->assertSame(0, $assignee->notifications()->count());

        $tenant->makeCurrent();
        $sent = app(CriticalDueNotifier::class)->notify();
        Tenant::forgetCurrent();

        $this->assertSame(0, $sent);
        $this->assertSame(0, $assignee->notifications()->count());
    }

    public function test_critical_due_notifier_sends_overdue_installment_alerts(): void
    {
        [$owner, $tenant, $assignee] = $this->createWorkspace('tenant_notify_installment_overdue');

        $tenant->makeCurrent();
        $order = Order::factory()->create([
            'assigned_to' => $assignee->id,
            'stage' => Order::STAGE_ACTIVE,
            'status' => Order::STATUS_IN_PROGRESS,
            'contact_id' => Contact::factory()->create([
                'first_name' => 'Omar',
                'last_name' => 'Raza',
            ]),
        ]);
        $plan = PaymentPlan::factory()->create(['order_id' => $order->id]);
        $installment = PaymentInstallment::factory()->create([
            'payment_plan_id' => $plan->id,
            'label' => '2nd installment',
            'due_on' => now()->subDays(3)->toDateString(),
            'status' => PaymentInstallment::STATUS_PENDING,
        ]);
        $assignee->notifications()->delete();

        $sent = app(CriticalDueNotifier::class)->notify();
        $this->assertGreaterThanOrEqual(1, $sent);

        $notification = $assignee->notifications()->where('data->event', 'installment_overdue')->first();
        $this->assertNotNull($notification);
        $this->assertSame('/bookings?booking='.$order->code, $notification->data['href']);
        $this->assertStringContainsString('2nd installment', $notification->data['body']);

        $sentAgain = app(CriticalDueNotifier::class)->notify();
        $this->assertSame(0, $sentAgain);

        Tenant::forgetCurrent();
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

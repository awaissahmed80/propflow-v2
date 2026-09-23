<?php

namespace Tests\Feature\Portal;

use App\Models\Contact;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Order;
use App\Models\PaymentInstallment;
use App\Models\PaymentPlan;
use App\Models\PersonalReminder;
use App\Models\Project;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class TodoListTest extends TestCase
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

    public function test_guest_cannot_view_todo_list(): void
    {
        $this->get(Domain::portal('/todos'))
            ->assertRedirect(Domain::auth());
    }

    public function test_todo_list_page_loads_with_feed_and_reminders(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_todo_list');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/todos'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('todos/index', false)
                ->where('title', 'Todo List')
                ->where('window', 'week')
                ->has('feed')
                ->has('feedPagination')
                ->where('feedPagination.current_page', 1)
                ->where('feedPagination.per_page', 10)
                ->has('reminders')
                ->has('windows', 4)
            );
    }

    public function test_feed_includes_assigned_lead_due_soon_and_excludes_other_users(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_todo_feed_leads');
        $other = User::factory()->tenant()->create();
        TenantUser::factory()->create([
            'user_id' => $other->id,
            'tenant_id' => $tenant->id,
        ]);

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $mine = Lead::factory()->create([
            'lead_stage_id' => $stage->id,
            'assigned_to' => $user->id,
            'next_action' => Lead::NEXT_ACTION_FOLLOW_UP,
            'due_date' => now()->addDay(),
            'contact_id' => Contact::factory()->create([
                'first_name' => 'Ayesha',
                'last_name' => 'Khan',
            ]),
        ]);
        Lead::factory()->create([
            'lead_stage_id' => $stage->id,
            'assigned_to' => $other->id,
            'next_action' => Lead::NEXT_ACTION_FOLLOW_UP,
            'due_date' => now()->addDay(),
            'contact_id' => Contact::factory()->create([
                'first_name' => 'Other',
                'last_name' => 'Lead',
            ]),
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/todos'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('todos/index', false)
                ->has('feed', 1)
                ->where('feed.0.source', 'lead')
                ->where('feed.0.href', '/leads?lead='.$mine->code)
                ->where('feed.0.title', 'Ayesha Khan')
            );
    }

    public function test_feed_includes_installments_due_this_week(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_todo_feed_installments');

        $tenant->makeCurrent();
        $order = Order::factory()->create([
            'assigned_to' => $user->id,
            'status' => Order::STATUS_BOOKED,
            'project_id' => Project::factory()->create(['title' => 'Vista Residences']),
            'contact_id' => Contact::factory()->create([
                'first_name' => 'Bilal',
                'last_name' => 'Ahmed',
            ]),
        ]);
        $plan = PaymentPlan::factory()->create([
            'order_id' => $order->id,
        ]);
        $installment = PaymentInstallment::factory()->create([
            'payment_plan_id' => $plan->id,
            'label' => 'Token balance',
            'due_on' => now()->addDays(2)->toDateString(),
            'status' => PaymentInstallment::STATUS_PENDING,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/todos'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('todos/index', false)
                ->has('feed', 1)
                ->where('feed.0.source', 'installment')
                ->where('feed.0.id', 'installment-'.$installment->id)
                ->where('feed.0.href', '/bookings?booking='.$order->code)
            );
    }

    public function test_feed_is_paginated(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_todo_feed_pagination');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();

        for ($i = 0; $i < 12; $i++) {
            Lead::factory()->create([
                'lead_stage_id' => $stage->id,
                'assigned_to' => $user->id,
                'next_action' => Lead::NEXT_ACTION_FOLLOW_UP,
                'due_date' => now()->addHours($i + 1),
                'contact_id' => Contact::factory()->create([
                    'first_name' => 'Lead',
                    'last_name' => (string) $i,
                ]),
            ]);
        }
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/todos'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('todos/index', false)
                ->has('feed', 10)
                ->where('feedPagination.current_page', 1)
                ->where('feedPagination.last_page', 2)
                ->where('feedPagination.total', 12)
                ->where('feedPagination.from', 1)
                ->where('feedPagination.to', 10)
            );

        $this->get(Domain::portal('/todos?page=2'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('todos/index', false)
                ->has('feed', 2)
                ->where('feedPagination.current_page', 2)
                ->where('feedPagination.from', 11)
                ->where('feedPagination.to', 12)
            );
    }

    public function test_user_can_create_update_and_delete_personal_reminder(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_todo_reminders_crud');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/todos/reminders'), [
            'title' => 'Call the bank',
            'notes' => 'Ask about IBAN',
            'due_at' => now()->addDays(2)->format('Y-m-d\TH:i'),
        ])->assertRedirect(Domain::portal('/todos'));

        $tenant->makeCurrent();
        $reminder = PersonalReminder::query()->first();
        $this->assertNotNull($reminder);
        $this->assertSame($user->id, $reminder->user_id);
        $this->assertSame('Call the bank', $reminder->title);
        Tenant::forgetCurrent();

        $this->put(Domain::portal('/todos/reminders/'.$reminder->id), [
            'title' => 'Call the bank again',
            'completed' => true,
        ])->assertRedirect(Domain::portal('/todos'));

        $tenant->makeCurrent();
        $reminder->refresh();
        $this->assertSame('Call the bank again', $reminder->title);
        $this->assertNotNull($reminder->completed_at);
        Tenant::forgetCurrent();

        $this->delete(Domain::portal('/todos/reminders/'.$reminder->id))
            ->assertRedirect(Domain::portal('/todos'));

        $tenant->makeCurrent();
        $this->assertDatabaseMissing('personal_reminders', ['id' => $reminder->id], 'tenant');
        Tenant::forgetCurrent();
    }

    public function test_user_cannot_update_another_users_reminder(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_todo_reminders_auth');
        $other = User::factory()->tenant()->create();
        TenantUser::factory()->create([
            'user_id' => $other->id,
            'tenant_id' => $tenant->id,
        ]);

        $tenant->makeCurrent();
        $reminder = PersonalReminder::factory()->forUser($other->id)->create([
            'title' => 'Secret note',
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/todos/reminders/'.$reminder->id), [
            'title' => 'Hacked',
        ])->assertForbidden();
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

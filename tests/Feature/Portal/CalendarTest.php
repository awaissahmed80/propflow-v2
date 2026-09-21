<?php

namespace Tests\Feature\Portal;

use App\Models\Campaign;
use App\Models\Lead;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CalendarTest extends TestCase
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

    public function test_guest_cannot_view_calendar(): void
    {
        $this->get(Domain::portal('/calendar'))
            ->assertRedirect(Domain::auth());
    }

    public function test_day_events_include_lead_due_on_selected_date(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_calendar_day');

        $tenant->makeCurrent();
        $due = now()->startOfDay()->addHours(10);
        $mine = Lead::factory()->create([
            'assigned_to' => $user->id,
            'user_id' => $user->id,
            'due_date' => $due,
            'next_action' => 'Call',
        ]);
        Lead::factory()->create([
            'assigned_to' => $user->id,
            'user_id' => $user->id,
            'due_date' => $due->copy()->addDay(),
            'next_action' => 'Visit',
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/calendar?date='.$due->toDateString()))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('calendar/index')
                ->where('filters.date', $due->toDateString())
                ->has('dayEvents', 1)
                ->where('dayEvents.0.subject.code', $mine->code)
                ->where('dayEvents.0.module', 'leads')
                ->where('dayEvents.0.overdue', false)
            );
    }

    public function test_opens_lead_detail_by_code(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_calendar_lead');

        $tenant->makeCurrent();
        $lead = Lead::factory()->create([
            'assigned_to' => $user->id,
            'user_id' => $user->id,
            'due_date' => now(),
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/calendar?lead='.$lead->code))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('calendar/index')
                ->where('openedLead.code', $lead->code)
                ->where('openedOrder', null)
            );
    }

    public function test_type_filter_limits_modules(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_calendar_type');

        $tenant->makeCurrent();
        $day = now()->startOfDay()->addHours(9);
        Lead::factory()->create([
            'assigned_to' => $user->id,
            'user_id' => $user->id,
            'due_date' => $day,
        ]);
        Campaign::factory()->create([
            'owner_id' => $user->id,
            'starts_at' => $day->copy()->subDay(),
            'ends_at' => $day->copy()->addDay(),
            'status' => Campaign::STATUS_ACTIVE,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/calendar?date='.$day->toDateString().'&type=campaigns'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('calendar/index')
                ->has('dayEvents', 1)
                ->where('dayEvents.0.module', 'campaigns')
            );
    }

    public function test_campaign_range_marks_days_in_month(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_calendar_campaign');

        $tenant->makeCurrent();
        $start = now()->startOfMonth()->addDays(2)->startOfDay();
        $end = $start->copy()->addDays(3);
        Campaign::factory()->create([
            'owner_id' => $user->id,
            'starts_at' => $start,
            'ends_at' => $end,
            'status' => Campaign::STATUS_ACTIVE,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $mid = $start->copy()->addDay()->toDateString();

        $this->get(Domain::portal('/calendar?month='.$start->format('Y-m').'&date='.$mid.'&type=campaigns'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('calendar/index')
                ->where('monthMarkers', function ($markers) use ($mid) {
                    $colors = $markers[$mid] ?? null;

                    return is_array($colors) && in_array('violet', $colors, true);
                })
                ->has('dayEvents', 1)
                ->where('dayEvents.0.module', 'campaigns')
            );
    }

    public function test_defaults_assignee_filter_to_current_user(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_calendar_assignee');
        $other = User::factory()->tenant()->create();
        TenantUser::factory()->create([
            'user_id' => $other->id,
            'tenant_id' => $tenant->id,
            'is_owner' => false,
        ]);

        $tenant->makeCurrent();
        $day = now()->startOfDay()->addHours(11);
        $mine = Lead::factory()->create([
            'assigned_to' => $user->id,
            'user_id' => $user->id,
            'due_date' => $day,
        ]);
        Lead::factory()->create([
            'assigned_to' => $other->id,
            'user_id' => $other->id,
            'due_date' => $day,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/calendar?date='.$day->toDateString()))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('calendar/index')
                ->has('dayEvents', 1)
                ->where('dayEvents.0.subject.code', $mine->code)
                ->where('filters.assigned_to.0', (string) $user->id)
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

<?php

namespace Tests\Feature\Portal;

use App\Models\Lead;
use App\Models\Order;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Assistant\AssistantInterpreter;
use App\Support\Domain;
use Tests\TestCase;

class AssistantTest extends TestCase
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

    public function test_guest_cannot_open_the_brief(): void
    {
        $this->get(Domain::portal('/assistant/brief'))
            ->assertRedirect(Domain::auth());
    }

    public function test_brief_hides_another_users_work(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_assistant_brief');
        $other = User::factory()->tenant()->create();
        TenantUser::factory()->create([
            'user_id' => $other->id,
            'tenant_id' => $tenant->id,
            'is_owner' => false,
        ]);

        $tenant->makeCurrent();
        $mine = Lead::factory()->create([
            'assigned_to' => $user->id,
            'user_id' => $user->id,
            'due_date' => now()->subDay(),
            'next_action' => 'Call',
        ]);
        Lead::factory()->create([
            'assigned_to' => $other->id,
            'user_id' => $other->id,
            'due_date' => now()->subDay(),
            'next_action' => 'Call',
        ]);
        Order::factory()->allocated()->create([
            'assigned_to' => $user->id,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->getJson(Domain::portal('/assistant/brief'));

        $response->assertOk();
        $response->assertJsonPath('progress.open_leads', 1);
        $response->assertJsonPath('progress.overdue', 1);
        $response->assertJsonPath('progress.closed_deals', 1);
        $response->assertJsonCount(1, 'work.leads');
        $response->assertJsonPath('work.leads.0.code', $mine->code);
        $response->assertJsonPath('work.leads.0.href', '/leads?lead='.$mine->code);
    }

    public function test_interpret_extracts_a_lead_without_saving_it(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_assistant_interpret');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->postJson(Domain::portal('/assistant/interpret'), [
            'transcript' => 'new lead for Ahmed, phone 03001234567',
        ]);

        $response->assertOk();
        $response->assertJsonPath('intent', AssistantInterpreter::INTENT_CREATE_LEAD);
        $response->assertJsonPath('slots.first_name', 'Ahmed');
        $response->assertJsonPath('slots.phone_number', '03001234567');
        $response->assertJsonPath('missing', []);
        $response->assertJsonPath('prompt', 'Confirm this lead before saving.');

        $tenant->makeCurrent();
        $this->assertSame(0, Lead::query()->count());
        Tenant::forgetCurrent();
    }

    public function test_confirmed_lead_uses_the_existing_store(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_assistant_store');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $interpreted = $this->postJson(Domain::portal('/assistant/interpret'), [
            'transcript' => 'new lead for Ahmed, phone 03001234567',
        ])->assertOk()->json('slots');

        $this->post(Domain::portal('/leads'), [
            'contact' => [
                'first_name' => $interpreted['first_name'],
                'last_name' => $interpreted['last_name'],
                'phone_number' => $interpreted['phone_number'],
                'email_address' => $interpreted['email_address'],
            ],
            'project_id' => $interpreted['project_id'],
            'budget' => $interpreted['budget'],
            'next_action' => $interpreted['next_action'],
        ])->assertRedirect(Domain::portal('/leads'));

        $tenant->makeCurrent();
        $lead = Lead::query()->with('contact')->first();
        $this->assertNotNull($lead);
        $this->assertSame('Ahmed', $lead->contact->first_name);
        $this->assertSame('03001234567', $lead->contact->phone_number);
        $this->assertSame($user->id, $lead->assigned_to);
        Tenant::forgetCurrent();
    }

    public function test_unknown_sentence_does_not_guess(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_assistant_unknown');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->postJson(Domain::portal('/assistant/interpret'), [
            'transcript' => 'book the corner plot',
        ])
            ->assertOk()
            ->assertJsonPath('intent', AssistantInterpreter::INTENT_UNKNOWN)
            ->assertJsonPath('prompt', AssistantInterpreter::UNKNOWN_PROMPT)
            ->assertJsonPath('ask', AssistantInterpreter::ASK_PROMPT)
            ->assertJsonFragment(['label' => "Today's work"])
            ->assertJsonFragment(['label' => 'Calendar']);
    }

    public function test_greeting_offers_the_actions_it_can_take(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_assistant_greeting');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->postJson(Domain::portal('/assistant/interpret'), [
            'transcript' => 'how are you today?',
        ])
            ->assertOk()
            ->assertJsonPath('intent', AssistantInterpreter::INTENT_GREETING)
            ->assertJsonPath('prompt', "I'm doing well.")
            ->assertJsonPath('ask', AssistantInterpreter::ASK_PROMPT)
            ->assertJsonFragment(['text' => 'new lead']);
    }

    public function test_calendar_lists_only_the_signed_in_users_events(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_assistant_calendar');
        $other = User::factory()->tenant()->create();
        TenantUser::factory()->create([
            'user_id' => $other->id,
            'tenant_id' => $tenant->id,
            'is_owner' => false,
        ]);

        $tenant->makeCurrent();
        $mine = Lead::factory()->create([
            'assigned_to' => $user->id,
            'user_id' => $user->id,
            'due_date' => now()->addDay(),
            'next_action' => 'Arrange Meeting',
        ]);
        Lead::factory()->create([
            'assigned_to' => $other->id,
            'user_id' => $other->id,
            'due_date' => now()->addDay(),
            'next_action' => 'Arrange Meeting',
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->postJson(Domain::portal('/assistant/interpret'), [
            'transcript' => 'do I have any event in my calendar?',
        ])
            ->assertOk()
            ->assertJsonPath('intent', AssistantInterpreter::INTENT_CALENDAR)
            ->assertJsonPath('prompt', 'Here is your calendar.')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.code', $mine->code)
            ->assertJsonPath('data.0.href', '/leads?lead='.$mine->code);
    }

    public function test_schedule_synonyms_open_the_calendar(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_assistant_schedule');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->postJson(Domain::portal('/assistant/interpret'), [
            'transcript' => 'anything on my schedule?',
        ])
            ->assertOk()
            ->assertJsonPath('intent', AssistantInterpreter::INTENT_CALENDAR);
    }

    public function test_create_lead_continues_across_turns_with_context(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_assistant_context');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $first = $this->postJson(Domain::portal('/assistant/interpret'), [
            'transcript' => 'new lead',
        ])->assertOk();

        $first->assertJsonPath('intent', AssistantInterpreter::INTENT_CREATE_LEAD);
        $first->assertJsonPath('missing.0', 'name');

        $second = $this->postJson(Domain::portal('/assistant/interpret'), [
            'transcript' => 'Ahmed',
            'context' => [
                'intent' => $first->json('intent'),
                'slots' => $first->json('slots'),
                'missing' => $first->json('missing'),
            ],
        ])->assertOk();

        $second->assertJsonPath('slots.first_name', 'Ahmed');
        $second->assertJsonPath('missing.0', 'phone_or_email');

        $this->postJson(Domain::portal('/assistant/interpret'), [
            'transcript' => '03001234567',
            'context' => [
                'intent' => $second->json('intent'),
                'slots' => $second->json('slots'),
                'missing' => $second->json('missing'),
            ],
        ])
            ->assertOk()
            ->assertJsonPath('slots.first_name', 'Ahmed')
            ->assertJsonPath('slots.phone_number', '03001234567')
            ->assertJsonPath('missing', [])
            ->assertJsonPath('prompt', 'Confirm this lead before saving.');

        $tenant->makeCurrent();
        $this->assertSame(0, Lead::query()->count());
        Tenant::forgetCurrent();
    }

    public function test_who_is_finds_a_lead_by_name(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_assistant_who');

        $tenant->makeCurrent();
        $lead = Lead::factory()->create([
            'assigned_to' => $user->id,
            'user_id' => $user->id,
        ]);
        $lead->contact->update([
            'first_name' => 'Cathy',
            'last_name' => 'Grady',
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->postJson(Domain::portal('/assistant/interpret'), [
            'transcript' => "who's Cathy",
        ])
            ->assertOk()
            ->assertJsonPath('intent', AssistantInterpreter::INTENT_FIND_LEAD)
            ->assertJsonPath('data.0.code', $lead->code);
    }

    public function test_clear_reminders_asks_for_confirmation(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_assistant_clear');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->postJson(Domain::portal('/assistant/interpret'), [
            'transcript' => 'clear reminders',
        ])
            ->assertOk()
            ->assertJsonPath('intent', AssistantInterpreter::INTENT_CLEAR_REMINDERS)
            ->assertJsonPath('confirm', true)
            ->assertJsonPath('prompt', 'Clear all unread reminders?');
    }

    public function test_intent_hint_fills_in_when_regex_is_unknown(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_assistant_hint');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->postJson(Domain::portal('/assistant/interpret'), [
            'transcript' => 'could you check if I have anything lined up soon',
            'intent_hint' => AssistantInterpreter::INTENT_CALENDAR,
            'intent_score' => 0.61,
        ])
            ->assertOk()
            ->assertJsonPath('intent', AssistantInterpreter::INTENT_CALENDAR);
    }

    public function test_regex_intent_wins_over_intent_hint(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_assistant_hint_override');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->postJson(Domain::portal('/assistant/interpret'), [
            'transcript' => 'my progress',
            'intent_hint' => AssistantInterpreter::INTENT_CALENDAR,
            'intent_score' => 0.9,
        ])
            ->assertOk()
            ->assertJsonPath('intent', AssistantInterpreter::INTENT_PROGRESS);
    }

    public function test_low_intent_score_is_ignored(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_assistant_hint_low');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->postJson(Domain::portal('/assistant/interpret'), [
            'transcript' => 'could you check if I have anything lined up soon',
            'intent_hint' => AssistantInterpreter::INTENT_CALENDAR,
            'intent_score' => 0.2,
        ])
            ->assertOk()
            ->assertJsonPath('intent', AssistantInterpreter::INTENT_UNKNOWN);
    }

    public function test_how_many_leads_returns_progress_stats(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_assistant_lead_stats');

        $tenant->makeCurrent();
        Lead::factory()->count(2)->create([
            'assigned_to' => $user->id,
            'user_id' => $user->id,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->postJson(Domain::portal('/assistant/interpret'), [
            'transcript' => 'how many leads do i have?',
        ])
            ->assertOk()
            ->assertJsonPath('intent', AssistantInterpreter::INTENT_PROGRESS)
            ->assertJsonPath('data.open_leads', 2)
            ->assertJsonPath('prompt', 'You have 2 open leads, 0 overdue, and 0 closed deals.');
    }

    public function test_open_campaigns_returns_overview_with_actions(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_assistant_campaigns');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->postJson(Domain::portal('/assistant/interpret'), [
            'transcript' => 'open campaigns',
        ]);

        $response->assertOk();
        $response->assertJsonPath('intent', AssistantInterpreter::INTENT_OPEN);
        $response->assertJsonPath('prompt', 'Campaigns Overview');
        $response->assertJsonPath('slots.href', '/campaigns');
        $response->assertJsonPath('ask', 'What would you like to do?');
        $this->assertNotEmpty($response->json('options'));
        $this->assertTrue(collect($response->json('options'))->contains(fn (array $option): bool => $option['id'] === 'create_lead'));
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

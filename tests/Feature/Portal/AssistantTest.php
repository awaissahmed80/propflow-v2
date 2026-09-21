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
            ->assertJsonPath('prompt', AssistantInterpreter::UNKNOWN_PROMPT);
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

<?php

namespace Tests\Feature\Portal;

use App\Models\Contact;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class ContactCardTest extends TestCase
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

    public function test_guest_cannot_fetch_contact_card(): void
    {
        $this->getJson(Domain::portal('/contacts/'.fake()->uuid().'/card'))
            ->assertUnauthorized();
    }

    public function test_authenticated_tenant_user_can_fetch_contact_card(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_contact_card');

        $tenant->makeCurrent();
        $contact = Contact::factory()->create([
            'first_name' => 'Sara',
            'last_name' => 'Ahmed',
            'email_address' => 'sara@example.com',
            'phone_number' => '03001234567',
            'city' => 'Karachi',
            'country' => 'Pakistan',
            'type' => Contact::TYPE_CLIENT,
            'tag' => Contact::TAG_INVESTOR,
            'income_level' => Contact::INCOME_HIGH,
            'affordability' => Contact::AFFORDABILITY_LUXURY,
        ]);
        $stage = LeadStage::factory()->newLead()->create();
        Lead::factory()->create([
            'contact_id' => $contact->id,
            'lead_stage_id' => $stage->id,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->getJson(Domain::portal('/contacts/'.$contact->uuid.'/card'))
            ->assertOk()
            ->assertJsonPath('data.id', $contact->id)
            ->assertJsonPath('data.uuid', $contact->uuid)
            ->assertJsonPath('data.display_name', 'Sara Ahmed')
            ->assertJsonPath('data.email_address', 'sara@example.com')
            ->assertJsonPath('data.phone_number', '03001234567')
            ->assertJsonPath('data.city', 'Karachi')
            ->assertJsonPath('data.type', Contact::TYPE_CLIENT)
            ->assertJsonPath('data.tag', Contact::TAG_INVESTOR)
            ->assertJsonPath('data.leads_count', 1)
            ->assertJsonStructure([
                'data' => [
                    'id',
                    'uuid',
                    'display_name',
                    'first_name',
                    'last_name',
                    'email_address',
                    'phone_number',
                    'city',
                    'country',
                    'type',
                    'tag',
                    'income_level',
                    'affordability',
                    'leads_count',
                ],
            ]);
    }

    public function test_contact_card_returns_not_found_for_unknown_uuid(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_contact_card_missing');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->getJson(Domain::portal('/contacts/'.fake()->uuid().'/card'))
            ->assertNotFound();
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

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

class ContactIndexTest extends TestCase
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

    public function test_guest_cannot_view_contacts_page(): void
    {
        $this->get(Domain::portal('/contacts'))
            ->assertRedirect(Domain::auth());
    }

    public function test_authenticated_tenant_user_sees_contacts_payload(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_contacts_index');

        $tenant->makeCurrent();
        $contact = Contact::factory()->create([
            'first_name' => 'Sara',
            'last_name' => 'Ahmed',
            'email_address' => 'sara@example.com',
            'phone_number' => '03001234567',
            'type' => Contact::TYPE_LEAD,
            'tag' => Contact::TAG_INVESTOR,
        ]);
        $stage = LeadStage::factory()->newLead()->create();
        Lead::factory()->create([
            'contact_id' => $contact->id,
            'lead_stage_id' => $stage->id,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/contacts'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('contacts/index', false)
            ->has('contacts', 1)
            ->where('contacts.0.first_name', 'Sara')
            ->where('contacts.0.display_name', 'Sara Ahmed')
            ->where('contacts.0.email_address', 'sara@example.com')
            ->where('contacts.0.leads_count', 1)
            ->where('pagination.total', 1)
            ->where('pagination.per_page', 20)
            ->has('formOptions.tags')
            ->has('formOptions.types')
        );
    }

    public function test_contacts_are_paginated(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_contacts_pagination');

        $tenant->makeCurrent();
        Contact::factory()->count(21)->create();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $firstPage = $this->get(Domain::portal('/contacts'));
        $firstPage->assertOk();
        $firstPage->assertInertia(fn ($page) => $page
            ->component('contacts/index', false)
            ->has('contacts', 20)
            ->where('pagination.total', 21)
            ->where('pagination.current_page', 1)
            ->where('pagination.last_page', 2)
        );

        $secondPage = $this->get(Domain::portal('/contacts?page=2'));
        $secondPage->assertOk();
        $secondPage->assertInertia(fn ($page) => $page
            ->component('contacts/index', false)
            ->has('contacts', 1)
            ->where('pagination.current_page', 2)
        );
    }

    public function test_contacts_can_be_filtered_by_type_and_tag(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_contacts_filter');

        $tenant->makeCurrent();
        Contact::factory()->create([
            'first_name' => 'Investor',
            'type' => Contact::TYPE_CLIENT,
            'tag' => Contact::TAG_INVESTOR,
        ]);
        Contact::factory()->create([
            'first_name' => 'General',
            'type' => Contact::TYPE_LEAD,
            'tag' => Contact::TAG_GENERAL,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->get(Domain::portal('/contacts?type=CLIENT&tag=INVESTOR'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('contacts/index', false)
            ->has('contacts', 1)
            ->where('contacts.0.first_name', 'Investor')
            ->where('filters.type.0', 'CLIENT')
            ->where('filters.tag.0', 'INVESTOR')
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

<?php

namespace Tests\Feature\Portal;

use App\Models\Contact;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class ContactUpdateTest extends TestCase
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

    public function test_contact_can_be_updated(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_contact_update');

        $tenant->makeCurrent();
        $contact = Contact::factory()->create([
            'first_name' => 'Sara',
            'last_name' => 'Ahmed',
            'phone_number' => '03001234567',
            'type' => Contact::TYPE_LEAD,
            'tag' => Contact::TAG_GENERAL,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->patch(Domain::portal('/contacts/'.$contact->uuid), [
            'first_name' => 'Sonia',
            'last_name' => 'Koll',
            'phone_number' => '03009876543',
            'email_address' => 'sonia@example.com',
            'type' => Contact::TYPE_CLIENT,
            'tag' => Contact::TAG_AGENT,
            'city' => 'Lahore',
        ]);

        $response->assertRedirect(Domain::portal('/contacts'));

        $tenant->makeCurrent();
        $contact->refresh();
        $this->assertSame('Sonia', $contact->first_name);
        $this->assertSame('Koll', $contact->last_name);
        $this->assertSame('03009876543', $contact->phone_number);
        $this->assertSame('sonia@example.com', $contact->email_address);
        $this->assertSame(Contact::TYPE_CLIENT, $contact->type);
        $this->assertSame(Contact::TAG_AGENT, $contact->tag);
        $this->assertSame('Lahore', $contact->city);
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

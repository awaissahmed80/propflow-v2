<?php

namespace Tests\Feature\Portal;

use App\Models\Contact;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class ContactStoreTest extends TestCase
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

    public function test_contact_can_be_created(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_contact_store');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->post(Domain::portal('/contacts'), [
            'first_name' => 'Sara',
            'last_name' => 'Ahmed',
            'phone_number' => '03001234567',
            'email_address' => 'sara@example.com',
            'type' => Contact::TYPE_CLIENT,
            'tag' => Contact::TAG_INVESTOR,
            'city' => 'Karachi',
            'reference' => 'Acme Corp',
        ]);

        $response->assertRedirect(Domain::portal('/contacts'));

        $tenant->makeCurrent();
        $contact = Contact::query()->first();
        $this->assertNotNull($contact);
        $this->assertNotEmpty($contact->uuid);
        $this->assertSame('Sara', $contact->first_name);
        $this->assertSame('03001234567', $contact->phone_number);
        $this->assertSame(Contact::TYPE_CLIENT, $contact->type);
        $this->assertSame(Contact::TAG_INVESTOR, $contact->tag);
        Tenant::forgetCurrent();
    }

    public function test_contact_requires_phone_or_email(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_contact_store_validation');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->from(Domain::portal('/contacts'))->post(Domain::portal('/contacts'), [
            'first_name' => 'Sara',
        ]);

        $response->assertRedirect(Domain::portal('/contacts'));
        $response->assertSessionHasErrors(['phone_number']);
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

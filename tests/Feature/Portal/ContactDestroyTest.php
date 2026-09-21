<?php

namespace Tests\Feature\Portal;

use App\Models\Contact;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class ContactDestroyTest extends TestCase
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

    public function test_contact_can_be_soft_deleted(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_contact_destroy');

        $tenant->makeCurrent();
        $contact = Contact::factory()->create();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->delete(Domain::portal('/contacts/'.$contact->uuid));

        $response->assertRedirect(Domain::portal('/contacts'));

        $tenant->makeCurrent();
        $this->assertSoftDeleted('contacts', ['id' => $contact->id], 'tenant');
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

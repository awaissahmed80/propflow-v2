<?php

namespace Tests\Feature\Portal;

use App\Models\BookingDocumentType;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class BookingDocumentRequiredFlagTest extends TestCase
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

    public function test_catalog_includes_is_required_flag(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_booking_docs_flag_catalog');

        $tenant->makeCurrent();
        $catalog = BookingDocumentType::catalog();
        Tenant::forgetCurrent();

        $this->assertNotEmpty($catalog);
        $this->assertArrayHasKey('is_required', $catalog[0]);
        $nominee = collect($catalog)->firstWhere('label', 'nominee');
        $this->assertNotNull($nominee);
        $this->assertFalse($nominee['is_required']);
    }

    public function test_settings_can_toggle_document_type_required_flag(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_booking_docs_flag_toggle');

        $tenant->makeCurrent();
        $row = BookingDocumentType::factory()->create([
            'title' => 'Utility bill',
            'label' => 'utility_bill',
            'is_required' => true,
            'priority' => 1,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/settings/booking-documents/'.$row->label), [
            'title' => 'Utility bill',
            'description' => null,
            'is_required' => false,
        ])->assertRedirect();

        $tenant->makeCurrent();
        $this->assertFalse($row->fresh()->is_required);
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

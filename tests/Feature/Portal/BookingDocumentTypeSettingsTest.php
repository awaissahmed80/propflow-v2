<?php

namespace Tests\Feature\Portal;

use App\Models\BookingDocumentType;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class BookingDocumentTypeSettingsTest extends TestCase
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

    public function test_settings_bookings_section_includes_document_types(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_booking_docs_settings');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/settings/bookings'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('settings/index', false)
                ->where('section', 'bookings')
                ->has('bookingDocumentTypes', 4)
                ->where('bookingDocumentTypes.0.label', 'buyer_id')
                ->where('bookingDocumentTypes.0.is_required', true)
                ->where('bookingDocumentTypes.1.label', 'nominee')
                ->where('bookingDocumentTypes.1.is_required', false)
                ->where('sections', fn ($sections) => collect($sections)->contains(
                    fn ($section) => ($section['id'] ?? null) === 'bookings'
                        && ($section['label'] ?? null) === 'Bookings'
                ))
            );
    }

    public function test_booking_document_type_can_be_created(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_booking_docs_store');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/settings/booking-documents'), [
            'title' => 'Allotment letter',
            'description' => 'Signed allotment copy',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $row = BookingDocumentType::query()->where('title', 'Allotment letter')->first();
        $this->assertNotNull($row);
        $this->assertSame('allotment_letter', $row->label);
        $this->assertSame('Signed allotment copy', $row->description);
        $this->assertTrue($row->is_required);
        Tenant::forgetCurrent();
    }

    public function test_booking_document_type_can_be_created_as_optional(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_booking_docs_store_optional');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/settings/booking-documents'), [
            'title' => 'Extra affidavit',
            'is_required' => false,
        ])->assertRedirect();

        $tenant->makeCurrent();
        $row = BookingDocumentType::query()->where('title', 'Extra affidavit')->first();
        $this->assertNotNull($row);
        $this->assertFalse($row->is_required);
        Tenant::forgetCurrent();
    }

    public function test_booking_document_type_can_be_updated(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_booking_docs_update');

        $tenant->makeCurrent();
        $row = BookingDocumentType::factory()->create([
            'title' => 'Buyer ID',
            'label' => 'buyer_id',
            'description' => 'Old hint',
            'priority' => 1,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/settings/booking-documents/'.$row->label), [
            'title' => 'Buyer identity',
            'description' => 'CNIC or passport',
            'is_required' => false,
        ])->assertRedirect();

        $tenant->makeCurrent();
        $row->refresh();
        $this->assertSame('Buyer identity', $row->title);
        $this->assertSame('CNIC or passport', $row->description);
        $this->assertFalse($row->is_required);
        Tenant::forgetCurrent();
    }

    public function test_booking_document_types_can_be_reordered(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_booking_docs_reorder');

        $tenant->makeCurrent();
        $first = BookingDocumentType::factory()->create(['title' => 'A', 'label' => 'a', 'priority' => 1]);
        $second = BookingDocumentType::factory()->create(['title' => 'B', 'label' => 'b', 'priority' => 2]);
        $third = BookingDocumentType::factory()->create(['title' => 'C', 'label' => 'c', 'priority' => 3]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->put(Domain::portal('/settings/booking-documents/reorder'), [
            'order' => [$third->id, $first->id, $second->id],
        ])->assertRedirect();

        $tenant->makeCurrent();
        $this->assertSame(1, (int) $third->fresh()->priority);
        $this->assertSame(2, (int) $first->fresh()->priority);
        $this->assertSame(3, (int) $second->fresh()->priority);
        Tenant::forgetCurrent();
    }

    public function test_booking_document_type_can_be_deleted(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_booking_docs_delete');

        $tenant->makeCurrent();
        $keep = BookingDocumentType::factory()->create(['title' => 'Keep', 'label' => 'keep', 'priority' => 1]);
        $drop = BookingDocumentType::factory()->create(['title' => 'Drop', 'label' => 'drop', 'priority' => 2]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->delete(Domain::portal('/settings/booking-documents/'.$drop->label))
            ->assertRedirect();

        $tenant->makeCurrent();
        $this->assertDatabaseMissing('booking_document_types', ['id' => $drop->id], 'tenant');
        $this->assertSame(1, (int) $keep->fresh()->priority);
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

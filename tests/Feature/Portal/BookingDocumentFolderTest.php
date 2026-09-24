<?php

namespace Tests\Feature\Portal;

use App\Models\Asset;
use App\Models\AssetFolder;
use App\Models\Order;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\AssetManager;
use App\Support\Domain;
use Tests\TestCase;

class BookingDocumentFolderTest extends TestCase
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

    public function test_ensure_document_folder_creates_top_level_folder(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_booking_doc_folder');

        $tenant->makeCurrent();
        $order = Order::factory()->create([
            'stage' => Order::STAGE_TOKEN,
            'status' => Order::STATUS_HOLD,
        ]);

        $this->assertNull($order->document_folder_id);

        $folder = $order->ensureDocumentFolder();

        $this->assertNotNull($folder->id);
        $this->assertNull($folder->parent_id);
        $this->assertSame(AssetManager::KIND_DOCUMENT, $folder->kind);
        $this->assertSame($folder->id, $order->fresh()->document_folder_id);

        $again = $order->fresh()->ensureDocumentFolder();
        $this->assertSame($folder->id, $again->id);

        Tenant::forgetCurrent();
        unset($actor);
    }

    public function test_syncing_order_documents_places_files_in_booking_folder(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_booking_doc_sync_folder');

        $tenant->makeCurrent();
        $order = Order::factory()->create([
            'stage' => Order::STAGE_TOKEN,
            'status' => Order::STATUS_HOLD,
        ]);
        $doc = Asset::factory()->document()->create(['name' => 'cnic.pdf']);
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->postJson(Domain::portal('/documents/sync'), [
            'assetable_type' => 'order',
            'assetable_id' => $order->id,
            'linkage' => AssetManager::LINKAGE_DOCUMENT,
            'label' => 'buyer_id',
            'asset_ids' => [$doc->id],
        ])->assertOk();

        $tenant->makeCurrent();
        $order = $order->fresh();
        $this->assertNotNull($order->document_folder_id);
        $this->assertDatabaseHas('asset_folder_items', [
            'asset_id' => $doc->id,
            'folder_id' => $order->document_folder_id,
        ], 'tenant');
        $this->assertDatabaseHas('asset_folders', [
            'id' => $order->document_folder_id,
            'parent_id' => null,
            'kind' => AssetManager::KIND_DOCUMENT,
        ], 'tenant');
        Tenant::forgetCurrent();
    }

    public function test_opened_booking_ensures_document_folder_id_in_payload(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_booking_doc_opened');

        $tenant->makeCurrent();
        $order = Order::factory()->create([
            'stage' => Order::STAGE_TOKEN,
            'status' => Order::STATUS_HOLD,
        ]);
        $code = $order->code;
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/bookings?booking='.$code))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('bookings/index', false)
                ->where('openedBooking.order.code', $code)
                ->where('openedBooking.order.document_folder_id', fn ($id) => is_int($id) && $id > 0)
            );

        $tenant->makeCurrent();
        $order = $order->fresh();
        $this->assertNotNull($order->document_folder_id);
        $this->assertInstanceOf(
            AssetFolder::class,
            AssetFolder::query()->find($order->document_folder_id),
        );
        Tenant::forgetCurrent();
    }

    public function test_booking_panel_json_endpoint_returns_order_and_deal(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_booking_panel_json');

        $tenant->makeCurrent();
        $order = Order::factory()->create([
            'stage' => Order::STAGE_TOKEN,
            'status' => Order::STATUS_HOLD,
        ]);
        $code = $order->code;
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->getJson(Domain::portal('/bookings/'.$code.'/panel'))
            ->assertOk()
            ->assertJsonPath('order.code', $code)
            ->assertJsonStructure([
                'order' => ['id', 'code', 'document_folder_id'],
                'deal' => ['stage', 'kyc_documents'],
            ]);

        $this->assertIsInt($response->json('order.document_folder_id'));
        $this->assertGreaterThan(0, $response->json('order.document_folder_id'));
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

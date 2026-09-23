<?php

namespace Tests\Feature\Portal;

use App\Models\Asset;
use App\Models\AssetLink;
use App\Models\Campaign;
use App\Models\Order;
use App\Models\Project;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\DealPipeline;
use App\Services\TenantContext;
use App\Support\AssetManager;
use App\Support\Domain;
use Tests\TestCase;

class AssetLinkSyncTest extends TestCase
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

    public function test_sync_replaces_gallery_links_without_deleting_assets(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_asset_sync');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        $keep = Asset::factory()->media()->create(['name' => 'keep.jpg']);
        $drop = Asset::factory()->media()->create(['name' => 'drop.jpg']);
        $add = Asset::factory()->media()->create(['name' => 'add.jpg']);

        AssetLink::query()->create([
            'assetable_id' => $project->id,
            'assetable_type' => Project::class,
            'asset_id' => $keep->id,
            'linkage' => AssetManager::LINKAGE_GALLERY,
        ]);
        AssetLink::query()->create([
            'assetable_id' => $project->id,
            'assetable_type' => Project::class,
            'asset_id' => $drop->id,
            'linkage' => AssetManager::LINKAGE_GALLERY,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->postJson(Domain::portal('/media/sync'), [
            'assetable_type' => 'project',
            'assetable_id' => $project->id,
            'linkage' => AssetManager::LINKAGE_GALLERY,
            'asset_ids' => [$keep->id, $add->id],
        ])->assertOk();

        $tenant->makeCurrent();
        $linkedIds = AssetLink::query()
            ->where('assetable_type', Project::class)
            ->where('assetable_id', $project->id)
            ->where('linkage', AssetManager::LINKAGE_GALLERY)
            ->pluck('asset_id')
            ->map(fn ($id): int => (int) $id)
            ->sort()
            ->values()
            ->all();

        $this->assertSame([(int) $keep->id, (int) $add->id], $linkedIds);
        $this->assertNotSoftDeleted('assets', ['id' => $drop->id], 'tenant');
        Tenant::forgetCurrent();
    }

    public function test_sync_thumbnail_keeps_single_link(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_asset_sync_thumb');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        $thumb = Asset::factory()->media()->create();
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->postJson(Domain::portal('/media/sync'), [
            'assetable_type' => 'project',
            'assetable_id' => $project->id,
            'linkage' => AssetManager::LINKAGE_THUMBNAIL,
            'asset_ids' => [$thumb->id],
        ])->assertOk();

        $tenant->makeCurrent();
        $this->assertSame(1, AssetLink::query()
            ->where('assetable_id', $project->id)
            ->where('linkage', AssetManager::LINKAGE_THUMBNAIL)
            ->count());
        Tenant::forgetCurrent();
    }

    public function test_sync_documents_via_document_endpoint(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_asset_sync_docs');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        $doc = Asset::factory()->document()->create();
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->postJson(Domain::portal('/documents/sync'), [
            'assetable_type' => 'project',
            'assetable_id' => $project->id,
            'linkage' => AssetManager::LINKAGE_DOCUMENT,
            'asset_ids' => [$doc->id],
        ])->assertOk();

        $tenant->makeCurrent();
        $this->assertDatabaseHas('asset_links', [
            'assetable_id' => $project->id,
            'asset_id' => $doc->id,
            'linkage' => AssetManager::LINKAGE_DOCUMENT,
        ], 'tenant');
        Tenant::forgetCurrent();
    }

    public function test_sync_campaign_gallery_and_hero(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_asset_sync_campaign');

        $tenant->makeCurrent();
        $campaign = Campaign::factory()->create();
        $hero = Asset::factory()->media()->create(['name' => 'hero.jpg']);
        $galleryA = Asset::factory()->media()->create(['name' => 'a.jpg']);
        $galleryB = Asset::factory()->media()->create(['name' => 'b.jpg']);
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->postJson(Domain::portal('/media/sync'), [
            'assetable_type' => 'campaign',
            'assetable_id' => $campaign->id,
            'linkage' => AssetManager::LINKAGE_THUMBNAIL,
            'asset_ids' => [$hero->id],
        ])->assertOk();

        $this->postJson(Domain::portal('/media/sync'), [
            'assetable_type' => 'campaign',
            'assetable_id' => $campaign->id,
            'linkage' => AssetManager::LINKAGE_GALLERY,
            'asset_ids' => [$galleryA->id, $galleryB->id],
        ])->assertOk();

        $tenant->makeCurrent();
        $this->assertDatabaseHas('asset_links', [
            'assetable_type' => Campaign::class,
            'assetable_id' => $campaign->id,
            'asset_id' => $hero->id,
            'linkage' => AssetManager::LINKAGE_THUMBNAIL,
        ], 'tenant');
        $this->assertSame(2, AssetLink::query()
            ->where('assetable_type', Campaign::class)
            ->where('assetable_id', $campaign->id)
            ->where('linkage', AssetManager::LINKAGE_GALLERY)
            ->count());
        Tenant::forgetCurrent();
    }

    public function test_documents_can_be_synced_to_an_order_for_kyc(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_order_kyc_docs');

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
            'asset_ids' => [$doc->id],
        ])->assertOk();

        $tenant->makeCurrent();
        $this->assertDatabaseHas('asset_links', [
            'assetable_type' => Order::class,
            'assetable_id' => $order->id,
            'asset_id' => $doc->id,
            'linkage' => AssetManager::LINKAGE_DOCUMENT,
        ], 'tenant');

        $snapshot = app(DealPipeline::class)->snapshot($order->fresh());
        $this->assertTrue($snapshot['kyc_docs_ready']);
        $this->assertCount(1, $snapshot['kyc_documents']);
        $this->assertTrue($snapshot['liaison_active']);
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

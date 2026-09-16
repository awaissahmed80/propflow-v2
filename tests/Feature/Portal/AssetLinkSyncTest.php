<?php

namespace Tests\Feature\Portal;

use App\Models\Asset;
use App\Models\AssetLink;
use App\Models\Project;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
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

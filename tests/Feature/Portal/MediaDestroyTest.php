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
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class MediaDestroyTest extends TestCase
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

    public function test_destroying_media_removes_links_and_files(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_media_destroy');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        $filename = 'kill-me.jpg';
        $relative = 'media/'.$filename;
        File::ensureDirectoryExists(public_path('assets/media'));
        File::put(public_path('assets/'.$relative), 'fake-image');

        $asset = Asset::factory()->media()->create([
            'name' => $filename,
            'path' => $relative,
            'thumbnail' => $relative,
        ]);

        AssetLink::query()->create([
            'assetable_id' => $project->id,
            'assetable_type' => Project::class,
            'asset_id' => $asset->id,
            'linkage' => AssetManager::LINKAGE_GALLERY,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->deleteJson(Domain::portal('/media/'.$asset->id))
            ->assertOk()
            ->assertJsonPath('ok', true);

        $tenant->makeCurrent();
        $this->assertDatabaseMissing('assets', ['id' => $asset->id], 'tenant');
        $this->assertDatabaseMissing('asset_links', [
            'asset_id' => $asset->id,
        ], 'tenant');
        $this->assertFileDoesNotExist(public_path('assets/'.$relative));
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

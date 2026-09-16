<?php

namespace Tests\Feature\Portal;

use App\Models\Asset;
use App\Models\AssetFolder;
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

class DocumentFolderTest extends TestCase
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

    public function test_can_create_nested_folder_up_to_two_levels(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_doc_folders');

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $parent = $this->postJson(Domain::portal('/documents/folders'), [
            'name' => 'Contracts',
        ])->assertCreated()->json('data');

        $child = $this->postJson(Domain::portal('/documents/folders'), [
            'name' => 'Signed',
            'parent_id' => $parent['id'],
        ])->assertCreated()->json('data');

        $this->assertSame($parent['id'], $child['parent_id']);

        $this->postJson(Domain::portal('/documents/folders'), [
            'name' => 'Too deep',
            'parent_id' => $child['id'],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('parent_id');

        Tenant::forgetCurrent();
    }

    public function test_can_move_document_into_folder(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_doc_move');

        $tenant->makeCurrent();
        $folder = AssetFolder::factory()->create(['name' => 'Legal']);
        $asset = Asset::factory()->document()->create();
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->postJson(Domain::portal('/documents/folders/move'), [
            'asset_ids' => [$asset->id],
            'folder_id' => $folder->id,
        ])->assertOk();

        $tenant->makeCurrent();
        $this->assertDatabaseHas('asset_folder_items', [
            'asset_id' => $asset->id,
            'folder_id' => $folder->id,
        ], 'tenant');
        Tenant::forgetCurrent();
    }

    public function test_deleting_folder_destroys_contained_files_and_unlinks(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_doc_folder_delete');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        $folder = AssetFolder::factory()->create(['name' => 'Temp']);
        $filename = 'gone.pdf';
        $relative = 'documents/'.$filename;
        File::ensureDirectoryExists(public_path('assets/documents'));
        File::put(public_path('assets/'.$relative), 'pdf');

        $asset = Asset::factory()->document()->create([
            'name' => $filename,
            'path' => $relative,
            'thumbnail' => $relative,
        ]);
        $asset->folders()->attach($folder->id);

        AssetLink::query()->create([
            'assetable_id' => $project->id,
            'assetable_type' => Project::class,
            'asset_id' => $asset->id,
            'linkage' => AssetManager::LINKAGE_DOCUMENT,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->deleteJson(Domain::portal('/documents/folders/'.$folder->id))
            ->assertOk();

        $tenant->makeCurrent();
        $this->assertSoftDeleted('assets', ['id' => $asset->id], 'tenant');
        $this->assertDatabaseMissing('asset_links', ['asset_id' => $asset->id], 'tenant');
        $this->assertDatabaseMissing('asset_folders', ['id' => $folder->id], 'tenant');
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

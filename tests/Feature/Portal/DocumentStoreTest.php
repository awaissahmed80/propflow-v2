<?php

namespace Tests\Feature\Portal;

use App\Models\Asset;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\AssetManager;
use App\Support\Domain;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class DocumentStoreTest extends TestCase
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

    public function test_authenticated_tenant_user_can_upload_document(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_document_store');

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $file = UploadedFile::fake()->create('specs.pdf', 120, 'application/pdf');

        $this->postJson(Domain::portal('/documents'), [
            'file' => $file,
        ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'specs.pdf')
            ->assertJsonPath('data.tag', AssetManager::KIND_DOCUMENT);

        $tenant->makeCurrent();
        $asset = Asset::query()->first();
        $this->assertNotNull($asset);
        $this->assertFileExists(public_path('assets/'.$asset->path));
        File::delete(public_path('assets/'.$asset->path));
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

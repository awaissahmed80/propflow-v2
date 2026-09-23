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

class MediaStoreTest extends TestCase
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

    public function test_authenticated_tenant_user_can_upload_media(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_media_store');

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $file = UploadedFile::fake()->image('pool.jpg', 800, 600);

        $response = $this->postJson(Domain::portal('/media'), [
            'file' => $file,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.name', 'pool.jpg')
            ->assertJsonPath('data.tag', AssetManager::KIND_MEDIA);

        $tenant->makeCurrent();
        $asset = Asset::query()->first();
        $this->assertNotNull($asset);
        $this->assertSame(AssetManager::KIND_MEDIA, $asset->tag);
        $this->assertFileExists(public_path('assets/'.$asset->path));
        File::delete(public_path('assets/'.$asset->path));
        Tenant::forgetCurrent();
    }

    public function test_authenticated_tenant_user_can_upload_audio_media(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_media_audio_store');

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $file = UploadedFile::fake()->create('voice-note.mp3', 120, 'audio/mpeg');

        $response = $this->postJson(Domain::portal('/media'), [
            'file' => $file,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.name', 'voice-note.mp3')
            ->assertJsonPath('data.tag', AssetManager::KIND_MEDIA);

        $tenant->makeCurrent();
        $asset = Asset::query()->where('name', 'voice-note.mp3')->first();
        $this->assertNotNull($asset);
        $this->assertFileExists(public_path('assets/'.$asset->path));
        File::delete(public_path('assets/'.$asset->path));
        Tenant::forgetCurrent();
    }

    public function test_authenticated_tenant_user_can_upload_webm_media(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_media_webm_store');

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        // Use video/webm so Laravel's mime guesser resolves the extension to "webm"
        // (audio/webm often maps to "weba", which fails the mimes:webm rule).
        $file = UploadedFile::fake()->create('recording.webm', 180, 'video/webm');

        $response = $this->postJson(Domain::portal('/media'), [
            'file' => $file,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.name', 'recording.webm')
            ->assertJsonPath('data.tag', AssetManager::KIND_MEDIA);

        $tenant->makeCurrent();
        $asset = Asset::query()->where('name', 'recording.webm')->first();
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

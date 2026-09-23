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

class AssetLinkUpdateTest extends TestCase
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

    public function test_asset_link_label_and_secure_flag_can_be_updated(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_asset_link_update');

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        $asset = Asset::query()->create([
            'name' => 'specs.pdf',
            'path' => 'documents/specs.pdf',
            'type' => 'application/pdf',
            'tag' => AssetManager::KIND_DOCUMENT,
            'size' => 1200,
        ]);
        $link = AssetLink::query()->create([
            'assetable_id' => $project->id,
            'assetable_type' => Project::class,
            'asset_id' => $asset->id,
            'linkage' => AssetManager::LINKAGE_DOCUMENT,
        ]);
        $linkId = $link->id;
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/projects/'.$project->code))
            ->patch(Domain::portal('/asset-links/'.$linkId), [
                'label' => 'Floor plan',
                'is_secure' => true,
            ])
            ->assertRedirect(Domain::portal('/projects/'.$project->code));

        $tenant->makeCurrent();
        $link->refresh();
        $this->assertSame('Floor plan', $link->label);
        $this->assertTrue($link->is_secure);
        Tenant::forgetCurrent();
    }

    public function test_project_show_includes_document_label_and_secure_flag(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_asset_link_show');

        $tenant->makeCurrent();
        $project = Project::factory()->create(['title' => 'Harbor Towers']);
        $asset = Asset::query()->create([
            'name' => 'agreement.pdf',
            'path' => 'documents/agreement.pdf',
            'type' => 'application/pdf',
            'tag' => AssetManager::KIND_DOCUMENT,
            'size' => 800,
        ]);
        AssetLink::query()->create([
            'assetable_id' => $project->id,
            'assetable_type' => Project::class,
            'asset_id' => $asset->id,
            'linkage' => AssetManager::LINKAGE_DOCUMENT,
            'label' => 'Sale agreement',
            'is_secure' => true,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/projects/'.$project->code))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('projects/details', false)
                ->has('project.documents', 1)
                ->where('project.documents.0.name', 'agreement.pdf')
                ->where('project.documents.0.label', 'Sale agreement')
                ->where('project.documents.0.title', 'Sale agreement')
                ->where('project.documents.0.is_secure', true)
                ->has('project.documents.0.link_id')
            );
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

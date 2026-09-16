<?php

namespace Tests\Feature\Portal;

use App\Models\Asset;
use App\Models\AssetLabel;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class DocumentLabelTest extends TestCase
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

    public function test_can_create_label_and_assign_to_document(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_doc_labels');

        $tenant->makeCurrent();
        $asset = Asset::factory()->document()->create();
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $label = $this->postJson(Domain::portal('/documents/labels'), [
            'name' => 'Contract',
            'color' => '#0f766e',
        ])->assertCreated()->json('data');

        $this->postJson(Domain::portal('/documents/'.$asset->id.'/labels'), [
            'label_ids' => [$label['id']],
        ])->assertOk()
            ->assertJsonPath('data.0.name', 'Contract');

        $tenant->makeCurrent();
        $this->assertTrue(
            AssetLabel::query()->find($label['id'])->assets()->whereKey($asset->id)->exists()
        );
        Tenant::forgetCurrent();
    }

    public function test_can_filter_documents_by_label(): void
    {
        [$actor, $tenant] = $this->createTenantUser('tenant_doc_label_filter');

        $tenant->makeCurrent();
        $label = AssetLabel::factory()->create(['name' => 'Legal']);
        $matched = Asset::factory()->document()->create(['name' => 'a.pdf']);
        $other = Asset::factory()->document()->create(['name' => 'b.pdf']);
        $matched->labels()->attach($label->id);
        Tenant::forgetCurrent();

        $this->actingAs($actor);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->getJson(Domain::portal('/documents?label_ids='.$label->id))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $matched->id);

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

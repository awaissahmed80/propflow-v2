<?php

namespace Tests\Feature\Portal;

use App\Models\Asset;
use App\Models\AssetLink;
use App\Models\Campaign;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\LogActivity;
use App\Models\Order;
use App\Models\OrderPayment;
use App\Models\Project;
use App\Models\ProjectBlock;
use App\Models\Task;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\Unit;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\AssetManager;
use App\Support\Domain;
use Tests\TestCase;

class HardDeleteCleanupTest extends TestCase
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

    public function test_hard_deleting_lead_purges_tasks_asset_links_and_activity_logs(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_hard_delete_lead');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $lead = Lead::factory()->archived()->create([
            'lead_stage_id' => $stage->id,
        ]);

        $task = Task::factory()->forLead($lead)->systemLog()->create([
            'user_id' => $user->id,
        ]);

        $asset = Asset::factory()->create(['tag' => AssetManager::KIND_MEDIA]);
        AssetLink::query()->create([
            'assetable_id' => $task->id,
            'assetable_type' => Task::class,
            'asset_id' => $asset->id,
            'linkage' => AssetManager::LINKAGE_GALLERY,
        ]);

        LogActivity::query()->create([
            'logable_type' => Lead::class,
            'logable_id' => $lead->id,
            'action' => 'updated',
            'changes' => ['score' => 10],
            'previous' => ['score' => 5],
            'user_id' => $user->id,
        ]);

        $leadId = $lead->id;
        $taskId = $task->id;
        Tenant::forgetCurrent();

        $this->delete(Domain::portal('/leads/'.$lead->code))
            ->assertRedirect(Domain::portal('/leads?view=archive'));

        $tenant->makeCurrent();
        $this->assertDatabaseMissing('leads', ['id' => $leadId], 'tenant');
        $this->assertDatabaseMissing('tasks', ['id' => $taskId], 'tenant');
        $this->assertDatabaseMissing('asset_links', [
            'assetable_type' => Task::class,
            'assetable_id' => $taskId,
        ], 'tenant');
        $this->assertDatabaseMissing('log_activities', [
            'logable_type' => Lead::class,
            'logable_id' => $leadId,
        ], 'tenant');
        Tenant::forgetCurrent();
    }

    public function test_hard_deleting_project_purges_gallery_links_and_activity_logs(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_hard_delete_project');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $tenant->makeCurrent();
        $project = Project::factory()->create(['title' => 'Cascade Project']);
        $asset = Asset::factory()->create(['tag' => AssetManager::KIND_MEDIA]);

        AssetLink::query()->create([
            'assetable_id' => $project->id,
            'assetable_type' => Project::class,
            'asset_id' => $asset->id,
            'linkage' => AssetManager::LINKAGE_GALLERY,
        ]);

        LogActivity::query()->create([
            'logable_type' => Project::class,
            'logable_id' => $project->id,
            'action' => 'created',
            'changes' => ['title' => 'Cascade Project'],
            'previous' => null,
            'user_id' => $user->id,
        ]);

        $projectId = $project->id;
        $code = $project->code;
        Tenant::forgetCurrent();

        $this->delete(Domain::portal('/projects/'.$code))
            ->assertRedirect(Domain::portal('/projects'));

        $tenant->makeCurrent();
        $this->assertDatabaseMissing('projects', ['id' => $projectId], 'tenant');
        $this->assertDatabaseMissing('asset_links', [
            'assetable_type' => Project::class,
            'assetable_id' => $projectId,
        ], 'tenant');
        $this->assertDatabaseMissing('log_activities', [
            'logable_type' => Project::class,
            'logable_id' => $projectId,
        ], 'tenant');
        Tenant::forgetCurrent();
    }

    public function test_hard_deleting_campaign_purges_activity_logs(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_hard_delete_campaign');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $tenant->makeCurrent();
        $campaign = Campaign::factory()->create();

        LogActivity::query()->create([
            'logable_type' => Campaign::class,
            'logable_id' => $campaign->id,
            'action' => 'created',
            'changes' => ['name' => $campaign->name],
            'previous' => null,
            'user_id' => $user->id,
        ]);

        $campaignId = $campaign->id;
        $slug = $campaign->slug;
        Tenant::forgetCurrent();

        $this->delete(Domain::portal('/campaigns/'.$slug))
            ->assertRedirect(Domain::portal('/campaigns'));

        $tenant->makeCurrent();
        $this->assertDatabaseMissing('campaigns', ['id' => $campaignId], 'tenant');
        $this->assertDatabaseMissing('log_activities', [
            'logable_type' => Campaign::class,
            'logable_id' => $campaignId,
        ], 'tenant');
        Tenant::forgetCurrent();
    }

    public function test_hard_deleting_lead_purges_order_payment_receipt_links(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_hard_delete_lead_payment');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $lead = Lead::factory()->archived()->create([
            'lead_stage_id' => $stage->id,
        ]);
        $order = Order::factory()->create([
            'lead_id' => $lead->id,
            'contact_id' => null,
            'project_id' => null,
            'unit_id' => null,
        ]);
        $payment = OrderPayment::factory()->create([
            'order_id' => $order->id,
        ]);
        $receipt = Asset::factory()->create(['tag' => AssetManager::KIND_DOCUMENT]);
        AssetLink::query()->create([
            'assetable_id' => $payment->id,
            'assetable_type' => OrderPayment::class,
            'asset_id' => $receipt->id,
            'linkage' => AssetManager::LINKAGE_DOCUMENT,
        ]);
        $payment->forceFill(['receipt_asset_id' => $receipt->id])->save();

        $leadId = $lead->id;
        $paymentId = $payment->id;
        $code = $lead->code;
        Tenant::forgetCurrent();

        $this->delete(Domain::portal('/leads/'.$code))
            ->assertRedirect(Domain::portal('/leads?view=archive'));

        $tenant->makeCurrent();
        $this->assertDatabaseMissing('leads', ['id' => $leadId], 'tenant');
        $this->assertDatabaseMissing('orders', ['id' => $order->id], 'tenant');
        $this->assertDatabaseMissing('order_payments', ['id' => $paymentId], 'tenant');
        $this->assertDatabaseMissing('asset_links', [
            'assetable_type' => OrderPayment::class,
            'assetable_id' => $paymentId,
        ], 'tenant');
        Tenant::forgetCurrent();
    }

    public function test_hard_deleting_project_block_purges_unit_activity_logs(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_hard_delete_block');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        $block = ProjectBlock::factory()->create(['project_id' => $project->id]);
        $unit = Unit::factory()->create([
            'project_id' => $project->id,
            'project_block_id' => $block->id,
        ]);

        LogActivity::query()->create([
            'logable_type' => Unit::class,
            'logable_id' => $unit->id,
            'action' => 'created',
            'changes' => ['name' => $unit->name],
            'previous' => null,
            'user_id' => $user->id,
        ]);

        $blockId = $block->id;
        $unitId = $unit->id;
        Tenant::forgetCurrent();

        $this->deleteJson(Domain::portal('/project-blocks/'.$blockId))
            ->assertOk()
            ->assertJsonPath('ok', true);

        $tenant->makeCurrent();
        $this->assertDatabaseMissing('project_blocks', ['id' => $blockId], 'tenant');
        $this->assertDatabaseMissing('units', ['id' => $unitId], 'tenant');
        $this->assertDatabaseMissing('log_activities', [
            'logable_type' => Unit::class,
            'logable_id' => $unitId,
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

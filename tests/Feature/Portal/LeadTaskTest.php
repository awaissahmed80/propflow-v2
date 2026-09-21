<?php

namespace Tests\Feature\Portal;

use App\Models\Asset;
use App\Models\AssetLink;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Task;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class LeadTaskTest extends TestCase
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

    public function test_creating_a_lead_writes_a_system_log(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_task_created');

        $tenant->makeCurrent();
        $lead = Lead::factory()->create([
            'user_id' => $user->id,
            'source' => 'Website',
        ]);
        Tenant::forgetCurrent();

        $tenant->makeCurrent();
        $log = Task::query()
            ->where('lead_id', $lead->id)
            ->where('action', 'Lead created')
            ->first();

        $this->assertNotNull($log);
        $this->assertSame(Task::TYPE_LOG, $log->type);
        $this->assertSame(Task::STATUS_COMPLETED, $log->status);
        $this->assertSame($user->id, $log->user_id);
        $this->assertStringContainsString($user->display_name, (string) $log->comments);
        $this->assertStringContainsString('Website', (string) $log->comments);
        Tenant::forgetCurrent();
    }

    public function test_user_can_record_an_update_and_schedule_the_next_action(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_task_store');

        $tenant->makeCurrent();
        $lead = Lead::factory()->create([
            'user_id' => $user->id,
            'next_action' => Lead::NEXT_ACTION_DO_NOTHING,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $due = now()->addDay()->startOfMinute();

        $response = $this->from(Domain::portal('/leads'))
            ->post(Domain::portal('/leads/'.$lead->code.'/tasks'), [
                'action' => 'Call',
                'comments' => 'Spoke about the payment plan.',
                'next_action' => Lead::NEXT_ACTION_FOLLOW_UP,
                'due_date' => $due->toIso8601String(),
            ]);

        $response->assertRedirect(Domain::portal('/leads'));

        $tenant->makeCurrent();
        $lead->refresh();
        $this->assertSame(Lead::NEXT_ACTION_FOLLOW_UP, $lead->next_action);
        $this->assertNotNull($lead->contacted_at);
        $this->assertTrue($lead->due_date?->equalTo($due));

        $update = Task::query()
            ->where('lead_id', $lead->id)
            ->where('action', 'Call')
            ->first();
        $scheduled = Task::query()
            ->where('lead_id', $lead->id)
            ->where('status', Task::STATUS_PENDING)
            ->first();

        $this->assertNotNull($update);
        $this->assertSame(Task::TYPE_ACTION, $update->type);
        $this->assertSame(Task::STATUS_COMPLETED, $update->status);
        $this->assertSame('Spoke about the payment plan.', $update->comments);
        $this->assertSame($user->id, $update->user_id);
        $this->assertNotNull($scheduled);
        $this->assertSame(Lead::NEXT_ACTION_FOLLOW_UP, $scheduled->action);
        Tenant::forgetCurrent();
    }

    public function test_update_links_library_attachments(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_task_attachments');

        $tenant->makeCurrent();
        $lead = Lead::factory()->create(['user_id' => $user->id]);
        $image = Asset::factory()->media()->create();
        $document = Asset::factory()->document()->create();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/leads'))
            ->post(Domain::portal('/leads/'.$lead->code.'/tasks'), [
                'action' => 'Call',
                'comments' => 'Sent the brochure.',
                'next_action' => Lead::NEXT_ACTION_DO_NOTHING,
                'media_ids' => [$image->id],
                'document_ids' => [$document->id],
            ])
            ->assertRedirect(Domain::portal('/leads'))
            ->assertSessionHasNoErrors();

        $tenant->makeCurrent();
        $update = Task::query()
            ->where('lead_id', $lead->id)
            ->where('action', 'Call')
            ->first();

        $this->assertNotNull($update);

        $links = AssetLink::query()
            ->where('assetable_type', Task::class)
            ->where('assetable_id', $update->id)
            ->get();

        $this->assertCount(2, $links);
        $this->assertTrue($links->contains(fn (AssetLink $link): bool => $link->asset_id === $image->id && $link->linkage === 'GALLERY'));
        $this->assertTrue($links->contains(fn (AssetLink $link): bool => $link->asset_id === $document->id && $link->linkage === 'DOCUMENT'));
        Tenant::forgetCurrent();
    }

    public function test_update_rejects_attachments_from_the_wrong_library(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_task_attachment_kind');

        $tenant->makeCurrent();
        $lead = Lead::factory()->create(['user_id' => $user->id]);
        $document = Asset::factory()->document()->create();
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/leads'))
            ->post(Domain::portal('/leads/'.$lead->code.'/tasks'), [
                'action' => 'Note',
                'comments' => 'Wrong file type.',
                'next_action' => Lead::NEXT_ACTION_DO_NOTHING,
                'media_ids' => [$document->id],
            ])
            ->assertRedirect(Domain::portal('/leads'))
            ->assertSessionHasErrors('media_ids');
    }

    public function test_update_requires_notes(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_task_validation');

        $tenant->makeCurrent();
        $lead = Lead::factory()->create(['user_id' => $user->id]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $response = $this->from(Domain::portal('/leads'))
            ->post(Domain::portal('/leads/'.$lead->code.'/tasks'), [
                'action' => 'Call',
                'comments' => '',
                'next_action' => Lead::NEXT_ACTION_DO_NOTHING,
            ]);

        $response->assertRedirect(Domain::portal('/leads'));
        $response->assertSessionHasErrors('comments');
    }

    public function test_stage_change_writes_a_system_log(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_lead_task_stage');

        $tenant->makeCurrent();
        $stage = LeadStage::factory()->newLead()->create();
        $contacted = LeadStage::factory()->create([
            'label' => 'contacted',
            'title' => 'Contacted',
            'priority' => 2,
        ]);
        $lead = Lead::factory()->create([
            'lead_stage_id' => $stage->id,
            'user_id' => $user->id,
        ]);
        Tenant::forgetCurrent();

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->from(Domain::portal('/leads'))
            ->patch(Domain::portal('/leads/'.$lead->code), [
                'lead_stage_id' => $contacted->id,
            ])
            ->assertRedirect(Domain::portal('/leads'));

        $tenant->makeCurrent();
        $log = Task::query()
            ->where('lead_id', $lead->id)
            ->where('action', 'Stage changed')
            ->first();

        $this->assertNotNull($log);
        $this->assertSame(Task::TYPE_LOG, $log->type);
        $this->assertStringContainsString('Contacted', (string) $log->comments);
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

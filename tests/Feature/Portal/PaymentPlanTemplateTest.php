<?php

namespace Tests\Feature\Portal;

use App\Models\PaymentPlanTemplate;
use App\Models\Project;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Tests\TestCase;

class PaymentPlanTemplateTest extends TestCase
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

    public function test_plan_templates_index_seeds_defaults(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_plan_templates_index');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/plan-templates'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('plan-templates/index', false)
                ->has('templates', 2)
            );

        $tenant->makeCurrent();
        $this->assertSame(2, PaymentPlanTemplate::query()->where('is_system', true)->count());
        Tenant::forgetCurrent();
    }

    public function test_plan_template_can_be_created_updated_and_deleted(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_plan_templates_crud');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $tenant->makeCurrent();
        $project = Project::factory()->create();
        Tenant::forgetCurrent();

        $this->post(Domain::portal('/plan-templates'), [
            'title' => 'Custom 24 month',
            'project_id' => $project->id,
            'frequency' => 'monthly',
            'installment_count' => 24,
            'balloon_every' => null,
            'down_payment_percent' => 15,
            'handover_percent' => 5,
            'late_fee_basis' => 'monthly',
            'late_fee_rate' => 1.5,
            'is_enabled' => true,
        ])->assertRedirect();

        $tenant->makeCurrent();
        $template = PaymentPlanTemplate::query()->where('title', 'Custom 24 month')->first();
        $this->assertNotNull($template);
        $this->assertSame($project->id, $template->project_id);
        $this->assertSame(24, (int) $template->installment_count);
        Tenant::forgetCurrent();

        $this->put(Domain::portal('/plan-templates/'.$template->id), [
            'title' => 'Custom 36 month',
            'project_id' => null,
            'frequency' => 'quarterly',
            'installment_count' => 12,
            'balloon_every' => 4,
            'down_payment_percent' => 20,
            'handover_percent' => 10,
            'late_fee_basis' => 'daily',
            'late_fee_rate' => 0.5,
            'is_enabled' => false,
        ])->assertRedirect();

        $tenant->makeCurrent();
        $template->refresh();
        $this->assertSame('Custom 36 month', $template->title);
        $this->assertNull($template->project_id);
        $this->assertSame('quarterly', $template->frequency);
        $this->assertFalse($template->is_enabled);
        Tenant::forgetCurrent();

        $this->delete(Domain::portal('/plan-templates/'.$template->id))->assertRedirect();

        $tenant->makeCurrent();
        $this->assertNull(PaymentPlanTemplate::query()->find($template->id));
        Tenant::forgetCurrent();
    }

    public function test_system_plan_templates_cannot_be_deleted(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_plan_templates_system');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->get(Domain::portal('/plan-templates'))->assertOk();

        $tenant->makeCurrent();
        $system = PaymentPlanTemplate::query()->where('is_system', true)->first();
        $this->assertNotNull($system);
        Tenant::forgetCurrent();

        $this->delete(Domain::portal('/plan-templates/'.$system->id))
            ->assertSessionHasErrors('template');

        $tenant->makeCurrent();
        $this->assertNotNull(PaymentPlanTemplate::query()->find($system->id));
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

<?php

namespace Tests\Feature\Public;

use App\Models\Campaign;
use App\Models\CampaignForm;
use App\Models\CampaignFormSubmission;
use App\Models\Contact;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Project;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Support\Domain;
use Tests\TestCase;

class PublicFormSubmitTest extends TestCase
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

    public function test_embed_submit_creates_contact_and_lead(): void
    {
        [$tenant, $form] = $this->createActiveFormTenant('tenant_public_form_embed');

        $response = $this->postJson(Domain::app('/'.$tenant->identifier.'/forms/'.$form->public_id.'/submit'), [
            'first_name' => 'Sara',
            'last_name' => 'Khan',
            'phone_number' => '+923001112233',
            'email_address' => 'sara@example.com',
            'channel' => 'embed',
        ]);

        $response->assertCreated()
            ->assertJsonPath('contact_reused', false);

        $tenant->makeCurrent();
        $this->assertDatabaseHas('contacts', [
            'email_address' => 'sara@example.com',
            'first_name' => 'Sara',
        ], 'tenant');
        $this->assertDatabaseHas('leads', [
            'source' => 'Website form',
        ], 'tenant');
        $this->assertSame(1, CampaignFormSubmission::query()->count());
        Tenant::forgetCurrent();
    }

    public function test_landing_submit_stamps_campaign_and_project(): void
    {
        [$tenant, $form, $campaign, $project] = $this->createActiveCampaignTenant('tenant_public_form_landing');

        $response = $this->postJson(Domain::app('/'.$tenant->identifier.'/forms/'.$form->public_id.'/submit'), [
            'first_name' => 'Ali',
            'phone_number' => '+923004445566',
            'channel' => 'landing',
            'campaign_public_id' => $campaign->public_id,
        ]);

        $response->assertCreated();

        $tenant->makeCurrent();
        $lead = Lead::query()->latest('id')->first();
        $this->assertNotNull($lead);
        $this->assertSame($campaign->id, $lead->campaign_id);
        $this->assertSame($project->id, $lead->project_id);
        $this->assertSame('Campaign landing', $lead->source);
        Tenant::forgetCurrent();
    }

    public function test_submit_reuses_existing_contact_by_email(): void
    {
        [$tenant, $form] = $this->createActiveFormTenant('tenant_public_form_dedupe');

        $tenant->makeCurrent();
        $existing = Contact::factory()->create([
            'email_address' => 'reuse@example.com',
            'first_name' => 'Existing',
        ]);
        Tenant::forgetCurrent();

        $response = $this->postJson(Domain::app('/'.$tenant->identifier.'/forms/'.$form->public_id.'/submit'), [
            'first_name' => 'Updated',
            'email_address' => 'reuse@example.com',
            'channel' => 'embed',
        ]);

        $response->assertCreated()
            ->assertJsonPath('contact_reused', true);

        $tenant->makeCurrent();
        $this->assertSame(1, Contact::query()->count());
        $existing->refresh();
        $this->assertSame('Updated', $existing->first_name);
        $this->assertSame($existing->id, Lead::query()->latest('id')->value('contact_id'));
        Tenant::forgetCurrent();
    }

    public function test_inactive_form_cannot_be_submitted(): void
    {
        [$user, $tenant] = $this->createTenantUser('tenant_public_form_inactive');

        $tenant->makeCurrent();
        LeadStage::factory()->newLead()->create();
        $form = CampaignForm::factory()->create([
            'status' => CampaignForm::STATUS_DRAFT,
        ]);
        Tenant::forgetCurrent();

        $this->postJson(Domain::app('/'.$tenant->identifier.'/forms/'.$form->public_id.'/submit'), [
            'first_name' => 'Nope',
            'email_address' => 'nope@example.com',
        ])->assertNotFound();
    }

    public function test_landing_page_renders_for_active_campaign(): void
    {
        [$tenant, $form, $campaign] = $this->createActiveCampaignTenant('tenant_public_landing_page');

        $this->get(Domain::app('/'.$tenant->identifier.'/c/'.$campaign->public_id))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('campaigns/landing', false)
                ->where('campaign.public_id', $campaign->public_id)
                ->where('form.id', $form->public_id)
            );
    }

    /**
     * @return array{0: Tenant, 1: CampaignForm}
     */
    protected function createActiveFormTenant(string $database): array
    {
        [, $tenant] = $this->createTenantUser($database);

        $tenant->makeCurrent();
        LeadStage::factory()->newLead()->create();
        $form = CampaignForm::factory()->active()->create();
        Tenant::forgetCurrent();

        return [$tenant, $form];
    }

    /**
     * @return array{0: Tenant, 1: CampaignForm, 2: Campaign, 3: Project}
     */
    protected function createActiveCampaignTenant(string $database): array
    {
        [, $tenant] = $this->createTenantUser($database);

        $tenant->makeCurrent();
        LeadStage::factory()->newLead()->create();
        $project = Project::factory()->create();
        $form = CampaignForm::factory()->active()->create([
            'settings' => array_merge(CampaignForm::defaultSettings(), [
                'source' => 'Website form',
                'landing_source' => 'Campaign landing',
            ]),
        ]);
        $campaign = Campaign::factory()->active()->create([
            'project_id' => $project->id,
            'campaign_form_id' => $form->id,
        ]);
        Tenant::forgetCurrent();

        return [$tenant, $form, $campaign, $project];
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

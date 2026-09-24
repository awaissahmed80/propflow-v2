<?php

namespace Tests\Feature\Portal;

use App\Models\BookingDocumentType;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Order;
use App\Models\PaymentAccount;
use App\Models\PaymentInstallment;
use App\Models\Project;
use App\Models\Task;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\Unit;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Domain;
use Database\Seeders\TenantPermissionsSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class BookingActivityTimelineTest extends TestCase
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

    public function test_booking_panel_activities_include_prior_lead_history(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_booking_activity_lead');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $tenant->makeCurrent();
        $lead->tasks()->create([
            'user_id' => $user->id,
            'action' => 'Lead created',
            'comments' => 'Lead entered the pipeline.',
            'status' => Task::STATUS_COMPLETED,
            'type' => Task::TYPE_LOG,
            'created_at' => now()->subDays(3),
            'updated_at' => now()->subDays(3),
        ]);
        $lead->tasks()->create([
            'user_id' => $user->id,
            'action' => 'Call',
            'comments' => 'Discussed budget with buyer.',
            'status' => Task::STATUS_COMPLETED,
            'type' => Task::TYPE_ACTION,
            'created_at' => now()->subDay(),
            'updated_at' => now()->subDay(),
        ]);
        Tenant::forgetCurrent();

        $this->post(Domain::portal('/leads/'.$lead->code.'/convert'), [
            'unit_id' => $unit->id,
            'booking_kind' => Order::KIND_TOKEN,
            'agreed_price' => 5000,
            'token_amount' => 500,
            'installment_count' => 1,
            'first_due_on' => '2026-11-01',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $order = Order::query()->firstOrFail();
        Tenant::forgetCurrent();

        $this->getJson(Domain::portal('/bookings/'.$order->code.'/panel'))
            ->assertOk()
            ->assertJsonPath('order.code', $order->code)
            ->assertJsonFragment(['action' => 'Lead created', 'source' => 'lead'])
            ->assertJsonFragment(['action' => 'Call', 'source' => 'lead'])
            ->assertJsonFragment(['action' => 'Deal booked', 'source' => 'lead'])
            ->assertJsonFragment(['action' => 'Booking created', 'source' => 'booking']);
    }

    public function test_token_verified_activity_includes_proof_of_payment_attachment(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_booking_activity_receipt');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/leads/'.$lead->code.'/convert'), [
            'unit_id' => $unit->id,
            'booking_kind' => Order::KIND_TOKEN,
            'agreed_price' => 5000,
            'token_amount' => 500,
            'installment_count' => 1,
            'first_due_on' => '2026-11-01',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $order = Order::query()->with(['contact', 'paymentPlan.installments'])->firstOrFail();
        PaymentAccount::ensureDefaults();
        $accountId = PaymentAccount::query()
            ->where('is_enabled', true)
            ->orderByDesc('is_default')
            ->value('id');
        $tokenAmount = $order->paymentPlan?->installments
            ?->firstWhere('kind', PaymentInstallment::KIND_TOKEN)
            ?->amount;
        Tenant::forgetCurrent();

        $this->post(Domain::portal('/bookings/'.$order->code.'/enter-booking-kyc'), [
            'contact_name' => $order->contact?->display_name ?: 'Buyer Test',
            'phone_number' => $order->contact?->phone_number ?: '03001234567',
            'email_address' => $order->contact?->email_address,
            'cnic' => $order->contact?->cnic ?: '42101-1234567-1',
            'project_id' => $order->project_id,
            'unit_id' => $order->unit_id,
            'payment_account_id' => $accountId,
            'agreed_price' => (float) $order->agreed_price,
            'token_amount' => (float) ($tokenAmount ?: 500),
            'method' => 'Cash',
            'reference' => 'TOK-RECEIPT',
            'paid_on' => now()->toDateString(),
            'receipt' => UploadedFile::fake()->create('token-proof.pdf', 120, 'application/pdf'),
        ])->assertRedirect();

        $tenant->makeCurrent();
        $order->refresh();
        $receiptAssetId = $order->payments()->value('receipt_asset_id');
        Tenant::forgetCurrent();

        $this->assertNotNull($receiptAssetId);

        $panel = $this->getJson(Domain::portal('/bookings/'.$order->code.'/panel'))
            ->assertOk()
            ->assertJsonFragment(['action' => 'Token verified']);

        $verified = collect($panel->json('deal.activities'))
            ->firstWhere('action', 'Token verified');

        $this->assertNotNull($verified);
        $this->assertNotEmpty($verified['attachments'] ?? []);
        $this->assertSame((int) $receiptAssetId, (int) $verified['attachments'][0]['id']);

        $kycDocs = collect($panel->json('deal.kyc_documents'));
        $payOrderDoc = $kycDocs->first(
            fn (array $doc): bool => ($doc['label'] ?? null) === BookingDocumentType::LABEL_PAY_ORDER
                && (int) ($doc['id'] ?? 0) === (int) $receiptAssetId,
        );

        $this->assertNotNull($payOrderDoc, 'Token payment proof should appear under Documents as pay order.');

        $tenant->makeCurrent();
        $order->refresh();
        $this->assertNotNull($order->document_folder_id);
        $this->assertDatabaseHas('asset_folder_items', [
            'asset_id' => $receiptAssetId,
            'folder_id' => $order->document_folder_id,
        ], 'tenant');
        Tenant::forgetCurrent();
    }

    /**
     * @return array{0: User, 1: Tenant, 2: Lead, 3: Unit}
     */
    protected function bookableLead(string $database): array
    {
        $user = User::factory()->tenant()->create();
        $tenant = Tenant::factory()->create(['database' => $database]);
        TenantUser::factory()->owner()->create([
            'user_id' => $user->id,
            'tenant_id' => $tenant->id,
        ]);

        $tenant->makeCurrent();
        Artisan::call('db:seed', [
            '--class' => TenantPermissionsSeeder::class,
            '--database' => 'tenant',
            '--force' => true,
        ]);
        $user->assignRole('Admin');

        LeadStage::factory()->create([
            'label' => 'closed_won',
            'title' => 'Closed Won',
            'priority' => 9,
        ]);
        $project = Project::factory()->create();
        $unit = Unit::factory()->create([
            'project_id' => $project->id,
            'status' => Unit::STATUS_AVAILABLE,
            'price' => 10000,
        ]);
        $lead = Lead::factory()->create([
            'project_id' => $project->id,
            'unit_id' => $unit->id,
            'assigned_to' => $user->id,
            'user_id' => $user->id,
            'lead_stage_id' => LeadStage::factory()->newLead(),
        ]);
        Tenant::forgetCurrent();

        return [$user, $tenant, $lead, $unit];
    }
}

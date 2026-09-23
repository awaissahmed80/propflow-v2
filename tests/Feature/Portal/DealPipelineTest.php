<?php

namespace Tests\Feature\Portal;

use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Order;
use App\Models\OrderPayment;
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
use Illuminate\Http\UploadedFile;
use Spatie\LaravelPdf\Facades\Pdf;
use Tests\TestCase;

class DealPipelineTest extends TestCase
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

    public function test_a_closed_deal_moves_from_booking_to_handover(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_deal_pipeline');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/leads/'.$lead->code.'/convert'), [
            'unit_id' => $unit->id,
            'booking_kind' => Order::KIND_TOKEN,
            'agreed_price' => 10000,
            'token_amount' => 1000,
            'installment_count' => 1,
            'first_due_on' => '2026-11-01',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $order = Order::query()->first();
        $this->assertSame(Order::STAGE_TOKEN, $order->stage);
        $this->assertSame(Order::STATUS_HOLD, $order->status);
        $this->assertSame(Unit::STATUS_TOKEN, $unit->fresh()->status);
        Tenant::forgetCurrent();

        $this->post(Domain::portal('/bookings/'.$order->code.'/enter-booking-kyc'))->assertRedirect();

        $this->post(Domain::portal('/bookings/'.$order->code.'/booking'), [
            'identity_kind' => 'cnic',
            'identity_number' => '42101-1234567-1',
            'overseas' => 1,
            'nominee_name' => 'Sara Ahmed',
            'nominee_relation' => 'Spouse',
            'nominee_cnic' => '42101-7654321-1',
            'plot_or_file' => 'F-18',
            'category' => 'corner',
            'premium' => 0,
            'discount' => 0,
        ])->assertRedirect();

        $this->post(Domain::portal('/bookings/'.$order->code.'/plan'), [
            'template' => 'quarterly_3y',
            'down_payment' => 1000,
            'handover_percent' => 10,
            'first_due_on' => '2026-10-01',
            'late_fee_basis' => 'monthly',
            'late_fee_rate' => 2,
        ])->assertRedirect();

        $tenant->makeCurrent();
        $order->refresh();
        $order->load('paymentPlan.installments', 'payments');
        $this->assertSame(Order::STAGE_ACTIVE, $order->stage);
        $this->assertSame(Order::STATUS_IN_PROGRESS, $order->status);
        $this->assertSame('10000.00', $order->paymentPlan->installments->reduce(
            fn (string $carry, PaymentInstallment $row): string => number_format(((float) $carry) + (float) $row->amount, 2, '.', ''),
            '0.00',
        ));
        $this->assertTrue($order->paymentPlan->installments->contains(
            fn (PaymentInstallment $row): bool => $row->kind === PaymentInstallment::KIND_DOWN_PAYMENT && $row->status === 'paid',
        ));
        $this->assertTrue($order->paymentPlan->installments->contains(
            fn (PaymentInstallment $row): bool => $row->kind === PaymentInstallment::KIND_HANDOVER,
        ));
        Tenant::forgetCurrent();

        $this->get(Domain::portal('/bookings/'.$order->code.'/booking-form'))
            ->assertOk()
            ->assertSee('Booking form')
            ->assertSee('F-18');

        $this->post(Domain::portal('/bookings/'.$order->code.'/handover'), [
            'original_files' => 1,
            'allotment_letter' => 1,
            'registry_docs' => 1,
        ])->assertSessionHasErrors('order');

        $this->post(Domain::portal('/bookings/'.$order->code.'/payments'), [
            'amount' => 9000,
            'method' => 'pay_order',
            'reference' => 'PO-100',
            'paid_on' => '2026-10-02',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $order->project()->update(['balloting_enabled' => true]);
        Tenant::forgetCurrent();

        $this->post(Domain::portal('/bookings/'.$order->code.'/ballot'), [
            'plot_number' => 'P-18',
            'dimensions' => '25x50',
        ])->assertRedirect();

        $this->post(Domain::portal('/bookings/'.$order->code.'/transfer'), [
            'first_name' => 'Ali',
            'last_name' => 'Khan',
            'phone_number' => '03001234567',
            'cnic' => '42101-0000000-1',
            'ndc_cleared' => 1,
        ])->assertRedirect();

        $tenant->makeCurrent();
        $order->refresh();
        $this->assertSame('P-18', $order->plot_or_file);
        $this->assertSame(Order::INVENTORY_PLOT, $order->inventory_kind);
        $this->assertSame(Order::STAGE_ACTIVE, $order->stage);
        $this->assertSame('Ali', $order->contact->first_name);
        $this->assertSame(1, $order->transfers()->count());
        $this->assertSame($order->contact_id, $lead->fresh()->contact_id);
        Tenant::forgetCurrent();

        $this->post(Domain::portal('/bookings/'.$order->code.'/handover'), [
            'original_files' => 1,
            'allotment_letter' => 1,
            'registry_docs' => 1,
        ])->assertRedirect();

        $this->post(Domain::portal('/bookings/'.$order->code.'/deliver'))->assertRedirect();

        $tenant->makeCurrent();
        $order->refresh();
        $this->assertSame(Order::STATUS_COMPLETED, $order->status);
        $this->assertSame(Order::STAGE_CLOSED, $order->stage);
        $this->assertSame(Unit::STATUS_SOLD, $unit->fresh()->status);
        Tenant::forgetCurrent();

        $this->get(Domain::portal('/users?user='.$this->membershipCode($tenant, $user)))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('selectedUser.stats.closed_deals', 1));
    }

    public function test_installment_reminders_are_marked_seven_days_out(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_deal_remind');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);
        $this->post(Domain::portal('/leads/'.$lead->code.'/convert'), [
            'unit_id' => $unit->id,
            'booking_kind' => Order::KIND_RESERVE,
            'agreed_price' => 5000,
            'installment_count' => 1,
            'first_due_on' => now()->addDays(7)->toDateString(),
        ]);

        $tenant->makeCurrent();
        $order = Order::query()->first();
        Tenant::forgetCurrent();

        $this->post(Domain::portal('/bookings/'.$order->code.'/enter-booking-kyc'))->assertRedirect();

        $this->post(Domain::portal('/bookings/'.$order->code.'/booking'), [
            'identity_kind' => 'passport',
            'identity_number' => 'AB1234567',
            'nominee_name' => 'Nora',
            'nominee_relation' => 'Sister',
            'nominee_cnic' => '42101-1111111-1',
            'plot_or_file' => 'F-2',
            'category' => 'standard',
        ]);
        $this->post(Domain::portal('/bookings/'.$order->code.'/plan'), [
            'template' => 'custom',
            'down_payment' => 0,
            'handover_percent' => 0,
            'installment_count' => 1,
            'frequency' => 'monthly',
            'first_due_on' => now()->addDays(7)->toDateString(),
        ]);

        $tenant->makeCurrent();
        $row = PaymentInstallment::query()->where('status', PaymentInstallment::STATUS_PENDING)->first();
        $this->assertNotNull($row);
        $this->assertSame(now()->addDays(7)->toDateString(), $row->due_on->toDateString());
        Tenant::forgetCurrent();

        $this->artisan('deals:remind')->assertSuccessful();

        $tenant->makeCurrent();
        $this->assertNotNull($row->fresh()->reminded_at);
        Tenant::forgetCurrent();
    }

    public function test_cash_payment_can_include_proof(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_deal_cash');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/leads/'.$lead->code.'/convert'), [
            'unit_id' => $unit->id,
            'booking_kind' => Order::KIND_TOKEN,
            'agreed_price' => 10000,
            'token_amount' => 1000,
            'installment_count' => 1,
            'first_due_on' => '2026-11-01',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $order = Order::query()->first();
        Tenant::forgetCurrent();

        $this->post(Domain::portal('/bookings/'.$order->code.'/enter-booking-kyc'))->assertRedirect();

        $this->post(Domain::portal('/bookings/'.$order->code.'/booking'), [
            'identity_kind' => 'cnic',
            'identity_number' => '42101-1234567-1',
            'nominee_name' => 'Sara',
            'nominee_relation' => 'Spouse',
            'nominee_cnic' => '42101-7654321-1',
            'plot_or_file' => 'F-1',
            'category' => 'standard',
            'premium' => 0,
            'discount' => 0,
        ])->assertRedirect();

        $this->post(Domain::portal('/bookings/'.$order->code.'/plan'), [
            'template' => 'quarterly_3y',
            'down_payment' => 1000,
            'handover_percent' => 10,
            'first_due_on' => '2026-10-01',
        ])->assertRedirect();

        $this->from(Domain::portal('/bookings'))
            ->post(Domain::portal('/bookings/'.$order->code.'/payments'), [
                'amount' => 500,
                'method' => OrderPayment::METHOD_CASH,
                'paid_on' => '2026-10-02',
                'receipt' => UploadedFile::fake()->create('receipt.pdf', 120, 'application/pdf'),
            ])->assertRedirect('/bookings?booking='.$order->code);

        $this->get(Domain::portal('/bookings?booking='.$order->code))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('bookings/index', false)
                ->has('openedBooking.deal.payments')
                ->has('openedBooking.deal.ledger.total_paid')
                ->has('openedBooking.deal.ledger.total_outstanding')
                ->has('openedBooking.deal.installments')
            );

        $tenant->makeCurrent();
        $payment = OrderPayment::query()->where('order_id', $order->id)->latest('id')->first();
        $this->assertNotNull($payment);
        $this->assertSame(OrderPayment::METHOD_CASH, $payment->method);
        $this->assertNotNull($payment->receipt_asset_id);
        Tenant::forgetCurrent();

        Pdf::fake();

        $this->get(Domain::portal('/bookings/'.$order->code.'/payments/'.$payment->id.'/voucher'))
            ->assertOk();

        Pdf::assertRespondedWithPdf(function ($pdf) use ($order, $payment) {
            return $pdf->viewName === 'portal.payment-voucher'
                && $pdf->isDownload()
                && $pdf->downloadName === 'PV-'.$order->code.'-'.$payment->id.'.pdf'
                && $pdf->contains('Payment voucher')
                && $pdf->contains('500.00');
        });
    }

    public function test_transfer_with_pending_installments_keeps_active_stage(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_deal_transfer_pending');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/leads/'.$lead->code.'/convert'), [
            'unit_id' => $unit->id,
            'booking_kind' => Order::KIND_TOKEN,
            'agreed_price' => 10000,
            'token_amount' => 1000,
            'installment_count' => 1,
            'first_due_on' => '2026-11-01',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $order = Order::query()->first();
        $fromContactId = $order->contact_id;
        Tenant::forgetCurrent();

        $this->post(Domain::portal('/bookings/'.$order->code.'/enter-booking-kyc'))->assertRedirect();

        $this->post(Domain::portal('/bookings/'.$order->code.'/booking'), [
            'identity_kind' => 'cnic',
            'identity_number' => '42101-1234567-1',
            'nominee_name' => 'Sara',
            'nominee_relation' => 'Spouse',
            'nominee_cnic' => '42101-7654321-1',
            'plot_or_file' => 'F-9',
            'category' => 'standard',
            'premium' => 0,
            'discount' => 0,
        ])->assertRedirect();

        $this->post(Domain::portal('/bookings/'.$order->code.'/plan'), [
            'template' => 'custom',
            'down_payment' => 1000,
            'handover_percent' => 0,
            'installment_count' => 2,
            'frequency' => 'monthly',
            'first_due_on' => '2026-10-01',
        ])->assertRedirect();

        $this->post(Domain::portal('/bookings/'.$order->code.'/transfer'), [
            'first_name' => 'New',
            'last_name' => 'Buyer',
            'phone_number' => '03009998877',
            'ndc_cleared' => 0,
        ])->assertRedirect();

        $tenant->makeCurrent();
        $order->refresh()->load(['paymentPlan.installments', 'payments', 'activities']);
        $this->assertSame(Order::STAGE_ACTIVE, $order->stage);
        $this->assertNotSame($fromContactId, $order->contact_id);
        $this->assertSame('New', $order->contact->first_name);
        $this->assertGreaterThan(0, $order->paymentPlan->installments->where('status', PaymentInstallment::STATUS_PENDING)->count());
        $this->assertTrue($order->activities->contains(fn ($task): bool => $task->action === 'Buyer transferred'));
        Tenant::forgetCurrent();
    }

    public function test_staff_can_post_booking_activity_and_ledger_pdf_downloads(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_deal_activity_ledger');

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
        $order = Order::query()->first();
        Tenant::forgetCurrent();

        $this->post(Domain::portal('/bookings/'.$order->code.'/activity'), [
            'action' => 'Note',
            'comments' => 'Called buyer about token verification.',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $this->assertDatabaseHas('tasks', [
            'taskable_type' => $order->getMorphClass(),
            'taskable_id' => $order->id,
            'action' => 'Note',
            'type' => Task::TYPE_ACTION,
            'stage' => Order::STAGE_TOKEN,
        ], 'tenant');
        $installment = $order->fresh()->paymentPlan?->installments()->first();
        Tenant::forgetCurrent();

        Pdf::fake();

        $this->get(Domain::portal('/bookings/'.$order->code.'/ledger.pdf'))->assertOk();
        Pdf::assertRespondedWithPdf(fn ($pdf) => $pdf->viewName === 'portal.ledger-statement' && $pdf->isDownload());

        if ($installment) {
            $tenant->makeCurrent();
            PaymentAccount::ensureDefaults();
            $bank = PaymentAccount::defaultFor(PaymentAccount::TYPE_BANK);
            $bank->update([
                'bank_name' => 'Meezan Bank',
                'account_title' => 'Propflow Receivables',
                'account_number' => '0011223344',
            ]);
            Tenant::forgetCurrent();

            Pdf::fake();
            $this->get(Domain::portal('/bookings/'.$order->code.'/installments/'.$installment->id.'/pay-voucher'))
                ->assertOk();
            Pdf::assertRespondedWithPdf(fn ($pdf) => $pdf->viewName === 'portal.payment-request-voucher'
                && $pdf->contains('Meezan Bank')
                && $pdf->contains('Propflow Receivables')
                && $pdf->contains('0011223344'));
        }
    }

    public function test_receivables_defaults_to_upcoming_and_month_filter_includes_history(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_receivables_filters');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/leads/'.$lead->code.'/convert'), [
            'unit_id' => $unit->id,
            'booking_kind' => Order::KIND_RESERVE,
            'agreed_price' => 3000,
            'installment_count' => 1,
            'first_due_on' => now()->addDays(10)->toDateString(),
        ])->assertRedirect();

        $tenant->makeCurrent();
        $order = Order::query()->first();
        $plan = $order->paymentPlan;
        $past = PaymentInstallment::query()->create([
            'payment_plan_id' => $plan->id,
            'sequence' => 99,
            'kind' => PaymentInstallment::KIND_INSTALLMENT,
            'label' => 'Past paid',
            'amount' => '100.00',
            'due_on' => '2026-01-15',
            'status' => PaymentInstallment::STATUS_PAID,
            'paid_amount' => '100.00',
            'paid_at' => now(),
        ]);
        Tenant::forgetCurrent();

        $this->get(Domain::portal('/receivables/installments'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('receivables/installments', false)
                ->where('filters.mode', 'upcoming')
                ->has('installments')
            );

        $this->get(Domain::portal('/receivables/installments?month=2026-01'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('filters.mode', 'history')
                ->where('filters.month', '2026-01')
                ->has('installments', 1)
                ->where('installments.0.id', $past->id)
            );
    }

    public function test_verify_token_advances_to_booking_kyc(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_deal_verify_kyc');

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
        $order = Order::query()->firstOrFail();
        Tenant::forgetCurrent();

        $this->post(Domain::portal('/bookings/'.$order->code.'/enter-booking-kyc'))
            ->assertRedirect();

        $tenant->makeCurrent();
        $order->refresh();
        $this->assertSame(Order::STAGE_BOOKING_KYC, $order->stage);
        $this->assertSame(Order::STATUS_IN_PROGRESS, $order->status);
        $this->assertNotNull($order->booking_verified_at);
        Tenant::forgetCurrent();
    }

    public function test_kyc_completion_activates_without_payment_plan(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_deal_kyc_active');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/leads/'.$lead->code.'/convert'), [
            'unit_id' => $unit->id,
            'booking_kind' => Order::KIND_TOKEN,
            'agreed_price' => 8000,
            'token_amount' => 800,
            'installment_count' => 1,
            'first_due_on' => '2026-11-01',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $order = Order::query()->firstOrFail();
        Tenant::forgetCurrent();

        $this->post(Domain::portal('/bookings/'.$order->code.'/enter-booking-kyc'))->assertRedirect();

        $this->post(Domain::portal('/bookings/'.$order->code.'/booking'), [
            'identity_kind' => 'cnic',
            'identity_number' => '42101-1234567-1',
            'nominee_name' => 'Sara',
            'nominee_relation' => 'Spouse',
            'nominee_cnic' => '42101-7654321-1',
            'plot_or_file' => 'F-2',
            'category' => 'standard',
            'premium' => 0,
            'discount' => 0,
        ])->assertRedirect();

        $tenant->makeCurrent();
        $order->refresh();
        $this->assertSame(Order::STAGE_ACTIVE, $order->stage);
        $this->assertSame(Order::STATUS_IN_PROGRESS, $order->status);
        $this->assertNull($order->paymentPlan?->template);
        Tenant::forgetCurrent();
    }

    public function test_direct_sale_payment_without_installment_plan(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_deal_direct_pay');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/leads/'.$lead->code.'/convert'), [
            'unit_id' => $unit->id,
            'booking_kind' => Order::KIND_TOKEN,
            'agreed_price' => 4000,
            'token_amount' => 400,
            'installment_count' => 1,
            'first_due_on' => '2026-11-01',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $order = Order::query()->firstOrFail();
        Tenant::forgetCurrent();

        $this->post(Domain::portal('/bookings/'.$order->code.'/enter-booking-kyc'))->assertRedirect();
        $this->post(Domain::portal('/bookings/'.$order->code.'/booking'), [
            'identity_kind' => 'cnic',
            'identity_number' => '42101-1234567-1',
            'nominee_name' => 'Sara',
            'nominee_relation' => 'Spouse',
            'nominee_cnic' => '42101-7654321-1',
            'plot_or_file' => 'F-3',
            'category' => 'standard',
            'premium' => 0,
            'discount' => 0,
        ])->assertRedirect();

        $this->from(Domain::portal('/bookings'))
            ->post(Domain::portal('/bookings/'.$order->code.'/payments'), [
                'amount' => 4000,
                'method' => OrderPayment::METHOD_CASH,
                'paid_on' => '2026-10-02',
            ])->assertRedirect();

        $tenant->makeCurrent();
        $order->refresh()->load('payments');
        $this->assertSame(1, $order->payments->count());
        $this->assertSame('4000.00', $order->payments->first()->amount);
        $this->assertNull($order->payments->first()->payment_installment_id);
        Tenant::forgetCurrent();
    }

    public function test_manual_status_rejects_automated_labels(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_deal_status_guard');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/leads/'.$lead->code.'/convert'), [
            'unit_id' => $unit->id,
            'booking_kind' => Order::KIND_TOKEN,
            'agreed_price' => 2000,
            'token_amount' => 200,
            'installment_count' => 1,
            'first_due_on' => '2026-11-01',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $order = Order::query()->firstOrFail();
        Tenant::forgetCurrent();

        $this->from(Domain::portal('/bookings?booking='.$order->code))
            ->patch(Domain::portal('/bookings/'.$order->code), [
                'status' => Order::STATUS_OVERDUE,
            ])->assertSessionHasErrors('status');

        $this->patch(Domain::portal('/bookings/'.$order->code), [
            'status' => Order::STATUS_IN_PROGRESS,
        ])->assertRedirect('/bookings?booking='.$order->code);

        $tenant->makeCurrent();
        $this->assertSame(Order::STATUS_IN_PROGRESS, $order->fresh()->status);
        Tenant::forgetCurrent();
    }

    public function test_transfer_allowed_before_active_stage(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_deal_transfer_token');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $this->post(Domain::portal('/leads/'.$lead->code.'/convert'), [
            'unit_id' => $unit->id,
            'booking_kind' => Order::KIND_TOKEN,
            'agreed_price' => 6000,
            'token_amount' => 600,
            'installment_count' => 1,
            'first_due_on' => '2026-11-01',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $order = Order::query()->firstOrFail();
        $fromContactId = $order->contact_id;
        Tenant::forgetCurrent();

        $this->post(Domain::portal('/bookings/'.$order->code.'/transfer'), [
            'first_name' => 'New',
            'last_name' => 'Buyer',
            'phone_number' => '03001112233',
            'ndc_cleared' => 1,
        ])->assertRedirect();

        $tenant->makeCurrent();
        $order->refresh();
        $this->assertNotSame($fromContactId, $order->contact_id);
        $this->assertSame(Order::STAGE_TOKEN, $order->stage);
        $this->assertSame('New', $order->contact->first_name);
        Tenant::forgetCurrent();
    }

    protected function membershipCode(Tenant $tenant, User $user): string
    {
        return (string) TenantUser::query()
            ->where('tenant_id', $tenant->id)
            ->where('user_id', $user->id)
            ->value('code');
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

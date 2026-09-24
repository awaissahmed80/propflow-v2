<?php

namespace Tests\Feature\Portal;

use App\Mail\BookingConfirmationLetterMail;
use App\Models\Asset;
use App\Models\BookingDocumentType;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Order;
use App\Models\OrderPayment;
use App\Models\PaymentAccount;
use App\Models\PaymentInstallment;
use App\Models\Project;
use App\Models\Setting;
use App\Models\Task;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\Unit;
use App\Models\User;
use App\Services\DealPipeline;
use App\Services\TenantContext;
use App\Support\AssetManager;
use App\Support\Domain;
use Database\Seeders\TenantPermissionsSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Mail;
use Illuminate\Testing\TestResponse;
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

        $this->postVerifyToken($order)->assertRedirect();

        $this->post(Domain::portal('/bookings/'.$order->code.'/booking'), [
            'customer_legal_name' => 'Legal Buyer Name',
            'identity_kind' => 'cnic',
            'identity_number' => '42101-1234567-1',
            'overseas' => 1,
            'international_phone' => '+971501234567',
            'local_phone' => '03001234567',
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
        $this->assertTrue($order->overseas);
        $this->assertSame('+971501234567', $order->international_phone);
        $this->assertSame('03001234567', $order->local_phone);
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
            ->assertSee('Booking Confirmation Letter')
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

    public function test_booking_form_preview_includes_tenant_letterhead_and_pdf_downloads(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_booking_form_pdf');

        $tenant->makeCurrent();
        $unit->forceFill(['name' => 'Villa 12'])->save();
        Setting::putGroup(Setting::GROUP_GENERAL, 'General', [
            'business_name' => 'Sunrise Developers',
            'legal_name' => 'Sunrise Developers Pvt Ltd',
            'tagline' => 'Homes that last',
            'phone' => '+923001112233',
            'email' => 'hello@sunrise.test',
            'address' => '12 Main Boulevard',
            'city' => 'Lahore',
            'state' => 'Punjab',
        ]);
        Tenant::forgetCurrent();

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
        $buyerName = $order->contact?->display_name;
        $projectTitle = $order->project?->title;
        Tenant::forgetCurrent();

        $this->get(Domain::portal('/bookings/'.$order->code.'/booking-form'))
            ->assertOk()
            ->assertSee('Booking Confirmation Letter')
            ->assertSee('Sunrise Developers Pvt Ltd')
            ->assertSee('Homes that last')
            ->assertSee('12 Main Boulevard')
            ->assertSee('Villa 12')
            ->assertSee($buyerName)
            ->assertSee($projectTitle)
            ->assertDontSee('Booking form');

        Pdf::fake();

        $this->get(Domain::portal('/bookings/'.$order->code.'/booking-form.pdf'))
            ->assertOk();

        Pdf::assertRespondedWithPdf(fn ($pdf) => $pdf->viewName === 'portal.booking-form'
            && $pdf->isDownload()
            && $pdf->contains('Sunrise Developers Pvt Ltd')
            && $pdf->contains('Villa 12'));
    }

    public function test_booking_confirmation_letter_can_be_emailed_to_contact(): void
    {
        Mail::fake();
        Pdf::fake();

        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_deal_letter_email');

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
        $order = Order::query()->with('contact')->firstOrFail();
        $order->contact->forceFill([
            'email_address' => 'buyer.letter@example.com',
        ])->save();
        $email = $order->contact->email_address;
        Tenant::forgetCurrent();

        $this->post(Domain::portal('/bookings/'.$order->code.'/booking-form/email'), [], [
            'Accept' => 'application/json',
        ])
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('email', $email);

        Mail::assertSent(BookingConfirmationLetterMail::class, function (BookingConfirmationLetterMail $mail) use ($email): bool {
            return $mail->hasTo($email) && count($mail->attachments()) === 1;
        });
    }

    public function test_booking_confirmation_letter_email_requires_contact_email(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_deal_letter_email_missing');

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
        $order = Order::query()->with('contact')->firstOrFail();
        $order->contact->forceFill(['email_address' => null])->save();
        Tenant::forgetCurrent();

        $this->post(Domain::portal('/bookings/'.$order->code.'/booking-form/email'), [], [
            'Accept' => 'application/json',
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'This contact does not have a valid email address.');
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

        $this->postVerifyToken($order)->assertRedirect();

        $this->post(Domain::portal('/bookings/'.$order->code.'/booking'), [
            'customer_legal_name' => 'Legal Buyer Name',
            'identity_kind' => 'passport',
            'identity_number' => 'AB1234567',
            'international_phone' => '03001234567',
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

        $this->postVerifyToken($order)->assertRedirect();

        $this->post(Domain::portal('/bookings/'.$order->code.'/booking'), [
            'customer_legal_name' => 'Legal Buyer Name',
            'identity_kind' => 'cnic',
            'identity_number' => '42101-1234567-1',
            'international_phone' => '03001234567',
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

        $this->postVerifyToken($order)->assertRedirect();

        $this->post(Domain::portal('/bookings/'.$order->code.'/booking'), [
            'customer_legal_name' => 'Legal Buyer Name',
            'identity_kind' => 'cnic',
            'identity_number' => '42101-1234567-1',
            'international_phone' => '03001234567',
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
        $order = Order::query()->with('contact')->firstOrFail();
        $projectId = $order->project_id;
        $unitId = $order->unit_id;
        Tenant::forgetCurrent();

        $this->postVerifyToken($order, [
            'contact_name' => 'Updated Buyer',
            'phone_number' => '03009998887',
            'email_address' => 'updated.buyer@example.com',
            'cnic' => '42101-9999999-9',
            'agreed_price' => 5200,
            'token_amount' => 600,
            'method' => 'Cash',
            'reference' => 'TOK-VERIFY-1',
            'paid_on' => '2026-09-24',
        ])->assertRedirect();

        $tenant->makeCurrent();
        $order->refresh();
        $order->load(['contact', 'payments', 'paymentPlan.installments']);

        $this->assertSame(Order::STAGE_BOOKING_KYC, $order->stage);
        $this->assertSame(Order::STATUS_IN_PROGRESS, $order->status);
        $this->assertNotNull($order->booking_verified_at);
        $this->assertNotNull($order->booking_number);
        $this->assertMatchesRegularExpression('/^BK-\d{4}-\d{6}$/', $order->booking_number);
        $this->assertSame($projectId, $order->project_id);
        $this->assertSame($unitId, $order->unit_id);
        $this->assertSame('5200.00', $order->agreed_price);
        $this->assertSame('cnic', $order->identity_kind);
        $this->assertSame('42101-9999999-9', $order->identity_number);
        $this->assertSame('Updated', $order->contact->first_name);
        $this->assertSame('Buyer', $order->contact->last_name);
        $this->assertSame('03009998887', $order->contact->phone_number);
        $this->assertSame('updated.buyer@example.com', $order->contact->email_address);
        $this->assertSame('42101-9999999-9', $order->contact->cnic);

        $tokenInstallment = $order->paymentPlan->installments
            ->firstWhere('kind', PaymentInstallment::KIND_TOKEN);
        $this->assertNotNull($tokenInstallment);
        $this->assertSame('600.00', $tokenInstallment->amount);
        $this->assertSame(PaymentInstallment::STATUS_PAID, $tokenInstallment->status);

        $payment = $order->payments->first();
        $this->assertNotNull($payment);
        $this->assertSame('600.00', $payment->amount);
        $this->assertSame('Cash', $payment->method);
        $this->assertSame('TOK-VERIFY-1', $payment->reference);
        $this->assertNotNull($payment->receipt_asset_id);
        $this->assertNotNull($payment->payment_account_id);

        $this->get(Domain::portal('/bookings/'.$order->code.'/booking-form'))
            ->assertOk()
            ->assertSee($order->booking_number);

        Tenant::forgetCurrent();
    }

    public function test_verify_token_json_returns_booking_panel_payload(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_deal_verify_json');

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

        $this->postVerifyToken($order, [
            'identity_kind' => 'passport',
            'identity_number' => 'AB9988776',
        ], [
            'Accept' => 'application/json',
        ])
            ->assertOk()
            ->assertJsonPath('order.code', $order->code)
            ->assertJsonPath('order.stage', Order::STAGE_BOOKING_KYC)
            ->assertJsonPath('deal.booking.agreed_price', 5000)
            ->assertJsonPath('deal.booking.token_amount', 500)
            ->assertJsonPath('deal.booking.identity_kind', 'passport')
            ->assertJsonPath('deal.booking.identity_number', 'AB9988776')
            ->assertJsonPath('deal.booking.token_payment.method', 'Cash')
            ->assertJsonPath('deal.booking.token_payment.reference', 'TOK-TEST')
            ->assertJsonStructure([
                'order' => ['code', 'stage', 'booking_number'],
                'deal' => [
                    'stage',
                    'booking' => [
                        'agreed_price',
                        'token_amount',
                        'identity_kind',
                        'identity_number',
                        'token_payment' => [
                            'amount',
                            'method',
                            'paid_on',
                            'payment_account',
                        ],
                    ],
                ],
            ]);

        $tenant->makeCurrent();
        $order->refresh();
        $this->assertSame(Order::STAGE_BOOKING_KYC, $order->stage);
        $this->assertNotNull($order->booking_number);
        Tenant::forgetCurrent();
    }

    public function test_verify_token_can_swap_to_another_bookable_unit(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_deal_verify_swap_unit');

        $this->actingAs($user);
        session([TenantContext::SESSION_TENANT_ID => $tenant->id]);

        $tenant->makeCurrent();
        $replacement = Unit::factory()->create([
            'project_id' => $unit->project_id,
            'status' => Unit::STATUS_AVAILABLE,
            'price' => 12000,
            'name' => 'Swap Unit',
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
        $originalUnitId = $order->unit_id;
        Tenant::forgetCurrent();

        $this->postVerifyToken($order, [
            'project_id' => $replacement->project_id,
            'unit_id' => $replacement->id,
            'agreed_price' => 12000,
            'token_amount' => 1000,
        ])->assertRedirect();

        $tenant->makeCurrent();
        $order->refresh();
        $this->assertSame($replacement->id, $order->unit_id);
        $this->assertSame($replacement->project_id, $order->project_id);
        $this->assertSame(Unit::STATUS_AVAILABLE, Unit::query()->findOrFail($originalUnitId)->status);
        $this->assertSame(Unit::STATUS_TOKEN, $replacement->fresh()->status);
        Tenant::forgetCurrent();
    }

    public function test_verify_token_requires_permission(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_deal_verify_forbidden');

        $denied = User::factory()->tenant()->create();
        TenantUser::factory()->create([
            'user_id' => $denied->id,
            'tenant_id' => $tenant->id,
        ]);

        $tenant->makeCurrent();
        $denied->assignRole('Sales Executive');
        Tenant::forgetCurrent();

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
        $order = Order::query()->with('contact')->firstOrFail();
        Tenant::forgetCurrent();

        $this->actingAs($denied);
        $this->postVerifyToken($order)->assertForbidden();
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

        $this->postVerifyToken($order)->assertRedirect();

        $this->post(Domain::portal('/bookings/'.$order->code.'/booking'), [
            'customer_legal_name' => 'Legal Buyer Name',
            'identity_kind' => 'cnic',
            'identity_number' => '42101-1234567-1',
            'international_phone' => '03001234567',
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

    public function test_kyc_completion_requires_documents_when_types_configured(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_deal_kyc_docs_gate');

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
        BookingDocumentType::ensureDefaults();
        Tenant::forgetCurrent();

        $this->postVerifyToken($order)->assertRedirect();

        $this->from(Domain::portal('/bookings'))
            ->post(Domain::portal('/bookings/'.$order->code.'/booking'), $this->bookingKycPayload())
            ->assertRedirect(Domain::portal('/bookings'))
            ->assertSessionHasErrors('documents');

        $tenant->makeCurrent();
        $this->assertSame(Order::STAGE_BOOKING_KYC, $order->fresh()->stage);
        Tenant::forgetCurrent();
    }

    public function test_kyc_completion_succeeds_when_required_documents_linked(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_deal_kyc_docs_ok');

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
        $unitId = $order->unit_id;
        BookingDocumentType::ensureDefaults();
        $this->linkRequiredKycDocuments($order);
        Tenant::forgetCurrent();

        $this->postVerifyToken($order)->assertRedirect();

        $this->postJson(Domain::portal('/bookings/'.$order->code.'/booking'), $this->bookingKycPayload([
            'nominee_identity_kind' => 'passport',
            'nominee_cnic' => 'AB1234567',
            'category' => 'corner',
            'premium' => 250,
            'unit_id' => 999999,
            'project_id' => 999999,
            'template' => 'custom',
            'template_id' => 'custom',
            'down_payment' => 1000,
            'handover_percent' => 10,
            'installment_count' => 12,
            'frequency' => 'monthly',
            'first_due_on' => '2026-11-01',
        ]))
            ->assertOk()
            ->assertJsonPath('deal.stage', Order::STAGE_ACTIVE)
            ->assertJsonPath('deal.booking.customer_legal_name', 'Sara Buyer Legal')
            ->assertJsonPath('deal.booking.nominee_identity_kind', 'passport')
            ->assertJsonPath('deal.kyc_docs_ready', true)
            ->assertJsonPath('deal.plan.template', 'custom')
            ->assertJsonPath('deal.plan.installment_count', 12);

        $tenant->makeCurrent();
        $order->refresh();
        $this->assertSame(Order::STAGE_ACTIVE, $order->stage);
        $this->assertSame('Sara Buyer Legal', $order->customer_legal_name);
        $this->assertSame('passport', $order->nominee_identity_kind);
        $this->assertSame('AB1234567', $order->nominee_cnic);
        $this->assertSame('250.00', $order->premium);
        $this->assertSame($unitId, $order->unit_id);
        $this->assertSame('custom', $order->paymentPlan?->template);
        $this->assertSame(12, (int) $order->paymentPlan?->installment_count);
        $this->assertGreaterThan(1, $order->paymentPlan?->installments()->count());
        Tenant::forgetCurrent();
    }

    public function test_kyc_docs_ready_when_no_document_types_configured(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_deal_kyc_empty_docs');

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
        BookingDocumentType::query()->delete();
        $snapshot = app(DealPipeline::class)->snapshot($order);
        $this->assertTrue($snapshot['kyc_docs_ready']);
        Tenant::forgetCurrent();
    }

    public function test_kyc_completion_allows_missing_optional_documents(): void
    {
        [$user, $tenant, $lead, $unit] = $this->bookableLead('tenant_deal_kyc_optional_docs');

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
        BookingDocumentType::ensureDefaults();
        $this->assertFalse(
            (bool) BookingDocumentType::query()->where('label', 'nominee')->value('is_required'),
        );
        $this->linkRequiredKycDocuments($order);
        $this->assertFalse(
            $order->fresh()->documents->contains(fn ($link): bool => $link->label === 'nominee'),
        );
        Tenant::forgetCurrent();

        $this->postVerifyToken($order)->assertRedirect();

        $this->postJson(Domain::portal('/bookings/'.$order->code.'/booking'), $this->bookingKycPayload())
            ->assertOk()
            ->assertJsonPath('deal.stage', Order::STAGE_ACTIVE)
            ->assertJsonPath('deal.kyc_docs_ready', true);

        $tenant->makeCurrent();
        $this->assertSame(Order::STAGE_ACTIVE, $order->fresh()->stage);
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

        $this->postVerifyToken($order)->assertRedirect();
        $this->post(Domain::portal('/bookings/'.$order->code.'/booking'), [
            'customer_legal_name' => 'Legal Buyer Name',
            'identity_kind' => 'cnic',
            'identity_number' => '42101-1234567-1',
            'international_phone' => '03001234567',
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
                'amount' => 3600,
                'method' => OrderPayment::METHOD_CASH,
                'paid_on' => '2026-10-02',
            ])->assertRedirect();

        $tenant->makeCurrent();
        $order->refresh()->load('payments');
        $this->assertSame(2, $order->payments->count());
        $this->assertTrue($order->payments->contains(
            fn (OrderPayment $payment): bool => $payment->amount === '400.00' && $payment->payment_installment_id !== null,
        ));
        $this->assertTrue($order->payments->contains(
            fn (OrderPayment $payment): bool => $payment->amount === '3600.00' && $payment->method === OrderPayment::METHOD_CASH,
        ));
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
     * @param  array<string, mixed>  $overrides
     * @param  array<string, string>  $headers
     */
    protected function postVerifyToken(Order $order, array $overrides = [], array $headers = []): TestResponse
    {
        $tenant = Tenant::query()->findOrFail(session(TenantContext::SESSION_TENANT_ID));
        $tenant->makeCurrent();

        $order = Order::query()
            ->with(['contact', 'paymentPlan.installments'])
            ->findOrFail($order->id);

        PaymentAccount::ensureDefaults();
        $accountId = PaymentAccount::query()
            ->where('is_enabled', true)
            ->orderByDesc('is_default')
            ->value('id');

        $tokenAmount = $order->paymentPlan?->installments
            ?->firstWhere('kind', PaymentInstallment::KIND_TOKEN)
            ?->amount;

        $payload = array_merge([
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
            'reference' => 'TOK-TEST',
            'paid_on' => now()->toDateString(),
            'receipt' => UploadedFile::fake()->create('token-proof.pdf', 120, 'application/pdf'),
        ], $overrides);

        Tenant::forgetCurrent();

        return $this->post(
            Domain::portal('/bookings/'.$order->code.'/enter-booking-kyc'),
            $payload,
            $headers,
        );
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    protected function bookingKycPayload(array $overrides = []): array
    {
        return array_merge([
            'customer_legal_name' => 'Sara Buyer Legal',
            'identity_kind' => 'cnic',
            'identity_number' => '42101-1234567-1',
            'international_phone' => '03001234567',
            'nominee_name' => 'Sara',
            'nominee_relation' => 'Spouse',
            'nominee_identity_kind' => 'cnic',
            'nominee_cnic' => '42101-7654321-1',
            'plot_or_file' => 'F-2',
            'category' => 'standard',
            'premium' => 0,
            'discount' => 0,
        ], $overrides);
    }

    protected function linkRequiredKycDocuments(Order $order): void
    {
        $assets = app(AssetManager::class);

        foreach (BookingDocumentType::query()->where('is_required', true)->orderBy('priority')->get() as $type) {
            $doc = Asset::factory()->document()->create([
                'name' => $type->label.'.pdf',
            ]);
            $assets->syncLinks(
                $order,
                AssetManager::LINKAGE_DOCUMENT,
                [$doc->id],
                $type->label,
            );
        }
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

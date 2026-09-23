<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\BallotOrderRequest;
use App\Http\Requests\Portal\GeneratePaymentPlanRequest;
use App\Http\Requests\Portal\HandoverOrderRequest;
use App\Http\Requests\Portal\RecordOrderPaymentRequest;
use App\Http\Requests\Portal\SetLitigationRequest;
use App\Http\Requests\Portal\TransferOrderRequest;
use App\Http\Requests\Portal\VerifyBookingRequest;
use App\Models\Asset;
use App\Models\Order;
use App\Models\OrderPayment;
use App\Models\PaymentAccount;
use App\Models\PaymentInstallment;
use App\Models\Setting;
use App\Models\Tenant;
use App\Services\DealPipeline;
use App\Support\AssetManager;
use Illuminate\Contracts\Support\Responsable;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;
use Spatie\LaravelPdf\Facades\Pdf;

class DealController extends Controller
{
    public function __construct(
        protected DealPipeline $deals,
        protected AssetManager $assets,
    ) {}

    public function storeBooking(VerifyBookingRequest $request, Order $order): RedirectResponse
    {
        $this->deals->completeBookingKyc($order, $request->validated(), $request->user()?->id);

        return back();
    }

    public function plan(GeneratePaymentPlanRequest $request, Order $order): RedirectResponse
    {
        $this->deals->generatePlan($order, $request->validated());

        return back();
    }

    public function payment(RecordOrderPaymentRequest $request, Order $order): RedirectResponse
    {
        $this->deals->recordPayment($order, $request->validated(), $request->file('receipt'));

        $path = rtrim((string) parse_url((string) $request->headers->get('referer'), PHP_URL_PATH), '/');

        if ($path === '/bookings') {
            return redirect('/bookings?booking='.$order->code);
        }

        return back();
    }

    public function ballot(BallotOrderRequest $request, Order $order): RedirectResponse
    {
        $this->deals->ballot($order, $request->validated(), $request->user()?->id);

        return back();
    }

    public function transfer(TransferOrderRequest $request, Order $order): RedirectResponse
    {
        $this->deals->transfer($order, $request->validated(), $request->user()?->id);

        return back();
    }

    public function handover(HandoverOrderRequest $request, Order $order): RedirectResponse
    {
        $this->deals->ready($order, $request->validated(), $request->user()?->id);

        return back();
    }

    public function deliver(Order $order): RedirectResponse
    {
        $this->deals->deliver($order, request()->user()?->id);

        return back();
    }

    public function litigation(SetLitigationRequest $request, Order $order): RedirectResponse
    {
        $this->deals->setLitigation($order, $request->boolean('litigation'), $request->user()?->id);

        return back();
    }

    public function enterBookingKyc(Order $order): RedirectResponse
    {
        $this->deals->verify($order, request()->user()?->id);

        return back();
    }

    public function showBookingForm(Order $order): View
    {
        $order->load(['contact', 'project', 'unit.block', 'paymentPlan']);
        $deal = $this->deals->snapshot($order);

        return view('portal.booking-form', [
            'order' => $order,
            'deal' => $deal,
        ]);
    }

    public function paymentVoucher(Order $order, OrderPayment $payment): Responsable
    {
        abort_unless((int) $payment->order_id === (int) $order->id, 404);

        $order->loadMissing(['contact', 'project', 'unit']);

        $currency = $this->currencySettings();
        $symbol = trim((string) ($currency['currency_symbol'] ?? '$')) ?: '$';
        $amount = number_format((float) $payment->amount, 2);
        $voucherNumber = 'PV-'.$order->code.'-'.$payment->id;
        $receipt = null;

        if ($payment->receipt_asset_id) {
            $asset = Asset::query()->find($payment->receipt_asset_id);
            $receipt = $this->assets->url($asset);
        }

        return Pdf::view('portal.payment-voucher', [
            'business_name' => $this->legalName(),
            'voucher_number' => $voucherNumber,
            'buyer_name' => $order->contact?->display_name ?: 'Buyer',
            'project_title' => $order->project?->title ?: '—',
            'unit_name' => $order->unit?->name ?: ($order->unit?->code ?: '—'),
            'amount_formatted' => $symbol.$amount,
            'method_label' => $this->methodLabel((string) $payment->method),
            'reference' => $payment->reference ?: '—',
            'paid_on' => $payment->paid_on?->toFormattedDateString() ?: '—',
            'notes' => $payment->notes,
            'receipt_url' => $receipt,
        ])
            ->driver('dompdf')
            ->format('a4')
            ->name($voucherNumber.'.pdf')
            ->download();
    }

    public function paymentRequestVoucher(Order $order, PaymentInstallment $installment): Responsable
    {
        $installment->loadMissing('plan');
        abort_unless((int) ($installment->plan?->order_id) === (int) $order->id, 404);

        $order->loadMissing(['contact', 'project', 'unit']);
        $bank = $this->bankSettings();
        $currency = $this->currencySettings();
        $symbol = trim((string) ($currency['currency_symbol'] ?? '$')) ?: '$';
        $amount = number_format((float) $installment->amount, 2);
        $voucherNumber = 'PR-'.$order->code.'-'.$installment->id;

        return Pdf::view('portal.payment-request-voucher', [
            'business_name' => $this->legalName(),
            'voucher_number' => $voucherNumber,
            'buyer_name' => $order->contact?->display_name ?: 'Buyer',
            'project_title' => $order->project?->title ?: '—',
            'unit_name' => $order->unit?->name ?: ($order->unit?->code ?: '—'),
            'amount_formatted' => $symbol.$amount,
            'installment_label' => $installment->label ?: 'Installment',
            'due_on' => $installment->due_on?->toFormattedDateString() ?: '—',
            'bank' => $bank,
        ])
            ->driver('dompdf')
            ->format('a4')
            ->name($voucherNumber.'.pdf')
            ->download();
    }

    public function ledgerPdf(Order $order): Responsable
    {
        $order->loadMissing(['contact', 'project', 'unit']);
        $deal = $this->deals->snapshot($order);
        $currency = $this->currencySettings();
        $symbol = trim((string) ($currency['currency_symbol'] ?? '$')) ?: '$';

        return Pdf::view('portal.ledger-statement', [
            'business_name' => $this->legalName(),
            'order' => $order,
            'deal' => $deal,
            'currency_symbol' => $symbol,
        ])
            ->driver('dompdf')
            ->format('a4')
            ->name('ledger-'.$order->code.'.pdf')
            ->download();
    }

    public function ledgerPreview(Order $order): View
    {
        $order->loadMissing(['contact', 'project', 'unit']);
        $deal = $this->deals->snapshot($order);
        $currency = $this->currencySettings();
        $symbol = trim((string) ($currency['currency_symbol'] ?? '$')) ?: '$';

        return view('portal.ledger-statement', [
            'business_name' => $this->legalName(),
            'order' => $order,
            'deal' => $deal,
            'currency_symbol' => $symbol,
            'preview' => true,
        ]);
    }

    /**
     * @return array{currency_code: string, currency_symbol: string}
     */
    protected function currencySettings(): array
    {
        return Setting::group(Setting::GROUP_CONFIGURATION, [
            'currency_code' => 'USD',
            'currency_symbol' => '$',
        ]);
    }

    /**
     * @return array{bank_name: ?string, account_title: ?string, account_number: ?string, iban: ?string, swift: ?string, branch: ?string}
     */
    protected function bankSettings(): array
    {
        $account = PaymentAccount::defaultFor(PaymentAccount::TYPE_BANK);

        if ($account === null) {
            return [
                'bank_name' => null,
                'account_title' => null,
                'account_number' => null,
                'iban' => null,
                'swift' => null,
                'branch' => null,
            ];
        }

        return [
            'bank_name' => $account->bank_name,
            'account_title' => $account->account_title,
            'account_number' => $account->account_number,
            'iban' => $account->iban,
            'swift' => $account->swift,
            'branch' => $account->branch,
        ];
    }

    protected function legalName(): string
    {
        $general = Setting::group(Setting::GROUP_GENERAL, [
            'legal_name' => null,
            'business_name' => Tenant::current()?->name,
        ]);

        return filled($general['legal_name'] ?? null)
            ? (string) $general['legal_name']
            : (filled($general['business_name'] ?? null)
                ? (string) $general['business_name']
                : (Tenant::current()?->name ?: config('app.name')));
    }

    protected function methodLabel(string $method): string
    {
        $known = [
            OrderPayment::METHOD_CASH => 'Cash',
            OrderPayment::METHOD_PAY_ORDER => 'Pay order',
            OrderPayment::METHOD_CHEQUE => 'Cheque',
            OrderPayment::METHOD_TRANSFER => 'Bank transfer',
            OrderPayment::METHOD_BOOKING => 'Booking',
        ];

        return $known[$method] ?? $method;
    }
}

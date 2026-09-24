<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\BookingDocumentType;
use App\Models\Contact;
use App\Models\Integration;
use App\Models\MetaData;
use App\Models\Order;
use App\Models\OrderPayment;
use App\Models\OrderTransfer;
use App\Models\PaymentAccount;
use App\Models\PaymentInstallment;
use App\Models\PaymentPlan;
use App\Models\PaymentPlanTemplate;
use App\Models\Project;
use App\Models\Unit;
use App\Support\AssetManager;
use App\Support\Deals\PaymentSchedule;
use App\Support\Integrations\WhatsApp\WhatsAppGraphClient;
use App\Support\Notifications\WorkspaceNotifier;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class DealPipeline
{
    public function __construct(
        protected LeadActivity $activity,
        protected OrderActivity $orderActivity,
        protected AssetManager $assets,
        protected WhatsAppGraphClient $whatsapp,
    ) {}

    /**
     * Verify the token payment (with proof), adjust customer/amounts, assign booking number,
     * and advance into Booking & KYC.
     *
     * @param  array<string, mixed>  $data
     */
    public function verify(Order $order, array $data, ?UploadedFile $receipt, ?int $actorId): Order
    {
        return DB::connection('tenant')->transaction(function () use ($order, $data, $receipt, $actorId): Order {
            $order = $this->lockOpen($order);

            if ($order->stage !== Order::STAGE_TOKEN && $order->booking_verified_at === null) {
                throw ValidationException::withMessages([
                    'order' => 'Only token-stage bookings can be verified.',
                ]);
            }

            if ($order->booking_verified_at !== null && $order->stage !== Order::STAGE_TOKEN) {
                return $order;
            }

            if ($receipt === null) {
                throw ValidationException::withMessages([
                    'receipt' => 'Upload proof of the token payment.',
                ]);
            }

            $this->applyVerifyContact($order, $data);
            $this->applyVerifyInventory($order, $data);
            $tokenInstallment = $this->applyVerifyAmounts($order, $data);
            $payment = $this->recordTokenPayment($order, $tokenInstallment, $data, $receipt);

            if (! filled($order->booking_number)) {
                $order->forceFill([
                    'booking_number' => $this->nextBookingNumber(),
                ])->save();
            }

            $identityNumber = $data['identity_number'] ?? $data['cnic'] ?? null;
            $identityKind = $data['identity_kind']
                ?? (filled($identityNumber) ? 'cnic' : null);

            $order->forceFill([
                'identity_kind' => filled($identityKind) ? $identityKind : $order->identity_kind,
                'identity_number' => filled($identityNumber) ? $identityNumber : $order->identity_number,
                'booking_verified_at' => $order->booking_verified_at ?? now(),
                'stage' => Order::STAGE_BOOKING_KYC,
                'status' => Order::STATUS_IN_PROGRESS,
            ])->save();

            $label = ($order->booking_number ?: $order->code).' · '.($order->contact?->display_name ?: 'Booking');
            $receiptIds = $payment->receipt_asset_id !== null
                ? [(int) $payment->receipt_asset_id]
                : [];
            $this->orderActivity->log($order, 'Token verified', $label, $actorId, $receiptIds);
            $this->ensureTokenPaymentProofDocument($order);

            if ($order->lead) {
                $this->activity->log($order->lead, 'Token verified', $label, $actorId);
            }

            return $order->fresh(['paymentPlan.installments', 'payments', 'contact', 'documents.asset']) ?? $order;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function completeBookingKyc(Order $order, array $data, ?int $actorId): Order
    {
        return DB::connection('tenant')->transaction(function () use ($order, $data, $actorId): Order {
            $order = $this->lockOpen($order);
            $order->loadMissing(['unit', 'project']);

            if ($order->booking_verified_at === null && $order->stage === Order::STAGE_TOKEN) {
                throw ValidationException::withMessages([
                    'order' => 'Verify the token before entering Booking & KYC details.',
                ]);
            }

            if (! $this->kycDocumentsAreReady($order)) {
                $missing = $this->missingKycDocumentLabels($order);

                throw ValidationException::withMessages([
                    'documents' => $missing->isEmpty()
                        ? 'Upload all required KYC documents before completing Booking & KYC.'
                        : 'Upload required documents: '.$missing->implode(', ').'.',
                ]);
            }

            $order->forceFill([
                'customer_legal_name' => $data['customer_legal_name'],
                'identity_kind' => $data['identity_kind'],
                'identity_number' => $data['identity_number'],
                'overseas' => (bool) ($data['overseas'] ?? false),
                'local_phone' => $data['local_phone'] ?? null,
                'international_phone' => $data['international_phone'] ?? null,
                'nominee_name' => $data['nominee_name'],
                'nominee_relation' => $data['nominee_relation'],
                'nominee_identity_kind' => $data['nominee_identity_kind'] ?? 'cnic',
                'nominee_cnic' => $data['nominee_cnic'],
                'nominee_phone' => $data['nominee_phone'] ?? null,
                'phase' => $data['phase'] ?? $order->phase ?? $order->project?->title,
                'sector' => $data['sector'] ?? $order->sector ?? $order->unit?->sector,
                'plot_or_file' => filled($data['plot_or_file'] ?? null)
                    ? $data['plot_or_file']
                    : ($order->plot_or_file ?: $order->unit?->name ?: $order->unit?->code),
                'category' => $data['category'],
                'premium' => $this->money($this->cents($data['premium'] ?? 0)),
                'discount' => $this->money($this->cents($data['discount'] ?? 0)),
                'booking_verified_at' => $order->booking_verified_at ?? now(),
                'stage' => Order::STAGE_ACTIVE,
                'status' => Order::STATUS_IN_PROGRESS,
            ])->save();

            if (filled($data['category'] ?? null)) {
                MetaData::remember(MetaData::TYPE_UNIT_CATEGORY, (string) $data['category']);
            }

            $contact = $order->contact;

            if ($contact) {
                $contact->forceFill([
                    'cnic' => $data['identity_kind'] === 'cnic' ? $data['identity_number'] : $contact->cnic,
                    'phone_number' => filled($data['international_phone'] ?? null)
                        ? $data['international_phone']
                        : $contact->phone_number,
                    'phone_number_alt' => $data['local_phone'] ?? $contact->phone_number_alt,
                    'type' => Contact::TYPE_CLIENT,
                ])->save();
            }

            $this->syncActiveStatus($order->fresh(['paymentPlan.installments', 'payments']) ?? $order);

            $this->orderActivity->log($order, 'Booking & KYC completed', $order->contact?->display_name ?: 'Booking', $actorId);

            if ($order->lead) {
                $this->activity->log($order->lead, 'Booking & KYC completed', $order->contact?->display_name ?: 'Booking', $actorId);
            }

            $planPayload = $this->planPayloadFromKyc($data);

            if ($planPayload !== null) {
                $this->generatePlan($order->fresh(['paymentPlan.installments', 'payments']) ?? $order, $planPayload);
            }

            return $order->fresh(['paymentPlan.installments', 'payments', 'contact']) ?? $order;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>|null
     */
    protected function planPayloadFromKyc(array $data): ?array
    {
        if (! filled($data['first_due_on'] ?? null)) {
            return null;
        }

        $payload = [
            'template_id' => $data['template_id'] ?? null,
            'template' => $data['template'] ?? null,
            'down_payment' => $data['down_payment'] ?? null,
            'handover_percent' => $data['handover_percent'] ?? null,
            'installment_count' => $data['installment_count'] ?? null,
            'frequency' => $data['frequency'] ?? null,
            'first_due_on' => $data['first_due_on'],
            'late_fee_basis' => $data['late_fee_basis'] ?? null,
            'late_fee_rate' => $data['late_fee_rate'] ?? null,
        ];

        $isCustom = ($payload['template'] ?? null) === PaymentSchedule::TEMPLATE_CUSTOM
            || ($payload['template_id'] ?? null) === 'custom';

        if ($isCustom) {
            $payload['template'] = PaymentSchedule::TEMPLATE_CUSTOM;
            $payload['template_id'] = 'custom';
        }

        return $payload;
    }

    /**
     * @deprecated Use verify() — kept for route compatibility.
     *
     * @param  array<string, mixed>  $data
     */
    public function enterBookingKyc(Order $order, array $data, ?UploadedFile $receipt, ?int $actorId): Order
    {
        return $this->verify($order, $data, $receipt, $actorId);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected function applyVerifyContact(Order $order, array $data): void
    {
        $contact = $order->contact;

        if ($contact === null) {
            return;
        }

        $parts = preg_split('/\s+/', trim((string) ($data['contact_name'] ?? '')), 2) ?: [];

        $identityNumber = $data['identity_number'] ?? $data['cnic'] ?? null;
        $identityKind = $data['identity_kind'] ?? (filled($identityNumber) ? 'cnic' : null);

        $contact->forceFill([
            'first_name' => $parts[0] ?? $contact->first_name,
            'last_name' => $parts[1] ?? null,
            'phone_number' => $data['phone_number'] ?? $contact->phone_number,
            'email_address' => $data['email_address'] ?? $contact->email_address,
            'cnic' => ($identityKind === null || $identityKind === 'cnic') && filled($identityNumber)
                ? $identityNumber
                : ($data['cnic'] ?? $contact->cnic),
        ])->save();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected function applyVerifyInventory(Order $order, array $data): void
    {
        $unitId = (int) ($data['unit_id'] ?? 0);
        $projectId = (int) ($data['project_id'] ?? 0);

        if ($unitId <= 0) {
            throw ValidationException::withMessages([
                'unit_id' => 'Choose a unit for this booking.',
            ]);
        }

        $unit = Unit::query()->whereKey($unitId)->lockForUpdate()->first();

        if ($unit === null) {
            throw ValidationException::withMessages([
                'unit_id' => 'Choose a unit for this booking.',
            ]);
        }

        if ($projectId > 0 && (int) $unit->project_id !== $projectId) {
            throw ValidationException::withMessages([
                'unit_id' => 'Choose a unit that belongs to the selected project.',
            ]);
        }

        $currentUnitId = (int) $order->unit_id;

        if ($unitId === $currentUnitId) {
            if ((int) $order->project_id !== (int) $unit->project_id) {
                $order->forceFill([
                    'project_id' => $unit->project_id,
                ])->save();
            }

            return;
        }

        if (! $unit->isBookable()) {
            throw ValidationException::withMessages([
                'unit_id' => 'Choose a unit that is available or on hold.',
            ]);
        }

        $previous = $currentUnitId > 0
            ? Unit::query()->whereKey($currentUnitId)->lockForUpdate()->first()
            : null;

        $order->forceFill([
            'unit_id' => $unit->id,
            'project_id' => $unit->project_id,
        ])->save();

        if ($order->lead) {
            $order->lead->forceFill([
                'unit_id' => $unit->id,
                'project_id' => $unit->project_id,
            ])->save();
        }

        if ($previous !== null) {
            $previous->syncStockStatus(forceAvailableWhenStocked: true);
        }

        $unit->reserveForBooking(
            $order->booking_kind === Order::KIND_RESERVE
                ? Unit::STATUS_RESERVED
                : Unit::STATUS_TOKEN,
        );
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected function applyVerifyAmounts(Order $order, array $data): PaymentInstallment
    {
        $agreed = $this->money($this->cents($data['agreed_price'] ?? 0));
        $tokenCents = $this->cents($data['token_amount'] ?? 0);

        if ($tokenCents <= 0) {
            throw ValidationException::withMessages([
                'token_amount' => 'Enter a token amount greater than zero.',
            ]);
        }

        if ($tokenCents > $this->cents($agreed)) {
            throw ValidationException::withMessages([
                'token_amount' => 'The token amount cannot be more than the agreed price.',
            ]);
        }

        $order->forceFill([
            'agreed_price' => $agreed,
        ])->save();

        $plan = $order->paymentPlan()->lockForUpdate()->first();

        if ($plan === null) {
            $plan = PaymentPlan::query()->create([
                'order_id' => $order->id,
                'agreed_price' => $agreed,
            ]);
        } else {
            $plan->forceFill([
                'agreed_price' => $agreed,
            ])->save();
        }

        $tokenRow = $plan->installments()
            ->where('kind', PaymentInstallment::KIND_TOKEN)
            ->lockForUpdate()
            ->first();

        if ($tokenRow === null) {
            $tokenRow = PaymentInstallment::query()->create([
                'payment_plan_id' => $plan->id,
                'sequence' => 1,
                'kind' => PaymentInstallment::KIND_TOKEN,
                'label' => 'Token',
                'amount' => $this->money($tokenCents),
                'due_on' => now()->toDateString(),
                'status' => PaymentInstallment::STATUS_PENDING,
            ]);
        } else {
            $tokenRow->forceFill([
                'amount' => $this->money($tokenCents),
            ])->save();
        }

        if ($plan->template === null) {
            $this->rebalanceProvisionalInstallments($plan, $this->cents($agreed), $tokenCents);
        }

        return $tokenRow->fresh() ?? $tokenRow;
    }

    protected function rebalanceProvisionalInstallments(PaymentPlan $plan, int $agreedCents, int $tokenCents): void
    {
        $others = $plan->installments()
            ->where('kind', '!=', PaymentInstallment::KIND_TOKEN)
            ->orderBy('sequence')
            ->lockForUpdate()
            ->get();

        $count = max(1, $others->count());
        $firstDue = $others->first()?->due_on?->copy() ?? now()->startOfDay()->addMonth();

        foreach ($others as $row) {
            $row->delete();
        }

        $remainder = $agreedCents - $tokenCents;

        if ($remainder <= 0) {
            return;
        }

        $base = intdiv($remainder, $count);
        $extra = $remainder % $count;
        $sequence = 2;

        for ($index = 0; $index < $count; $index++) {
            $cents = $base + ($index === $count - 1 ? $extra : 0);

            if ($cents <= 0) {
                continue;
            }

            PaymentInstallment::query()->create([
                'payment_plan_id' => $plan->id,
                'sequence' => $sequence,
                'kind' => PaymentInstallment::KIND_INSTALLMENT,
                'label' => 'Installment '.($index + 1),
                'amount' => $this->money($cents),
                'due_on' => $firstDue->copy()->addMonths($index)->toDateString(),
                'status' => PaymentInstallment::STATUS_PENDING,
            ]);
            $sequence++;
        }
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected function recordTokenPayment(
        Order $order,
        PaymentInstallment $tokenInstallment,
        array $data,
        UploadedFile $receipt,
    ): OrderPayment {
        $amountCents = $this->cents($tokenInstallment->amount);

        $payment = OrderPayment::query()->create([
            'order_id' => $order->id,
            'payment_installment_id' => $tokenInstallment->id,
            'payment_account_id' => $data['payment_account_id'] ?? null,
            'amount' => $this->money($amountCents),
            'method' => $data['method'],
            'reference' => $data['reference'] ?? null,
            'paid_on' => $data['paid_on'],
            'notes' => 'Token payment',
        ]);

        $asset = $this->assets->attach($payment, $receipt, AssetManager::LINKAGE_DOCUMENT, 'receipts');
        $payment->forceFill(['receipt_asset_id' => $asset->asset_id])->save();

        $tokenInstallment->forceFill([
            'paid_amount' => $this->money($amountCents),
            'status' => PaymentInstallment::STATUS_PAID,
            'paid_at' => now(),
        ])->save();

        if (filled($data['method'] ?? null) && ($data['method'] ?? '') !== OrderPayment::METHOD_BOOKING) {
            MetaData::remember(MetaData::TYPE_PAYMENT_METHOD, (string) $data['method']);
        }

        return $payment;
    }

    protected function nextBookingNumber(): string
    {
        $year = date('Y');
        $prefix = 'BK-'.$year.'-';

        $last = Order::query()
            ->where('booking_number', 'like', $prefix.'%')
            ->orderByDesc('booking_number')
            ->lockForUpdate()
            ->value('booking_number');

        $sequence = 1;

        if (is_string($last) && preg_match('/^BK-\d{4}-(\d+)$/', $last, $matches) === 1) {
            $sequence = ((int) $matches[1]) + 1;
        }

        return $prefix.str_pad((string) $sequence, 6, '0', STR_PAD_LEFT);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function generatePlan(Order $order, array $data): Order
    {
        return DB::connection('tenant')->transaction(function () use ($order, $data): Order {
            $order = $this->lockOpen($order);

            if ($order->booking_verified_at === null) {
                throw ValidationException::withMessages([
                    'order' => 'Verify the booking before building a payment plan.',
                ]);
            }

            if (! in_array($order->stage, [Order::STAGE_ACTIVE, Order::STAGE_BOOKING_KYC], true)) {
                throw ValidationException::withMessages([
                    'order' => 'Payment plans can only be set after the token is verified.',
                ]);
            }

            $net = $this->netCents($order);
            $down = array_key_exists('down_payment', $data) ? $this->cents($data['down_payment']) : null;
            $percent = array_key_exists('handover_percent', $data) ? (float) $data['handover_percent'] : null;

            $templateId = $data['template_id'] ?? null;
            $dbTemplate = null;

            if ($templateId !== null && $templateId !== '' && $templateId !== 'custom') {
                $dbTemplate = PaymentPlanTemplate::query()
                    ->enabled()
                    ->whereKey((int) $templateId)
                    ->first();
            }

            if ($dbTemplate !== null) {
                $frequency = $dbTemplate->frequency === 'quarterly' ? 'quarterly' : 'monthly';
                $count = max(1, (int) $dbTemplate->installment_count);
                $balloonEvery = $dbTemplate->balloon_every !== null ? (int) $dbTemplate->balloon_every : null;
                $templateKey = 'template:'.$dbTemplate->id;
                $percent ??= (float) $dbTemplate->handover_percent;
                $down ??= (int) round($net * ((float) $dbTemplate->down_payment_percent) / 100);
                $data['late_fee_basis'] ??= $dbTemplate->late_fee_basis;
                $data['late_fee_rate'] ??= $dbTemplate->late_fee_rate ?? 0;
            } else {
                [$frequency, $count, $balloonEvery] = PaymentSchedule::resolve(
                    (string) ($data['template'] ?? PaymentSchedule::TEMPLATE_CUSTOM),
                    $data['frequency'] ?? null,
                    isset($data['installment_count']) ? (int) $data['installment_count'] : null,
                );
                $templateKey = (string) ($data['template'] ?? PaymentSchedule::TEMPLATE_CUSTOM);
                $percent ??= 0.0;
                $down ??= 0;
            }

            $handover = (int) round($net * $percent / 100);

            if ($down + $handover > $net) {
                throw ValidationException::withMessages([
                    'down_payment' => 'The down payment and handover amount cannot exceed the net price.',
                ]);
            }

            $plan = $order->paymentPlan()->firstOrFail();
            $plan->installments()->delete();
            $plan->forceFill([
                'agreed_price' => $this->money($net),
                'template' => $templateKey,
                'down_payment' => $this->money($down),
                'handover_percent' => $percent,
                'frequency' => $frequency,
                'installment_count' => $count,
                'late_fee_basis' => $data['late_fee_basis'] ?? null,
                'late_fee_rate' => $data['late_fee_rate'] ?? 0,
            ])->save();

            foreach (PaymentSchedule::rows(
                $down,
                $handover,
                $net - $down - $handover,
                $count,
                $frequency,
                $balloonEvery,
                Carbon::parse($data['first_due_on'])->startOfDay(),
            ) as $row) {
                $plan->installments()->create($row);
            }

            $this->syncBookingPayment($order, $down);

            if ($order->stage !== Order::STAGE_ACTIVE) {
                $order->forceFill([
                    'stage' => Order::STAGE_ACTIVE,
                    'status' => Order::STATUS_IN_PROGRESS,
                ])->save();
            }

            $this->syncActiveStatus($order->fresh(['paymentPlan.installments', 'payments']));

            $this->orderActivity->log(
                $order->fresh(),
                'Payment plan set',
                $this->planTitle($templateKey),
                null,
            );

            return $order->fresh(['paymentPlan.installments', 'payments']) ?? $order;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function recordPayment(Order $order, array $data, ?UploadedFile $receipt): OrderPayment
    {
        return DB::connection('tenant')->transaction(function () use ($order, $data, $receipt): OrderPayment {
            $order = $this->lockOpen($order);

            if ($order->stage !== Order::STAGE_ACTIVE) {
                throw ValidationException::withMessages([
                    'order' => 'Payments can only be recorded on Active bookings.',
                ]);
            }

            $plan = $order->paymentPlan()->first();
            $hasSchedule = $plan !== null
                && $plan->template !== null
                && $plan->installments()->exists();

            $amountCents = $this->cents($data['amount']);
            $installmentId = null;

            if ($hasSchedule) {
                $left = $amountCents;
                $rows = $plan->installments()->orderBy('sequence')->lockForUpdate()->get();

                foreach ($rows as $row) {
                    if ($left <= 0) {
                        break;
                    }

                    $fee = $this->lateFeeCents($row, $plan);
                    $remaining = $this->cents($row->amount) + $fee - $this->cents($row->paid_amount);

                    if ($remaining <= 0) {
                        if ($row->isPending()) {
                            $row->forceFill([
                                'status' => PaymentInstallment::STATUS_PAID,
                                'paid_at' => $row->paid_at ?? now(),
                            ])->save();
                        }

                        continue;
                    }

                    $apply = min($left, $remaining);
                    $paid = $this->cents($row->paid_amount) + $apply;
                    $settled = $paid >= $this->cents($row->amount) + $fee;
                    $row->forceFill([
                        'paid_amount' => $this->money($paid),
                        'status' => $settled ? PaymentInstallment::STATUS_PAID : PaymentInstallment::STATUS_PENDING,
                        'paid_at' => $settled ? now() : null,
                    ])->save();
                    $installmentId ??= $row->id;
                    $left -= $apply;
                }

                if ($installmentId === null) {
                    throw ValidationException::withMessages([
                        'amount' => 'There is nothing left to collect on this plan.',
                    ]);
                }

                if ($left > 0) {
                    throw ValidationException::withMessages([
                        'amount' => 'That amount is more than the outstanding balance.',
                    ]);
                }
            } else {
                $outstanding = $this->outstandingCents($order->fresh(['paymentPlan.installments', 'payments']) ?? $order);

                if ($outstanding <= 0) {
                    throw ValidationException::withMessages([
                        'amount' => 'There is nothing left to collect on this booking.',
                    ]);
                }

                if ($amountCents > $outstanding) {
                    throw ValidationException::withMessages([
                        'amount' => 'That amount is more than the outstanding balance.',
                    ]);
                }
            }

            $payment = OrderPayment::query()->create([
                'order_id' => $order->id,
                'payment_installment_id' => $installmentId,
                'amount' => $this->money($amountCents),
                'method' => $data['method'],
                'reference' => $data['reference'] ?? null,
                'paid_on' => $data['paid_on'],
                'notes' => $data['notes'] ?? null,
            ]);

            if ($receipt !== null) {
                $asset = $this->assets->attach($payment, $receipt, AssetManager::LINKAGE_DOCUMENT, 'receipts');
                $payment->forceFill(['receipt_asset_id' => $asset->asset_id])->save();
            }

            if (filled($data['method'] ?? null) && ($data['method'] ?? '') !== OrderPayment::METHOD_BOOKING) {
                MetaData::remember(MetaData::TYPE_PAYMENT_METHOD, (string) $data['method']);
            }

            $this->syncActiveStatus($order->fresh(['paymentPlan.installments', 'payments']) ?? $order);
            $receiptIds = $payment->receipt_asset_id !== null
                ? [(int) $payment->receipt_asset_id]
                : [];
            $this->orderActivity->log(
                $order->fresh() ?? $order,
                'Payment recorded',
                $this->money($amountCents).' via '.$data['method'],
                null,
                $receiptIds,
            );

            return $payment;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function ballot(Order $order, array $data, ?int $actorId): Order
    {
        return DB::connection('tenant')->transaction(function () use ($order, $data, $actorId): Order {
            $order = $this->lockOpen($order);
            $this->requirePlan($order);

            $project = $order->project_id
                ? Project::query()->find($order->project_id)
                : null;

            if ($project !== null && ! $project->balloting_enabled) {
                throw ValidationException::withMessages([
                    'order' => 'Balloting is not enabled for this project.',
                ]);
            }

            $order->forceFill([
                'inventory_kind' => Order::INVENTORY_PLOT,
                'plot_or_file' => $data['plot_number'],
                'dimensions' => $data['dimensions'],
                'phase' => $data['phase'] ?? $order->phase,
                'sector' => $data['sector'] ?? $order->sector,
                'balloted_at' => now(),
            ])->save();

            $this->orderActivity->log($order, 'Ballot confirmed', (string) $order->plot_or_file, $actorId);

            if ($order->lead) {
                $this->activity->log($order->lead, 'Plot balloted', (string) $order->plot_or_file, $actorId);
            }

            return $order;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function transfer(Order $order, array $data, ?int $actorId): OrderTransfer
    {
        return DB::connection('tenant')->transaction(function () use ($order, $data, $actorId): OrderTransfer {
            $order = $this->lockOpen($order);

            $fromName = $order->contact?->display_name ?: 'Previous buyer';
            $buyer = $this->resolveBuyer($data);
            $outstanding = $this->outstandingCents($order->fresh(['paymentPlan.installments', 'payments']));

            $transfer = OrderTransfer::query()->create([
                'order_id' => $order->id,
                'from_contact_id' => $order->contact_id,
                'to_contact_id' => $buyer->id,
                'outstanding' => $this->money($outstanding),
                'ndc_cleared' => (bool) ($data['ndc_cleared'] ?? false),
                'notes' => $data['notes'] ?? null,
                'transferred_at' => now(),
            ]);

            $order->forceFill([
                'contact_id' => $buyer->id,
            ])->save();

            if ($order->stage === Order::STAGE_ACTIVE) {
                $this->syncActiveStatus($order->fresh(['paymentPlan.installments', 'payments']) ?? $order);
            }

            $note = $fromName.' → '.$buyer->display_name.($transfer->ndc_cleared ? ' · NDC cleared' : ' · NDC outstanding');
            $this->orderActivity->log($order->fresh() ?? $order, 'Buyer transferred', $note, $actorId);

            if ($order->lead) {
                $order->lead->forceFill(['contact_id' => $buyer->id])->save();
                $this->activity->log($order->lead, 'File transferred', $note, $actorId);
            }

            return $transfer;
        });
    }

    public function setLitigation(Order $order, bool $litigation, ?int $actorId): Order
    {
        return DB::connection('tenant')->transaction(function () use ($order, $litigation, $actorId): Order {
            $order = $this->lockOpen($order);

            if ($order->stage !== Order::STAGE_ACTIVE) {
                throw ValidationException::withMessages([
                    'order' => 'Litigation can only be set on Active bookings.',
                ]);
            }

            if ($litigation) {
                $order->forceFill(['status' => Order::STATUS_LITIGATION])->save();
                $this->orderActivity->log($order, 'Litigation set', null, $actorId);
            } else {
                $order->forceFill(['status' => Order::STATUS_IN_PROGRESS])->save();
                $this->syncActiveStatus($order->fresh(['paymentPlan.installments', 'payments']) ?? $order);
                $this->orderActivity->log($order->fresh() ?? $order, 'Litigation cleared', null, $actorId);
            }

            return $order->fresh() ?? $order;
        });
    }

    /**
     * @param  array<string, mixed>  $checklist
     */
    public function ready(Order $order, array $checklist, ?int $actorId): Order
    {
        return DB::connection('tenant')->transaction(function () use ($order, $checklist, $actorId): Order {
            $order = $this->lockOpen($order);
            $order->load(['paymentPlan.installments', 'payments', 'contact', 'unit', 'project']);

            if ($this->outstandingCents($order) > 0) {
                throw ValidationException::withMessages([
                    'order' => 'The statement of account still has a balance. Clear every installment and late fee first.',
                ]);
            }

            if ($order->project?->balloting_enabled && $order->balloted_at === null) {
                throw ValidationException::withMessages([
                    'order' => 'Confirm balloting before marking this file ready for handover.',
                ]);
            }

            $order->forceFill([
                'handover_checklist' => [
                    'original_files' => (bool) ($checklist['original_files'] ?? false),
                    'allotment_letter' => (bool) ($checklist['allotment_letter'] ?? false),
                    'registry_docs' => (bool) ($checklist['registry_docs'] ?? false),
                ],
                'handover_ready_at' => now(),
                'stage' => Order::STAGE_ACTIVE,
            ])->save();

            $name = $order->contact?->display_name ?: 'The buyer';
            $plot = $order->plot_or_file ?: ($order->unit?->name ?: 'the file');
            $body = $name.', plot '.$plot.' is ready for handover. Please schedule possession.';

            WorkspaceNotifier::send(
                'handover_ready',
                'Ready for handover',
                $body,
                '/bookings/'.$order->code,
                WorkspaceNotifier::userOrMembers($order->assigned_to),
            );
            $this->sendWhatsApp($order->contact?->phone_number, $body);

            $this->orderActivity->log($order, 'Ready for handover', $order->contact?->display_name ?: 'Booking', $actorId);

            if ($order->lead) {
                $this->activity->log($order->lead, 'Ready for handover', $order->contact?->display_name ?: 'Booking', $actorId);
            }

            return $order;
        });
    }

    public function deliver(Order $order, ?int $actorId): Order
    {
        return DB::connection('tenant')->transaction(function () use ($order, $actorId): Order {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();

            if ($order->status === Order::STATUS_CANCELLED || $order->isClosed()) {
                throw ValidationException::withMessages([
                    'order' => 'A closed booking cannot be handed over.',
                ]);
            }

            if ($order->handover_ready_at === null) {
                throw ValidationException::withMessages([
                    'order' => 'Mark the file ready for handover before delivering it.',
                ]);
            }

            $order->loadMissing('project');

            if ($order->project?->balloting_enabled && $order->balloted_at === null) {
                throw ValidationException::withMessages([
                    'order' => 'Confirm balloting before completing this booking.',
                ]);
            }

            if ($order->unit_id !== null && $order->allocated_at === null) {
                $unit = Unit::query()->whereKey($order->unit_id)->lockForUpdate()->first();
                $unit?->consumeForSale();
            }

            $order->forceFill([
                'status' => Order::STATUS_COMPLETED,
                'stage' => Order::STAGE_CLOSED,
                'delivered_at' => now(),
            ])->save();

            $this->orderActivity->log($order, 'Booking completed', $order->contact?->display_name ?: 'Booking', $actorId);

            if ($order->lead) {
                $this->activity->log($order->lead, 'Asset delivered', $order->contact?->display_name ?: 'Booking', $actorId);
            }

            return $order;
        });
    }

    public function remindDueSoon(): int
    {
        $dueOn = now()->addDays(7)->toDateString();
        $sent = 0;

        $rows = PaymentInstallment::query()
            ->with(['plan.order.contact', 'plan.order.unit'])
            ->whereDate('due_on', $dueOn)
            ->where('status', PaymentInstallment::STATUS_PENDING)
            ->whereNull('reminded_at')
            ->get();

        foreach ($rows as $row) {
            $order = $row->plan?->order;

            if ($order === null || $order->status === Order::STATUS_CANCELLED) {
                continue;
            }

            $name = $order->contact?->display_name ?: 'Customer';
            $plot = $order->plot_or_file ?: ($order->unit?->code ?: 'your file');
            $body = 'Dear '.$name.', your installment for Plot #'.$plot.' is due on '.$row->due_on?->toDateString().'. Please prepare your pay order.';

            WorkspaceNotifier::send(
                'installment_due',
                'Installment due',
                $body,
                '/bookings/'.$order->code,
                WorkspaceNotifier::userOrMembers($order->assigned_to),
            );
            $this->sendWhatsApp($order->contact?->phone_number, $body);

            $row->forceFill(['reminded_at' => now()])->save();
            $sent++;
        }

        return $sent;
    }

    /**
     * @return array<string, mixed>
     */
    public function snapshot(Order $order): array
    {
        $this->ensureTokenPaymentProofDocument($order);

        $order->loadMissing([
            'paymentPlan.installments',
            'payments',
            'transfers.fromContact',
            'transfers.toContact',
            'contact',
            'project',
            'unit.block',
            'activities.user',
            'activities.gallery.asset',
            'activities.documents.asset',
            'lead.tasks.user',
            'lead.tasks.gallery.asset',
            'lead.tasks.documents.asset',
            'documents.asset',
        ]);
        $plan = $order->paymentPlan;
        $ledger = $this->ledger($order);
        $kycDocuments = $order->documents
            ->map(fn ($link): ?array => $link->asset ? [
                'id' => $link->asset->id,
                'link_id' => $link->id,
                'name' => $link->asset->name,
                'url' => $this->assets->url($link->asset),
                'type' => $link->asset->type,
                'label' => $link->label,
                'is_secure' => (bool) $link->is_secure,
            ] : null)
            ->filter()
            ->values()
            ->all();

        $requiredLabels = $this->requiredKycDocumentLabels();

        $linkedLabels = collect($kycDocuments)
            ->pluck('label')
            ->filter()
            ->unique()
            ->values();

        $kycDocsReady = $requiredLabels->isEmpty()
            || $requiredLabels->every(fn (string $label): bool => $linkedLabels->contains($label));

        $tokenInstallment = $plan?->installments
            ?->firstWhere('kind', PaymentInstallment::KIND_TOKEN);

        $tokenPayment = $tokenInstallment
            ? $order->payments->firstWhere('payment_installment_id', $tokenInstallment->id)
            : null;

        if ($tokenPayment === null) {
            $tokenPayment = $order->payments->first(
                fn (OrderPayment $payment): bool => str_contains(strtolower((string) $payment->notes), 'token'),
            );
        }

        $paymentAccountsById = collect(PaymentAccount::catalog())->keyBy('id');
        $tokenAccount = $tokenPayment?->payment_account_id
            ? $paymentAccountsById->get($tokenPayment->payment_account_id)
            : null;

        return [
            'stage' => $order->stage ?: Order::STAGE_TOKEN,
            'status' => $order->status ?: Order::STATUS_HOLD,
            'liaison_active' => $order->isLiaisonActive(),
            'balloting_enabled' => (bool) ($order->project?->balloting_enabled ?? false),
            'net_price' => (float) $this->money($this->netCents($order)),
            'booking' => [
                'customer_legal_name' => $order->customer_legal_name ?: $order->contact?->display_name,
                'identity_kind' => $order->identity_kind ?: 'cnic',
                'identity_number' => $order->identity_number ?: $order->contact?->cnic,
                'overseas' => (bool) $order->overseas,
                'local_phone' => $order->local_phone ?: $order->contact?->phone_number_alt,
                'international_phone' => $order->international_phone ?: $order->contact?->phone_number,
                'nominee_name' => $order->nominee_name,
                'nominee_relation' => $order->nominee_relation,
                'nominee_identity_kind' => $order->nominee_identity_kind ?: 'cnic',
                'nominee_cnic' => $order->nominee_cnic,
                'nominee_phone' => $order->nominee_phone,
                'phase' => $order->phase ?: $order->project?->title,
                'sector' => $order->sector ?: $order->unit?->sector,
                'block' => $order->unit?->block?->title,
                'plot_or_file' => $order->plot_or_file ?: $order->unit?->code,
                'category' => $order->category ?: 'standard',
                'premium' => (float) $order->premium,
                'discount' => (float) $order->discount,
                'verified_at' => $order->booking_verified_at?->toIso8601String(),
                'booking_number' => $order->booking_number,
                'agreed_price' => (float) $order->agreed_price,
                'token_amount' => (float) ($tokenInstallment?->amount ?? 0),
                'token_payment' => $tokenPayment ? [
                    'id' => $tokenPayment->id,
                    'amount' => (float) $tokenPayment->amount,
                    'method' => $tokenPayment->method,
                    'reference' => $tokenPayment->reference,
                    'paid_on' => $tokenPayment->paid_on?->toDateString(),
                    'payment_account_id' => $tokenPayment->payment_account_id,
                    'payment_account' => $this->paymentAccountLabel($tokenAccount),
                ] : null,
                'inventory_kind' => $order->inventory_kind,
                'dimensions' => $order->dimensions,
                'balloted_at' => $order->balloted_at?->toIso8601String(),
            ],
            'kyc_documents' => $kycDocuments,
            'kyc_docs_ready' => $kycDocsReady,
            'plan' => $plan ? [
                'template' => $plan->template,
                'title' => $this->planTitle($plan->template),
                'summary' => $this->planSummary($plan),
                'down_payment' => (float) $plan->down_payment,
                'handover_percent' => (float) $plan->handover_percent,
                'frequency' => $plan->frequency,
                'installment_count' => (int) $plan->installment_count,
                'late_fee_basis' => $plan->late_fee_basis,
                'late_fee_rate' => (float) $plan->late_fee_rate,
            ] : null,
            'templates' => $this->planTemplates($order),
            'categories' => collect(MetaData::unitCategoryOptions())
                ->map(fn (string $value): array => [
                    'id' => $value,
                    'label' => $value,
                ])
                ->values()
                ->all(),
            'ledger' => $ledger,
            'installments' => $plan
                ? $plan->installments->map(fn (PaymentInstallment $row): array => $this->installmentRow($row, $plan, $order))->values()->all()
                : [],
            'installment_totals' => $this->installmentTotals($order),
            'activities' => $this->orderActivity->timeline($order),
            'payment_methods' => OrderPayment::methodOptions(),
            'payment_accounts' => collect(PaymentAccount::catalog())
                ->filter(fn (array $account): bool => (bool) ($account['is_enabled'] ?? false))
                ->values()
                ->all(),
            'payments' => $order->payments->map(function (OrderPayment $payment) use ($order, $paymentAccountsById): array {
                $asset = $payment->receipt_asset_id
                    ? Asset::query()->find($payment->receipt_asset_id)
                    : null;
                $account = $payment->payment_account_id
                    ? $paymentAccountsById->get($payment->payment_account_id)
                    : null;

                return [
                    'id' => $payment->id,
                    'amount' => (float) $payment->amount,
                    'method' => $payment->method,
                    'reference' => $payment->reference,
                    'paid_on' => $payment->paid_on?->toDateString(),
                    'notes' => $payment->notes,
                    'payment_account_id' => $payment->payment_account_id,
                    'payment_account' => $this->paymentAccountLabel($account),
                    'receipt_url' => $this->assets->url($asset),
                    'voucher_url' => route('portal.orders.payments.voucher', [
                        'order' => $order->code,
                        'payment' => $payment->id,
                    ], absolute: false),
                ];
            })->values()->all(),
            'transfers' => $order->transfers->map(fn (OrderTransfer $transfer): array => [
                'id' => $transfer->id,
                'from' => $transfer->fromContact?->display_name,
                'to' => $transfer->toContact?->display_name,
                'outstanding' => (float) $transfer->outstanding,
                'ndc_cleared' => (bool) $transfer->ndc_cleared,
                'notes' => $transfer->notes,
                'transferred_at' => $transfer->transferred_at?->toIso8601String(),
            ])->values()->all(),
            'checklist' => [
                'original_files' => (bool) data_get($order->handover_checklist, 'original_files'),
                'allotment_letter' => (bool) data_get($order->handover_checklist, 'allotment_letter'),
                'registry_docs' => (bool) data_get($order->handover_checklist, 'registry_docs'),
            ],
            'handover_ready_at' => $order->handover_ready_at?->toIso8601String(),
            'delivered_at' => $order->delivered_at?->toIso8601String(),
        ];
    }

    /**
     * @return list<array{id: string|int, label: string, frequency: string, count: int, balloon_every: ?int, down_payment_percent: ?float, handover_percent: ?float}>
     */
    protected function planTemplates(Order $order): array
    {
        PaymentPlanTemplate::ensureDefaults();

        $projectId = $order->project_id;

        $rows = PaymentPlanTemplate::query()
            ->enabled()
            ->where(function ($query) use ($projectId): void {
                $query->whereNull('project_id');

                if ($projectId) {
                    $query->orWhere('project_id', $projectId);
                }
            })
            ->orderByRaw('CASE WHEN project_id IS NULL THEN 1 ELSE 0 END')
            ->orderBy('title')
            ->get()
            ->map(fn (PaymentPlanTemplate $template): array => [
                'id' => $template->id,
                'label' => $template->title,
                'frequency' => $template->frequency,
                'count' => (int) $template->installment_count,
                'balloon_every' => $template->balloon_every !== null ? (int) $template->balloon_every : null,
                'down_payment_percent' => (float) $template->down_payment_percent,
                'handover_percent' => (float) $template->handover_percent,
            ])
            ->values()
            ->all();

        $rows[] = [
            'id' => 'custom',
            'label' => 'Custom',
            'frequency' => 'monthly',
            'count' => 12,
            'balloon_every' => null,
            'down_payment_percent' => null,
            'handover_percent' => null,
        ];

        return $rows;
    }

    protected function planTitle(?string $templateKey): string
    {
        if ($templateKey === null || $templateKey === '') {
            return 'Payment plan';
        }

        if (str_starts_with($templateKey, 'template:')) {
            $id = (int) substr($templateKey, 9);
            $title = PaymentPlanTemplate::query()->whereKey($id)->value('title');

            if (is_string($title) && $title !== '') {
                return $title;
            }
        }

        foreach (PaymentSchedule::templates() as $template) {
            if ($template['id'] === $templateKey) {
                return $template['label'];
            }
        }

        if ($templateKey === PaymentSchedule::TEMPLATE_CUSTOM || $templateKey === 'custom') {
            return 'Custom plan';
        }

        return 'Payment plan';
    }

    protected function planSummary(PaymentPlan $plan): string
    {
        $parts = [];

        if ($plan->frequency) {
            $parts[] = ucfirst((string) $plan->frequency);
        }

        if ($plan->installment_count) {
            $parts[] = (int) $plan->installment_count.' installments';
        }

        if ($plan->down_payment !== null && (float) $plan->down_payment > 0) {
            $parts[] = $this->money($this->cents($plan->down_payment)).' down';
        }

        if ($plan->handover_percent !== null && (float) $plan->handover_percent > 0) {
            $parts[] = rtrim(rtrim(number_format((float) $plan->handover_percent, 2, '.', ''), '0'), '.').'% handover';
        }

        return $parts !== [] ? implode(' · ', $parts) : 'No schedule details yet';
    }

    /**
     * @return array{total_paid: float, total_outstanding: float, upcoming: float, overdue: float, late_fees: float, scheduled: float, remaining: float, is_late: bool}
     */
    public function ledger(Order $order): array
    {
        $order->loadMissing(['paymentPlan.installments', 'payments']);
        $plan = $order->paymentPlan;
        $paid = (int) $order->payments->sum(fn (OrderPayment $payment): int => $this->cents($payment->amount));
        $late = 0;
        $overdue = 0;
        $upcoming = 0;
        $scheduled = 0;

        foreach ($plan?->installments ?? [] as $row) {
            $scheduled += $this->cents($row->amount);

            if (! $row->isPending()) {
                continue;
            }

            $fee = $plan ? $this->lateFeeCents($row, $plan) : 0;
            $remaining = max(0, $this->cents($row->amount) + $fee - $this->cents($row->paid_amount));
            $late += $fee;

            if ($row->due_on !== null && $row->due_on->lt(today())) {
                $overdue += $remaining;
            } elseif ($upcoming === 0) {
                $upcoming = $remaining;
            }
        }

        $outstanding = max(0, $this->netCents($order) + $late - $paid);

        return [
            'total_paid' => (float) $this->money($paid),
            'total_outstanding' => (float) $this->money($outstanding),
            'upcoming' => (float) $this->money($upcoming),
            'overdue' => (float) $this->money($overdue),
            'late_fees' => (float) $this->money($late),
            'scheduled' => (float) $this->money($scheduled),
            'remaining' => (float) $this->money($outstanding),
            'is_late' => $overdue > 0,
        ];
    }

    /**
     * @return array{scheduled: float, paid: float, remaining: float, late_fees: float, outstanding: float}
     */
    public function installmentTotals(Order $order): array
    {
        $ledger = $this->ledger($order);

        return [
            'scheduled' => $ledger['scheduled'],
            'paid' => $ledger['total_paid'],
            'remaining' => $ledger['remaining'],
            'late_fees' => $ledger['late_fees'],
            'outstanding' => $ledger['total_outstanding'],
        ];
    }

    public function syncActiveStatus(Order $order): Order
    {
        if ($order->stage !== Order::STAGE_ACTIVE || $order->status === Order::STATUS_LITIGATION) {
            return $order;
        }

        $order->loadMissing(['paymentPlan.installments', 'payments']);
        $ledger = $this->ledger($order);
        $overdueCents = $this->cents($ledger['overdue']);

        $status = Order::STATUS_IN_PROGRESS;

        if ($overdueCents > 0) {
            $oldestOverdueDays = 0;

            foreach ($order->paymentPlan?->installments ?? [] as $row) {
                if (! $row->isPending() || $row->due_on === null || ! $row->due_on->lt(today())) {
                    continue;
                }

                $oldestOverdueDays = max($oldestOverdueDays, (int) $row->due_on->diffInDays(today()));
            }

            $status = $oldestOverdueDays >= 90
                ? Order::STATUS_DEFAULTER
                : Order::STATUS_OVERDUE;
        }

        if ($order->status !== $status) {
            $order->forceFill(['status' => $status])->save();
        }

        return $order;
    }

    /**
     * Mandatory KYC document labels currently configured (does not seed defaults).
     *
     * @return Collection<int, string>
     */
    protected function requiredKycDocumentLabels(): Collection
    {
        return BookingDocumentType::query()
            ->where('is_required', true)
            ->orderBy('priority')
            ->pluck('label')
            ->filter()
            ->values();
    }

    /**
     * Labels linked on the order as KYC documents.
     *
     * @return Collection<int, string>
     */
    protected function linkedKycDocumentLabels(Order $order): Collection
    {
        $order->loadMissing('documents');

        return $order->documents
            ->pluck('label')
            ->filter()
            ->unique()
            ->values();
    }

    /**
     * Ensure the token payment receipt is filed on the booking under Pay order / cheque copy.
     */
    public function ensureTokenPaymentProofDocument(Order $order): void
    {
        $order->loadMissing(['payments.installment', 'documents']);

        $tokenPayment = $order->payments->first(
            fn (OrderPayment $payment): bool => $payment->receipt_asset_id !== null
                && $payment->installment?->kind === PaymentInstallment::KIND_TOKEN,
        );

        if ($tokenPayment === null) {
            $tokenPayment = $order->payments->first(
                fn (OrderPayment $payment): bool => $payment->receipt_asset_id !== null
                    && str_contains(strtolower((string) $payment->notes), 'token'),
            );
        }

        if ($tokenPayment === null || $tokenPayment->receipt_asset_id === null) {
            return;
        }

        $assetId = (int) $tokenPayment->receipt_asset_id;
        $asset = Asset::query()->find($assetId);

        if ($asset === null) {
            return;
        }

        $alreadyLinked = $order->documents->contains(
            fn ($link): bool => (int) $link->asset_id === $assetId,
        );

        if (! $alreadyLinked) {
            $existingPayOrderIds = $order->documents
                ->filter(fn ($link): bool => $link->label === BookingDocumentType::LABEL_PAY_ORDER)
                ->pluck('asset_id')
                ->map(fn ($id): int => (int) $id)
                ->values()
                ->all();

            $this->assets->syncLinks(
                $order,
                AssetManager::LINKAGE_DOCUMENT,
                [...$existingPayOrderIds, $assetId],
                BookingDocumentType::LABEL_PAY_ORDER,
            );

            $order->unsetRelation('documents');
            $order->load('documents.asset');
        }

        $folder = $order->ensureDocumentFolder();
        $this->assets->moveToFolder($asset, $folder);
    }

    protected function kycDocumentsAreReady(Order $order): bool
    {
        $required = $this->requiredKycDocumentLabels();

        if ($required->isEmpty()) {
            return true;
        }

        $linked = $this->linkedKycDocumentLabels($order);

        return $required->every(fn (string $label): bool => $linked->contains($label));
    }

    /**
     * @return Collection<int, string>
     */
    protected function missingKycDocumentLabels(Order $order): Collection
    {
        $linked = $this->linkedKycDocumentLabels($order);
        $titles = BookingDocumentType::query()
            ->orderBy('priority')
            ->get(['label', 'title'])
            ->keyBy('label');

        return $this->requiredKycDocumentLabels()
            ->reject(fn (string $label): bool => $linked->contains($label))
            ->map(fn (string $label): string => (string) ($titles->get($label)?->title ?: $label))
            ->values();
    }

    /**
     * @param  array<string, mixed>|null  $account
     */
    protected function paymentAccountLabel(?array $account): ?string
    {
        if ($account === null || ! filled($account['name'] ?? null)) {
            return null;
        }

        $typeLabel = ($account['type'] ?? null) === PaymentAccount::TYPE_CASH ? 'Cash' : 'Bank';
        $details = collect([
            $account['bank_name'] ?? null,
            $account['account_number'] ?? null,
        ])->filter()->implode(' · ');

        return $details !== ''
            ? $account['name'].' ('.$typeLabel.') · '.$details
            : $account['name'].' ('.$typeLabel.')';
    }

    protected function lockOpen(Order $order): Order
    {
        $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();

        if ($order->status === Order::STATUS_CANCELLED || $order->stage === Order::STAGE_CLOSED) {
            throw ValidationException::withMessages([
                'order' => 'This booking is closed.',
            ]);
        }

        if ($order->status === Order::STATUS_COMPLETED) {
            throw ValidationException::withMessages([
                'order' => 'This booking has already been completed.',
            ]);
        }

        return $order;
    }

    protected function requirePlan(Order $order): void
    {
        $plan = $order->paymentPlan()->first();

        if ($plan === null || $plan->template === null) {
            throw ValidationException::withMessages([
                'order' => 'Build a payment plan before this step.',
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected function resolveBuyer(array $data): Contact
    {
        if (! empty($data['to_contact_id'])) {
            return Contact::query()->findOrFail($data['to_contact_id']);
        }

        return Contact::query()->create([
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'] ?? null,
            'phone_number' => $data['phone_number'],
            'cnic' => $data['cnic'] ?? null,
            'type' => Contact::TYPE_CLIENT,
        ]);
    }

    protected function syncBookingPayment(Order $order, int $downCents): void
    {
        $payment = OrderPayment::query()
            ->where('order_id', $order->id)
            ->where('method', OrderPayment::METHOD_BOOKING)
            ->first();

        if ($downCents <= 0) {
            $payment?->delete();

            return;
        }

        $payload = [
            'amount' => $this->money($downCents),
            'paid_on' => now()->toDateString(),
            'notes' => 'Collected at booking',
        ];

        if ($payment) {
            $payment->forceFill($payload)->save();

            return;
        }

        OrderPayment::query()->create([
            ...$payload,
            'order_id' => $order->id,
            'method' => OrderPayment::METHOD_BOOKING,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    protected function installmentRow(PaymentInstallment $row, PaymentPlan $plan, ?Order $order = null): array
    {
        $fee = $this->lateFeeCents($row, $plan);
        $remaining = max(0, $this->cents($row->amount) + $fee - $this->cents($row->paid_amount));
        $order ??= $plan->order;
        $paid = ! $row->isPending();
        $linkedPayment = $paid && $order
            ? $order->payments->firstWhere('payment_installment_id', $row->id)
            : null;

        return [
            'id' => $row->id,
            'sequence' => $row->sequence,
            'kind' => $row->kind,
            'label' => $row->label,
            'amount' => (float) $row->amount,
            'paid_amount' => (float) $row->paid_amount,
            'remaining' => (float) $this->money($remaining),
            'late_fee' => (float) $this->money($fee),
            'due_on' => $row->due_on?->toDateString(),
            'status' => $row->status,
            'overdue' => $row->isPending() && $row->due_on !== null && $row->due_on->lt(today()),
            'paid_at' => $row->paid_at?->toIso8601String(),
            'receipt_url' => $linkedPayment
                ? route('portal.orders.payments.voucher', [
                    'order' => $order->code,
                    'payment' => $linkedPayment->id,
                ], absolute: false)
                : null,
            'voucher_url' => $linkedPayment
                ? route('portal.orders.payments.voucher', [
                    'order' => $order->code,
                    'payment' => $linkedPayment->id,
                ], absolute: false)
                : null,
            'pay_voucher_url' => $order && ! $paid
                ? route('portal.orders.installments.pay-voucher', [
                    'order' => $order->code,
                    'installment' => $row->id,
                ], absolute: false)
                : null,
        ];
    }

    protected function outstandingCents(Order $order): int
    {
        return $this->cents($this->ledger($order)['total_outstanding']);
    }

    protected function lateFeeCents(PaymentInstallment $row, PaymentPlan $plan): int
    {
        if (! $row->isPending() || $row->due_on === null || ! $row->due_on->lt(today())) {
            return 0;
        }

        $rate = (float) $plan->late_fee_rate;

        if ($rate <= 0 || ! in_array($plan->late_fee_basis, ['daily', 'monthly'], true)) {
            return 0;
        }

        $unpaid = max(0, $this->cents($row->amount) - $this->cents($row->paid_amount));

        if ($unpaid <= 0) {
            return 0;
        }

        $days = (int) $row->due_on->diffInDays(today());
        $periods = $plan->late_fee_basis === 'daily' ? max(1, $days) : (int) max(1, ceil($days / 30));

        return (int) round($unpaid * $rate / 100 * $periods);
    }

    protected function netCents(Order $order): int
    {
        return max(0, $this->cents($order->agreed_price) + $this->cents($order->premium) - $this->cents($order->discount));
    }

    protected function sendWhatsApp(?string $phone, string $body): void
    {
        if ($phone === null || $phone === '') {
            return;
        }

        $integration = Integration::query()
            ->where('provider', Integration::PROVIDER_WHATSAPP)
            ->where('status', Integration::STATUS_CONNECTED)
            ->first();

        $phoneNumberId = data_get($integration?->settings, 'primary_phone_number_id');

        if ($integration === null || ! is_string($phoneNumberId) || $phoneNumberId === '' || $integration->access_token === null) {
            return;
        }

        try {
            $this->whatsapp->sendText($phoneNumberId, $integration->access_token, $phone, $body);
        } catch (Throwable) {
            // The in-app reminder still stands if WhatsApp is unavailable.
        }
    }

    protected function cents(float|int|string|null $amount): int
    {
        return (int) round(((float) $amount) * 100);
    }

    protected function money(int $cents): string
    {
        return number_format($cents / 100, 2, '.', '');
    }
}

<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\Contact;
use App\Models\Integration;
use App\Models\Order;
use App\Models\OrderPayment;
use App\Models\OrderTransfer;
use App\Models\PaymentInstallment;
use App\Models\PaymentPlan;
use App\Models\Unit;
use App\Support\AssetManager;
use App\Support\Deals\PaymentSchedule;
use App\Support\Integrations\WhatsApp\WhatsAppGraphClient;
use App\Support\Notifications\WorkspaceNotifier;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class DealPipeline
{
    public function __construct(
        protected LeadActivity $activity,
        protected AssetManager $assets,
        protected WhatsAppGraphClient $whatsapp,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function verify(Order $order, array $data, ?int $actorId): Order
    {
        return DB::connection('tenant')->transaction(function () use ($order, $data, $actorId): Order {
            $order = $this->lockOpen($order);

            $order->forceFill([
                'identity_kind' => $data['identity_kind'],
                'identity_number' => $data['identity_number'],
                'overseas' => (bool) ($data['overseas'] ?? false),
                'local_phone' => $data['local_phone'] ?? null,
                'nominee_name' => $data['nominee_name'],
                'nominee_relation' => $data['nominee_relation'],
                'nominee_cnic' => $data['nominee_cnic'],
                'nominee_phone' => $data['nominee_phone'] ?? null,
                'phase' => $data['phase'] ?? null,
                'sector' => $data['sector'] ?? $order->unit?->sector,
                'plot_or_file' => $data['plot_or_file'],
                'category' => $data['category'],
                'premium' => $this->money($this->cents($data['premium'] ?? 0)),
                'discount' => $this->money($this->cents($data['discount'] ?? 0)),
                'booking_verified_at' => $order->booking_verified_at ?? now(),
                'stage' => $order->stage === Order::STAGE_BOOKING ? Order::STAGE_PLAN : $order->stage,
            ])->save();

            $contact = $order->contact;

            if ($contact) {
                $contact->forceFill([
                    'cnic' => $data['identity_kind'] === 'cnic' ? $data['identity_number'] : $contact->cnic,
                    'phone_number_alt' => $data['local_phone'] ?? $contact->phone_number_alt,
                    'type' => Contact::TYPE_CLIENT,
                ])->save();
            }

            if ($order->lead) {
                $this->activity->log($order->lead, 'Booking verified', $order->code, $actorId);
            }

            return $order;
        });
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

            $net = $this->netCents($order);
            $down = $this->cents($data['down_payment'] ?? 0);
            $percent = (float) $data['handover_percent'];
            $handover = (int) round($net * $percent / 100);

            if ($down + $handover > $net) {
                throw ValidationException::withMessages([
                    'down_payment' => 'The down payment and handover amount cannot exceed the net price.',
                ]);
            }

            [$frequency, $count, $balloonEvery] = PaymentSchedule::resolve(
                (string) $data['template'],
                $data['frequency'] ?? null,
                isset($data['installment_count']) ? (int) $data['installment_count'] : null,
            );

            $plan = $order->paymentPlan()->firstOrFail();
            $plan->installments()->delete();
            $plan->forceFill([
                'agreed_price' => $this->money($net),
                'template' => $data['template'],
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

            if (in_array($order->stage, [Order::STAGE_BOOKING, Order::STAGE_PLAN], true)) {
                $order->forceFill(['stage' => Order::STAGE_TRACKING])->save();
            }

            return $order;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function recordPayment(Order $order, array $data, ?UploadedFile $receipt): OrderPayment
    {
        return DB::connection('tenant')->transaction(function () use ($order, $data, $receipt): OrderPayment {
            $order = $this->lockOpen($order);
            $plan = $order->paymentPlan()->first();

            if ($plan === null || $plan->template === null) {
                throw ValidationException::withMessages([
                    'order' => 'Build a payment plan before recording a receipt.',
                ]);
            }

            $left = $this->cents($data['amount']);
            $firstId = null;
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
                $firstId ??= $row->id;
                $left -= $apply;
            }

            if ($firstId === null) {
                throw ValidationException::withMessages([
                    'amount' => 'There is nothing left to collect on this plan.',
                ]);
            }

            if ($left > 0) {
                throw ValidationException::withMessages([
                    'amount' => 'That amount is more than the outstanding balance.',
                ]);
            }

            $payment = OrderPayment::query()->create([
                'order_id' => $order->id,
                'payment_installment_id' => $firstId,
                'amount' => $this->money($this->cents($data['amount'])),
                'method' => $data['method'],
                'reference' => $data['reference'] ?? null,
                'paid_on' => $data['paid_on'],
                'notes' => $data['notes'] ?? null,
            ]);

            if ($receipt !== null) {
                $asset = $this->assets->attach($payment, $receipt, AssetManager::LINKAGE_DOCUMENT, 'receipts');
                $payment->forceFill(['receipt_asset_id' => $asset->asset_id])->save();
            }

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

            $order->forceFill([
                'inventory_kind' => Order::INVENTORY_PLOT,
                'plot_or_file' => $data['plot_number'],
                'dimensions' => $data['dimensions'],
                'phase' => $data['phase'] ?? $order->phase,
                'sector' => $data['sector'] ?? $order->sector,
                'balloted_at' => now(),
                'stage' => in_array($order->stage, [Order::STAGE_TRACKING, Order::STAGE_PLAN], true)
                    ? Order::STAGE_TRANSFER
                    : $order->stage,
            ])->save();

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
            $this->requirePlan($order);

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
                'stage' => $order->stage === Order::STAGE_TRACKING ? Order::STAGE_TRANSFER : $order->stage,
            ])->save();

            if ($order->lead) {
                $order->lead->forceFill(['contact_id' => $buyer->id])->save();
                $this->activity->log(
                    $order->lead,
                    'File transferred',
                    $buyer->display_name.($transfer->ndc_cleared ? ' · NDC cleared' : ' · NDC outstanding'),
                    $actorId,
                );
            }

            return $transfer;
        });
    }

    /**
     * @param  array<string, mixed>  $checklist
     */
    public function ready(Order $order, array $checklist, ?int $actorId): Order
    {
        return DB::connection('tenant')->transaction(function () use ($order, $checklist, $actorId): Order {
            $order = $this->lockOpen($order);
            $order->load(['paymentPlan.installments', 'payments', 'contact', 'unit']);

            if ($this->outstandingCents($order) > 0) {
                throw ValidationException::withMessages([
                    'order' => 'The statement of account still has a balance. Clear every installment and late fee first.',
                ]);
            }

            $order->forceFill([
                'handover_checklist' => [
                    'original_files' => (bool) ($checklist['original_files'] ?? false),
                    'allotment_letter' => (bool) ($checklist['allotment_letter'] ?? false),
                    'registry_docs' => (bool) ($checklist['registry_docs'] ?? false),
                ],
                'handover_ready_at' => now(),
                'stage' => Order::STAGE_HANDOVER,
            ])->save();

            $name = $order->contact?->display_name ?: 'The buyer';
            $plot = $order->plot_or_file ?: ($order->unit?->code ?: 'the file');
            $body = $name.', plot '.$plot.' is ready for handover. Please schedule possession.';

            WorkspaceNotifier::send(
                'handover_ready',
                'Ready for handover',
                $body,
                '/orders/'.$order->code,
                WorkspaceNotifier::userOrMembers($order->assigned_to),
            );
            $this->sendWhatsApp($order->contact?->phone_number, $body);

            if ($order->lead) {
                $this->activity->log($order->lead, 'Ready for handover', $order->code, $actorId);
            }

            return $order;
        });
    }

    public function deliver(Order $order, ?int $actorId): Order
    {
        return DB::connection('tenant')->transaction(function () use ($order, $actorId): Order {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();

            if ($order->status === Order::STATUS_CANCELLED) {
                throw ValidationException::withMessages([
                    'order' => 'A cancelled booking cannot be handed over.',
                ]);
            }

            if ($order->handover_ready_at === null) {
                throw ValidationException::withMessages([
                    'order' => 'Mark the file ready for handover before delivering it.',
                ]);
            }

            if ($order->unit_id !== null) {
                Unit::query()->whereKey($order->unit_id)->lockForUpdate()->update([
                    'status' => Unit::STATUS_SOLD,
                ]);
            }

            $order->forceFill([
                'status' => Order::STATUS_DELIVERED,
                'stage' => Order::STAGE_DELIVERED,
                'delivered_at' => now(),
            ])->save();

            if ($order->lead) {
                $this->activity->log($order->lead, 'Asset delivered', $order->code, $actorId);
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
                '/orders/'.$order->code,
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
        $order->loadMissing(['paymentPlan.installments', 'payments', 'transfers.fromContact', 'transfers.toContact', 'contact', 'project', 'unit.block']);
        $plan = $order->paymentPlan;
        $ledger = $this->ledger($order);

        return [
            'stage' => $order->stage ?: Order::STAGE_BOOKING,
            'net_price' => (float) $this->money($this->netCents($order)),
            'booking' => [
                'identity_kind' => $order->identity_kind ?: 'cnic',
                'identity_number' => $order->identity_number ?: $order->contact?->cnic,
                'overseas' => (bool) $order->overseas,
                'local_phone' => $order->local_phone ?: $order->contact?->phone_number,
                'nominee_name' => $order->nominee_name,
                'nominee_relation' => $order->nominee_relation,
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
                'inventory_kind' => $order->inventory_kind,
                'dimensions' => $order->dimensions,
                'balloted_at' => $order->balloted_at?->toIso8601String(),
            ],
            'plan' => $plan ? [
                'template' => $plan->template,
                'down_payment' => (float) $plan->down_payment,
                'handover_percent' => (float) $plan->handover_percent,
                'frequency' => $plan->frequency,
                'installment_count' => (int) $plan->installment_count,
                'late_fee_basis' => $plan->late_fee_basis,
                'late_fee_rate' => (float) $plan->late_fee_rate,
            ] : null,
            'templates' => PaymentSchedule::templates(),
            'categories' => [
                ['id' => 'standard', 'label' => 'Standard'],
                ['id' => 'corner', 'label' => 'Corner'],
                ['id' => 'main_boulevard', 'label' => 'Main Boulevard'],
                ['id' => 'park_facing', 'label' => 'Park Facing'],
            ],
            'ledger' => $ledger,
            'installments' => $plan
                ? $plan->installments->map(fn (PaymentInstallment $row): array => $this->installmentRow($row, $plan))->values()->all()
                : [],
            'payments' => $order->payments->map(function (OrderPayment $payment): array {
                $asset = $payment->receipt_asset_id
                    ? Asset::query()->find($payment->receipt_asset_id)
                    : null;

                return [
                    'id' => $payment->id,
                    'amount' => (float) $payment->amount,
                    'method' => $payment->method,
                    'reference' => $payment->reference,
                    'paid_on' => $payment->paid_on?->toDateString(),
                    'notes' => $payment->notes,
                    'receipt_url' => $this->assets->url($asset),
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
     * @return array{total_paid: float, total_outstanding: float, upcoming: float, overdue: float, late_fees: float, is_late: bool}
     */
    public function ledger(Order $order): array
    {
        $order->loadMissing(['paymentPlan.installments', 'payments']);
        $plan = $order->paymentPlan;
        $paid = (int) $order->payments->sum(fn (OrderPayment $payment): int => $this->cents($payment->amount));
        $late = 0;
        $overdue = 0;
        $upcoming = 0;

        foreach ($plan?->installments ?? [] as $row) {
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
            'is_late' => $overdue > 0,
        ];
    }

    protected function lockOpen(Order $order): Order
    {
        $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();

        if ($order->status === Order::STATUS_CANCELLED) {
            throw ValidationException::withMessages([
                'order' => 'This booking is cancelled.',
            ]);
        }

        if ($order->status === Order::STATUS_DELIVERED) {
            throw ValidationException::withMessages([
                'order' => 'This asset has already been delivered.',
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
    protected function installmentRow(PaymentInstallment $row, PaymentPlan $plan): array
    {
        $fee = $this->lateFeeCents($row, $plan);
        $remaining = max(0, $this->cents($row->amount) + $fee - $this->cents($row->paid_amount));

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

<?php

namespace App\Services;

use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Order;
use App\Models\PaymentInstallment;
use App\Models\PaymentPlan;
use App\Models\Unit;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderService
{
    public function __construct(protected LeadActivity $activity) {}

    /**
     * @param  array{
     *     unit_id: int,
     *     booking_kind: string,
     *     agreed_price: float|int|string,
     *     token_amount?: float|int|string|null,
     *     installment_count: int,
     *     first_due_on: string,
     * }  $data
     */
    public function book(Lead $lead, array $data, ?int $actorId): Order
    {
        if ($lead->isArchived()) {
            throw ValidationException::withMessages([
                'lead' => 'Archived leads cannot be booked.',
            ]);
        }

        if ($lead->contact_id === null) {
            throw ValidationException::withMessages([
                'lead' => 'This lead needs a contact before it can be booked.',
            ]);
        }

        return DB::connection('tenant')->transaction(function () use ($lead, $data, $actorId): Order {
            $lead = Lead::query()->whereKey($lead->id)->lockForUpdate()->firstOrFail();

            $active = Order::query()
                ->where('lead_id', $lead->id)
                ->whereIn('status', Order::activeStatuses())
                ->lockForUpdate()
                ->exists();

            if ($active) {
                throw ValidationException::withMessages([
                    'lead' => 'This lead already has an active order.',
                ]);
            }

            $unit = Unit::query()->whereKey($data['unit_id'])->lockForUpdate()->first();

            if ($unit === null || ! in_array($unit->status, [Unit::STATUS_AVAILABLE, Unit::STATUS_HOLD], true)) {
                throw ValidationException::withMessages([
                    'unit_id' => 'Choose a unit that is available or on hold.',
                ]);
            }

            $kind = $data['booking_kind'];
            $agreed = $this->money($data['agreed_price']);
            $token = $kind === Order::KIND_TOKEN ? $this->money($data['token_amount'] ?? 0) : '0.00';

            if ($this->cents($token) > $this->cents($agreed)) {
                throw ValidationException::withMessages([
                    'token_amount' => 'The token amount cannot be more than the agreed price.',
                ]);
            }

            $stageId = LeadStage::query()->where('label', 'closed_won')->value('id');

            if ($stageId === null) {
                throw ValidationException::withMessages([
                    'lead' => 'Add a Closed Won stage before booking a unit.',
                ]);
            }

            $lead->forceFill([
                'project_id' => $unit->project_id,
                'unit_id' => $unit->id,
                'lead_stage_id' => (int) $stageId,
            ])->save();

            $unit->forceFill([
                'status' => $kind === Order::KIND_TOKEN ? Unit::STATUS_TOKEN : Unit::STATUS_RESERVED,
            ])->save();

            $order = Order::query()->create([
                'lead_id' => $lead->id,
                'contact_id' => $lead->contact_id,
                'project_id' => $unit->project_id,
                'unit_id' => $unit->id,
                'assigned_to' => $lead->assigned_to,
                'booking_kind' => $kind,
                'agreed_price' => $agreed,
                'status' => Order::STATUS_HOLD,
                'stage' => Order::STAGE_TOKEN,
                'booked_at' => now(),
            ]);

            $plan = PaymentPlan::query()->create([
                'order_id' => $order->id,
                'agreed_price' => $agreed,
            ]);

            $this->createInstallments(
                $plan,
                $kind,
                $agreed,
                $token,
                (int) $data['installment_count'],
                Carbon::parse($data['first_due_on'])->startOfDay(),
            );

            $unitLabel = $unit->name ?: 'unit';
            $this->activity->log(
                $lead,
                'Deal booked',
                $unitLabel.' booked at '.$agreed.'.',
                $actorId,
            );

            app(OrderActivity::class)->created($order, $actorId);
            app(OrderActivity::class)->log(
                $order,
                'Entered Token',
                $unitLabel.' · hold',
                $actorId,
            );

            return $order;
        });
    }

    public function cancel(Order $order, ?int $actorId): Order
    {
        return DB::connection('tenant')->transaction(function () use ($order, $actorId): Order {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();

            if (! $order->isOpen()) {
                throw ValidationException::withMessages([
                    'order' => 'Only an open booking can be cancelled.',
                ]);
            }

            if ($order->unit_id !== null) {
                Unit::query()->whereKey($order->unit_id)->lockForUpdate()->update([
                    'status' => Unit::STATUS_AVAILABLE,
                ]);
            }

            $order->forceFill([
                'status' => Order::STATUS_CANCELLED,
                'stage' => Order::STAGE_CLOSED,
                'cancelled_at' => now(),
            ])->save();

            $lead = $order->lead;

            app(OrderActivity::class)->log($order, 'Booking cancelled', $order->contact?->display_name ?: 'Booking', $actorId);

            if ($lead) {
                $this->activity->log($lead, 'Booking cancelled', $order->contact?->display_name ?: 'Booking', $actorId);
            }

            return $order;
        });
    }

    public function allocate(Order $order, ?int $actorId): Order
    {
        return DB::connection('tenant')->transaction(function () use ($order, $actorId): Order {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();

            if (! $order->isOpen()) {
                throw ValidationException::withMessages([
                    'order' => 'Only an open booking can be allocated.',
                ]);
            }

            if ($order->unit_id !== null) {
                Unit::query()->whereKey($order->unit_id)->lockForUpdate()->update([
                    'status' => Unit::STATUS_SOLD,
                ]);
            }

            $order->forceFill([
                'status' => Order::STATUS_CURRENT,
                'stage' => Order::STAGE_ACTIVE,
                'allocated_at' => now(),
            ])->save();

            $lead = $order->lead;

            if ($lead) {
                $this->activity->log($lead, 'Unit allocated', $order->unit?->name ?: 'Unit', $actorId);
            }

            return $order;
        });
    }

    public function markPaid(PaymentInstallment $installment): PaymentInstallment
    {
        return DB::connection('tenant')->transaction(function () use ($installment): PaymentInstallment {
            $installment = PaymentInstallment::query()->whereKey($installment->id)->lockForUpdate()->firstOrFail();
            $installment->load('plan.order');

            if (! $installment->isPending()) {
                throw ValidationException::withMessages([
                    'installment' => 'This installment is already paid.',
                ]);
            }

            if ($installment->plan?->order?->status === Order::STATUS_CANCELLED) {
                throw ValidationException::withMessages([
                    'installment' => 'Payments cannot be recorded on a cancelled order.',
                ]);
            }

            $installment->forceFill([
                'status' => PaymentInstallment::STATUS_PAID,
                'paid_amount' => $installment->amount,
                'paid_at' => now(),
            ])->save();

            return $installment;
        });
    }

    protected function createInstallments(
        PaymentPlan $plan,
        string $kind,
        string $agreed,
        string $token,
        int $count,
        Carbon $firstDue,
    ): void {
        $agreedCents = $this->cents($agreed);
        $tokenCents = $kind === Order::KIND_TOKEN ? $this->cents($token) : 0;
        $sequence = 1;

        if ($tokenCents > 0) {
            PaymentInstallment::query()->create([
                'payment_plan_id' => $plan->id,
                'sequence' => $sequence,
                'kind' => PaymentInstallment::KIND_TOKEN,
                'label' => 'Token',
                'amount' => $this->fromCents($tokenCents),
                'due_on' => now()->toDateString(),
                'status' => PaymentInstallment::STATUS_PENDING,
            ]);
            $sequence++;
        }

        $remainder = $agreedCents - $tokenCents;

        if ($remainder <= 0 || $count < 1) {
            return;
        }

        $base = intdiv($remainder, $count);
        $extra = $remainder % $count;

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
                'amount' => $this->fromCents($cents),
                'due_on' => $firstDue->copy()->addMonths($index)->toDateString(),
                'status' => PaymentInstallment::STATUS_PENDING,
            ]);
            $sequence++;
        }
    }

    protected function money(float|int|string $amount): string
    {
        return $this->fromCents($this->cents($amount));
    }

    protected function cents(float|int|string $amount): int
    {
        return (int) round(((float) $amount) * 100);
    }

    protected function fromCents(int $cents): string
    {
        return number_format($cents / 100, 2, '.', '');
    }
}

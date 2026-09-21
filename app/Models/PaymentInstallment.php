<?php

namespace App\Models;

use Database\Factories\PaymentInstallmentFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'payment_plan_id',
    'sequence',
    'kind',
    'label',
    'amount',
    'paid_amount',
    'due_on',
    'status',
    'paid_at',
    'reminded_at',
])]
#[Connection('tenant')]
class PaymentInstallment extends Model
{
    /** @use HasFactory<PaymentInstallmentFactory> */
    use HasFactory;

    public const STATUS_PENDING = 'pending';

    public const STATUS_PAID = 'paid';

    public const KIND_TOKEN = 'token';

    public const KIND_DOWN_PAYMENT = 'down_payment';

    public const KIND_INSTALLMENT = 'installment';

    public const KIND_BALLOON = 'balloon';

    public const KIND_HANDOVER = 'handover';

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    /**
     * @return BelongsTo<PaymentPlan, $this>
     */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(PaymentPlan::class, 'payment_plan_id');
    }

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'payment_plan_id' => 'integer',
            'sequence' => 'integer',
            'amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'due_on' => 'date',
            'paid_at' => 'datetime',
            'reminded_at' => 'datetime',
        ];
    }
}

<?php

namespace App\Models;

use Database\Factories\PaymentPlanFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'order_id',
    'agreed_price',
    'template',
    'down_payment',
    'handover_percent',
    'frequency',
    'installment_count',
    'late_fee_basis',
    'late_fee_rate',
])]
#[Connection('tenant')]
class PaymentPlan extends Model
{
    /** @use HasFactory<PaymentPlanFactory> */
    use HasFactory;

    /**
     * @return BelongsTo<Order, $this>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * @return HasMany<PaymentInstallment, $this>
     */
    public function installments(): HasMany
    {
        return $this->hasMany(PaymentInstallment::class)->orderBy('sequence');
    }

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'order_id' => 'integer',
            'agreed_price' => 'decimal:2',
            'down_payment' => 'decimal:2',
            'handover_percent' => 'decimal:2',
            'installment_count' => 'integer',
            'late_fee_rate' => 'decimal:4',
        ];
    }
}

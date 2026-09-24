<?php

namespace App\Models;

use Database\Factories\OrderPaymentFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'order_id',
    'payment_installment_id',
    'payment_account_id',
    'amount',
    'method',
    'reference',
    'paid_on',
    'notes',
    'receipt_asset_id',
])]
#[Connection('tenant')]
class OrderPayment extends Model
{
    /** @use HasFactory<OrderPaymentFactory> */
    use HasFactory;

    public const METHOD_BOOKING = 'booking';

    public const METHOD_PAY_ORDER = 'pay_order';

    public const METHOD_CASH = 'cash';

    public const METHOD_CHEQUE = 'cheque';

    public const METHOD_TRANSFER = 'bank_transfer';

    /**
     * Default method labels (also seeded into MetaData).
     *
     * @return list<string>
     */
    public static function methods(): array
    {
        return MetaData::defaultPaymentMethods();
    }

    /**
     * @return list<string>
     */
    public static function methodOptions(): array
    {
        MetaData::ensurePaymentMethods();

        $values = MetaData::valuesFor(MetaData::TYPE_PAYMENT_METHOD)->all();

        return $values !== [] ? $values : self::methods();
    }

    /**
     * @return BelongsTo<Order, $this>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * @return BelongsTo<PaymentInstallment, $this>
     */
    public function installment(): BelongsTo
    {
        return $this->belongsTo(PaymentInstallment::class, 'payment_installment_id');
    }

    /**
     * @return BelongsTo<PaymentAccount, $this>
     */
    public function paymentAccount(): BelongsTo
    {
        return $this->belongsTo(PaymentAccount::class);
    }

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'order_id' => 'integer',
            'payment_installment_id' => 'integer',
            'payment_account_id' => 'integer',
            'amount' => 'decimal:2',
            'paid_on' => 'date',
            'receipt_asset_id' => 'integer',
        ];
    }
}

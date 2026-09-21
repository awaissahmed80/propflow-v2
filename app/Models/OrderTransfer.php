<?php

namespace App\Models;

use Database\Factories\OrderTransferFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'order_id',
    'from_contact_id',
    'to_contact_id',
    'outstanding',
    'ndc_cleared',
    'notes',
    'transferred_at',
])]
#[Connection('tenant')]
class OrderTransfer extends Model
{
    /** @use HasFactory<OrderTransferFactory> */
    use HasFactory;

    /**
     * @return BelongsTo<Order, $this>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * @return BelongsTo<Contact, $this>
     */
    public function fromContact(): BelongsTo
    {
        return $this->belongsTo(Contact::class, 'from_contact_id');
    }

    /**
     * @return BelongsTo<Contact, $this>
     */
    public function toContact(): BelongsTo
    {
        return $this->belongsTo(Contact::class, 'to_contact_id');
    }

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'order_id' => 'integer',
            'from_contact_id' => 'integer',
            'to_contact_id' => 'integer',
            'outstanding' => 'decimal:2',
            'ndc_cleared' => 'boolean',
            'transferred_at' => 'datetime',
        ];
    }
}

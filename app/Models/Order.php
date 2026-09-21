<?php

namespace App\Models;

use App\Traits\LogUserActivity;
use Database\Factories\OrderFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'code',
    'lead_id',
    'contact_id',
    'project_id',
    'unit_id',
    'assigned_to',
    'booking_kind',
    'agreed_price',
    'status',
    'stage',
    'identity_kind',
    'identity_number',
    'overseas',
    'local_phone',
    'nominee_name',
    'nominee_relation',
    'nominee_cnic',
    'nominee_phone',
    'phase',
    'sector',
    'plot_or_file',
    'category',
    'premium',
    'discount',
    'booking_verified_at',
    'inventory_kind',
    'dimensions',
    'balloted_at',
    'handover_checklist',
    'handover_ready_at',
    'delivered_at',
    'booked_at',
    'allocated_at',
    'cancelled_at',
])]
#[Connection('tenant')]
class Order extends Model
{
    /** @use HasFactory<OrderFactory> */
    use HasFactory, LogUserActivity;

    public const KIND_TOKEN = 'token';

    public const KIND_RESERVE = 'reserve';

    public const STATUS_BOOKED = 'booked';

    public const STATUS_ALLOCATED = 'allocated';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUS_DELIVERED = 'delivered';

    public const STAGE_BOOKING = 'booking';

    public const STAGE_PLAN = 'plan';

    public const STAGE_TRACKING = 'tracking';

    public const STAGE_TRANSFER = 'transfer';

    public const STAGE_HANDOVER = 'handover';

    public const STAGE_DELIVERED = 'delivered';

    public const INVENTORY_FILE = 'file';

    public const INVENTORY_PLOT = 'plot';

    /**
     * @return list<string>
     */
    public static function activeStatuses(): array
    {
        return [
            self::STATUS_BOOKED,
            self::STATUS_ALLOCATED,
            self::STATUS_DELIVERED,
        ];
    }

    public function isBooked(): bool
    {
        return $this->status === self::STATUS_BOOKED;
    }

    public function isActive(): bool
    {
        return in_array($this->status, self::activeStatuses(), true);
    }

    public function getRouteKeyName(): string
    {
        return 'code';
    }

    /**
     * @return BelongsTo<Lead, $this>
     */
    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    /**
     * @return BelongsTo<Contact, $this>
     */
    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    /**
     * @return BelongsTo<Project, $this>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * @return BelongsTo<Unit, $this>
     */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    /**
     * @return HasOne<PaymentPlan, $this>
     */
    public function paymentPlan(): HasOne
    {
        return $this->hasOne(PaymentPlan::class);
    }

    /**
     * @return HasManyThrough<PaymentInstallment, PaymentPlan, $this>
     */
    public function installments(): HasManyThrough
    {
        return $this->hasManyThrough(PaymentInstallment::class, PaymentPlan::class);
    }

    /**
     * @return HasMany<OrderPayment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(OrderPayment::class)->latest('paid_on')->latest('id');
    }

    /**
     * @return HasMany<OrderTransfer, $this>
     */
    public function transfers(): HasMany
    {
        return $this->hasMany(OrderTransfer::class)->latest('id');
    }

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'lead_id' => 'integer',
            'contact_id' => 'integer',
            'project_id' => 'integer',
            'unit_id' => 'integer',
            'assigned_to' => 'integer',
            'agreed_price' => 'decimal:2',
            'overseas' => 'boolean',
            'premium' => 'decimal:2',
            'discount' => 'decimal:2',
            'booking_verified_at' => 'datetime',
            'balloted_at' => 'datetime',
            'handover_checklist' => 'array',
            'handover_ready_at' => 'datetime',
            'delivered_at' => 'datetime',
            'booked_at' => 'datetime',
            'allocated_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Order $order): void {
            if (filled($order->code)) {
                return;
            }

            $lastId = static::query()->max('id') ?? 0;
            $tenantId = Tenant::current()?->id ?? 0;
            $order->code = 'o'.$tenantId.date('dm').str_pad((string) ($lastId + 1), 6, '0', STR_PAD_LEFT);
        });
    }
}

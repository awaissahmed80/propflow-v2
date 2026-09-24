<?php

namespace App\Models;

use App\Support\AssetManager;
use App\Traits\LogUserActivity;
use Database\Factories\OrderFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;

#[Fillable([
    'code',
    'booking_number',
    'lead_id',
    'contact_id',
    'project_id',
    'unit_id',
    'document_folder_id',
    'assigned_to',
    'booking_kind',
    'agreed_price',
    'status',
    'stage',
    'identity_kind',
    'identity_number',
    'customer_legal_name',
    'overseas',
    'local_phone',
    'international_phone',
    'nominee_name',
    'nominee_relation',
    'nominee_identity_kind',
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

    public const STATUS_HOLD = 'hold';

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_OVERDUE = 'overdue';

    public const STATUS_DEFAULTER = 'defaulter';

    public const STATUS_LITIGATION = 'litigation';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_CANCELLED = 'cancelled';

    /** @deprecated Removed from catalog — maps to in_progress */
    public const STATUS_VERIFIED = self::STATUS_IN_PROGRESS;

    /** @deprecated Removed from catalog — maps to in_progress */
    public const STATUS_CURRENT = self::STATUS_IN_PROGRESS;

    /** @deprecated Use STATUS_HOLD */
    public const STATUS_BOOKED = self::STATUS_HOLD;

    /** @deprecated Use STATUS_IN_PROGRESS */
    public const STATUS_ALLOCATED = self::STATUS_IN_PROGRESS;

    /** @deprecated Use STATUS_COMPLETED */
    public const STATUS_DELIVERED = self::STATUS_COMPLETED;

    public const STAGE_TOKEN = 'token';

    public const STAGE_BOOKING_KYC = 'booking_kyc';

    public const STAGE_ACTIVE = 'active';

    public const STAGE_CLOSED = 'closed';

    /** @deprecated Use STAGE_TOKEN */
    public const STAGE_BOOKING = self::STAGE_TOKEN;

    /** @deprecated Use STAGE_BOOKING_KYC */
    public const STAGE_PLAN = self::STAGE_BOOKING_KYC;

    /** @deprecated Use STAGE_ACTIVE */
    public const STAGE_TRACKING = self::STAGE_ACTIVE;

    /** @deprecated Use STAGE_ACTIVE */
    public const STAGE_TRANSFER = self::STAGE_ACTIVE;

    /** @deprecated Use STAGE_ACTIVE */
    public const STAGE_HANDOVER = self::STAGE_ACTIVE;

    /** @deprecated Use STAGE_CLOSED */
    public const STAGE_DELIVERED = self::STAGE_CLOSED;

    public const INVENTORY_FILE = 'file';

    public const INVENTORY_PLOT = 'plot';

    /**
     * @return list<string>
     */
    public static function openStatuses(): array
    {
        return [
            self::STATUS_HOLD,
            self::STATUS_IN_PROGRESS,
            self::STATUS_OVERDUE,
            self::STATUS_DEFAULTER,
            self::STATUS_LITIGATION,
        ];
    }

    /**
     * Statuses staff may set manually (pipeline owns the rest).
     *
     * @return list<string>
     */
    public static function manualStatuses(): array
    {
        return [
            self::STATUS_HOLD,
            self::STATUS_IN_PROGRESS,
        ];
    }

    /**
     * Statuses driven by DealPipeline automation — not manually selectable.
     *
     * @return list<string>
     */
    public static function automatedStatuses(): array
    {
        return [
            self::STATUS_OVERDUE,
            self::STATUS_DEFAULTER,
            self::STATUS_LITIGATION,
        ];
    }

    /**
     * @return list<string>
     */
    public static function activeStatuses(): array
    {
        return self::openStatuses();
    }

    /**
     * @return list<string>
     */
    public static function stages(): array
    {
        return [
            self::STAGE_TOKEN,
            self::STAGE_BOOKING_KYC,
            self::STAGE_ACTIVE,
            self::STAGE_CLOSED,
        ];
    }

    public function isOpen(): bool
    {
        return $this->stage !== self::STAGE_CLOSED
            && ! in_array($this->status, [self::STATUS_COMPLETED, self::STATUS_CANCELLED], true);
    }

    public function isBooked(): bool
    {
        return $this->isOpen();
    }

    public function isActive(): bool
    {
        return $this->stage === self::STAGE_ACTIVE && $this->isOpen();
    }

    public function isClosed(): bool
    {
        return $this->stage === self::STAGE_CLOSED
            || in_array($this->status, [self::STATUS_COMPLETED, self::STATUS_CANCELLED], true);
    }

    /**
     * Bookings that still occupy unit inventory stock.
     *
     * @param  Builder<Order>  $query
     * @return Builder<Order>
     */
    public function scopeActiveOccupancy($query)
    {
        return $query
            ->where(function ($builder): void {
                $builder
                    ->whereNull('cancelled_at')
                    ->where('status', '!=', self::STATUS_CANCELLED);
            });
    }

    /**
     * @return MorphMany<Task, $this>
     */
    public function activities(): MorphMany
    {
        return $this->morphMany(Task::class, 'taskable')->latest('id');
    }

    /**
     * @return MorphMany<Task, $this>
     */
    public function tasks(): MorphMany
    {
        return $this->morphMany(Task::class, 'taskable');
    }

    /**
     * @return MorphMany<AssetLink, $this>
     */
    public function documents(): MorphMany
    {
        return $this->morphMany(AssetLink::class, 'assetable')
            ->where('linkage', AssetManager::LINKAGE_DOCUMENT);
    }

    /**
     * Pre-handover stages where sales agents remain the customer liaison.
     *
     * @return list<string>
     */
    public static function liaisonStages(): array
    {
        return [
            self::STAGE_TOKEN,
            self::STAGE_BOOKING_KYC,
            self::STAGE_ACTIVE,
        ];
    }

    public function isLiaisonActive(): bool
    {
        $stage = $this->stage ?: self::STAGE_TOKEN;

        return in_array($stage, self::liaisonStages(), true)
            && $this->status !== self::STATUS_CANCELLED
            && ! $this->isClosed();
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
     * @return BelongsTo<AssetFolder, $this>
     */
    public function documentFolder(): BelongsTo
    {
        return $this->belongsTo(AssetFolder::class, 'document_folder_id');
    }

    /**
     * Ensure this booking has a dedicated top-level document library folder.
     */
    public function ensureDocumentFolder(): AssetFolder
    {
        if ($this->document_folder_id) {
            $existing = AssetFolder::query()->find($this->document_folder_id);

            if ($existing !== null) {
                return $existing;
            }
        }

        $this->loadMissing(['contact', 'unit']);

        $folder = AssetFolder::query()->create([
            'name' => $this->documentFolderName(),
            'kind' => AssetManager::KIND_DOCUMENT,
            'parent_id' => null,
            'order' => ((int) AssetFolder::query()
                ->where('kind', AssetManager::KIND_DOCUMENT)
                ->whereNull('parent_id')
                ->max('order')) + 1,
        ]);

        $this->forceFill(['document_folder_id' => $folder->id])->save();

        return $folder;
    }

    protected function documentFolderName(): string
    {
        $contact = $this->contact
            ? trim(implode(' ', array_filter([
                $this->contact->first_name,
                $this->contact->last_name,
            ])))
            : '';
        $unit = $this->unit?->name;

        if ($contact !== '' && filled($unit)) {
            return $contact.' · '.$unit;
        }

        if ($contact !== '') {
            return $contact;
        }

        if (filled($unit)) {
            return 'Booking · '.$unit;
        }

        return 'Booking documents';
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
            'document_folder_id' => 'integer',
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

<?php

namespace App\Models;

use App\Traits\LogUserActivity;
use Database\Factories\UnitFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use InvalidArgumentException;

#[Fillable([
    'name',
    'code',
    'description',
    'type',
    'sector',
    'price',
    'size',
    'area_type',
    'features',
    'pricing',
    'quantity',
    'status',
    'project_id',
    'project_block_id',
])]
#[Connection('tenant')]
class Unit extends Model
{
    /** @use HasFactory<UnitFactory> */
    use HasFactory, LogUserActivity, SoftDeletes;

    public const STATUS_AVAILABLE = 'AVAILABLE';

    public const STATUS_SOLD = 'SOLD';

    public const STATUS_RESERVED = 'RESERVED';

    public const STATUS_TOKEN = 'TOKEN';

    public const STATUS_HOLD = 'HOLD';

    public const STATUS_INACTIVE = 'INACTIVE';

    /**
     * @return list<string>
     */
    public static function statuses(): array
    {
        return [
            self::STATUS_AVAILABLE,
            self::STATUS_RESERVED,
            self::STATUS_TOKEN,
            self::STATUS_HOLD,
            self::STATUS_SOLD,
            self::STATUS_INACTIVE,
        ];
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'size' => 'decimal:2',
            'quantity' => 'integer',
            'features' => 'array',
            'pricing' => 'array',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'code';
    }

    /**
     * Remaining sellable stock for this inventory row.
     */
    public function stock(): int
    {
        return max(0, (int) ($this->quantity ?? 1));
    }

    public function isBookable(): bool
    {
        return in_array($this->status, [self::STATUS_AVAILABLE, self::STATUS_HOLD], true)
            && $this->stock() > 0;
    }

    /**
     * Reserve a unique (qty 1) unit. Multi-quantity rows stay available for other bookings.
     */
    public function reserveForBooking(string $status): void
    {
        if (! in_array($status, [self::STATUS_RESERVED, self::STATUS_TOKEN], true)) {
            throw new InvalidArgumentException('Booking reservation status must be RESERVED or TOKEN.');
        }

        if ($this->stock() <= 1) {
            $this->forceFill(['status' => $status])->save();
        }
    }

    /**
     * Deduct one unit of stock when a booking is sold/allocated.
     * Marks the row sold when stock reaches zero.
     */
    public function consumeForSale(int $count = 1): void
    {
        $count = max(1, $count);
        $remaining = max(0, $this->stock() - $count);

        $this->forceFill([
            'quantity' => $remaining,
            'status' => $remaining === 0 ? self::STATUS_SOLD : self::STATUS_AVAILABLE,
        ])->save();
    }

    /**
     * Release a unique reserved/token unit back to availability.
     */
    public function releaseFromBooking(): void
    {
        if (! in_array($this->status, [self::STATUS_RESERVED, self::STATUS_TOKEN], true)) {
            return;
        }

        $this->forceFill([
            'status' => self::STATUS_AVAILABLE,
            'quantity' => max(1, $this->stock()),
        ])->save();
    }

    public static function boot(): void
    {
        parent::boot();

        static::creating(function (Unit $model): void {
            if (filled($model->code)) {
                return;
            }

            $lastId = static::withTrashed()->max('id') ?? 0;
            $numberPart = str_pad((string) ($lastId + 1), 4, '0', STR_PAD_LEFT);
            $tenantId = optional(Tenant::current())->id
                ?? Tenant::query()->latest('id')->value('id')
                ?? 0;

            $model->code = 'u'.$tenantId.$numberPart;
        });
    }

    /**
     * @return BelongsTo<Project, $this>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * @return BelongsTo<ProjectBlock, $this>
     */
    public function block(): BelongsTo
    {
        return $this->belongsTo(ProjectBlock::class, 'project_block_id');
    }
}

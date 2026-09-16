<?php

namespace App\Models;

use Database\Factories\UnitFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

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
    use HasFactory, SoftDeletes;

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

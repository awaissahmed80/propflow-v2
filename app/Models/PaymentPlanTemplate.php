<?php

namespace App\Models;

use Database\Factories\PaymentPlanTemplateFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'title',
    'project_id',
    'frequency',
    'installment_count',
    'balloon_every',
    'down_payment_percent',
    'handover_percent',
    'late_fee_basis',
    'late_fee_rate',
    'is_system',
    'is_enabled',
])]
#[Connection('tenant')]
class PaymentPlanTemplate extends Model
{
    /** @use HasFactory<PaymentPlanTemplateFactory> */
    use HasFactory;

    /**
     * @return BelongsTo<Project, $this>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeEnabled(Builder $query): Builder
    {
        return $query->where('is_enabled', true);
    }

    /**
     * @return list<array{
     *     title: string,
     *     project_id: null,
     *     frequency: string,
     *     installment_count: int,
     *     balloon_every: ?int,
     *     down_payment_percent: float,
     *     handover_percent: float,
     *     late_fee_basis: ?string,
     *     late_fee_rate: ?float,
     *     is_system: bool,
     *     is_enabled: bool
     * }>
     */
    public static function defaultDefinitions(): array
    {
        return [
            [
                'title' => '3-year quarterly',
                'project_id' => null,
                'frequency' => 'quarterly',
                'installment_count' => 12,
                'balloon_every' => null,
                'down_payment_percent' => 10,
                'handover_percent' => 10,
                'late_fee_basis' => 'monthly',
                'late_fee_rate' => 1,
                'is_system' => true,
                'is_enabled' => true,
            ],
            [
                'title' => '4-year monthly with semi-annual balloons',
                'project_id' => null,
                'frequency' => 'monthly',
                'installment_count' => 48,
                'balloon_every' => 6,
                'down_payment_percent' => 10,
                'handover_percent' => 10,
                'late_fee_basis' => 'monthly',
                'late_fee_rate' => 1,
                'is_system' => true,
                'is_enabled' => true,
            ],
        ];
    }

    public static function ensureDefaults(): void
    {
        if (static::query()->exists()) {
            return;
        }

        foreach (static::defaultDefinitions() as $definition) {
            static::query()->create($definition);
        }
    }

    /**
     * @return array{id: int, title: string, frequency: string, count: int, balloon_every: ?int, down_payment_percent: float, handover_percent: float, late_fee_basis: ?string, late_fee_rate: ?float, project_id: ?int}
     */
    public function toScheduleOption(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'label' => $this->title,
            'frequency' => $this->frequency,
            'count' => (int) $this->installment_count,
            'balloon_every' => $this->balloon_every !== null ? (int) $this->balloon_every : null,
            'down_payment_percent' => (float) $this->down_payment_percent,
            'handover_percent' => (float) $this->handover_percent,
            'late_fee_basis' => $this->late_fee_basis,
            'late_fee_rate' => $this->late_fee_rate !== null ? (float) $this->late_fee_rate : null,
            'project_id' => $this->project_id,
        ];
    }

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'project_id' => 'integer',
            'installment_count' => 'integer',
            'balloon_every' => 'integer',
            'down_payment_percent' => 'decimal:2',
            'handover_percent' => 'decimal:2',
            'late_fee_rate' => 'decimal:4',
            'is_system' => 'boolean',
            'is_enabled' => 'boolean',
        ];
    }
}

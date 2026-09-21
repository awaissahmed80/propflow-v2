<?php

namespace App\Models;

use App\Traits\LogUserActivity;
use Database\Factories\OrderStatusFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['stage_label', 'label', 'title', 'priority', 'color', 'is_system', 'is_enabled'])]
#[Connection('tenant')]
#[Table(timestamps: false)]
class OrderStatus extends Model
{
    /** @use HasFactory<OrderStatusFactory> */
    use HasFactory, LogUserActivity;

    public function getRouteKeyName(): string
    {
        return 'id';
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
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeForStage(Builder $query, string $stageLabel): Builder
    {
        return $query->where('stage_label', $stageLabel);
    }

    /**
     * @return list<array{stage_label: string, label: string, title: string, priority: int, color: string, is_system: bool, is_enabled: bool}>
     */
    public static function defaultDefinitions(): array
    {
        return [
            ['stage_label' => Order::STAGE_TOKEN, 'label' => Order::STATUS_HOLD, 'title' => 'Hold', 'priority' => 1, 'color' => '#94A3B8', 'is_system' => true, 'is_enabled' => true],
            ['stage_label' => Order::STAGE_TOKEN, 'label' => Order::STATUS_VERIFIED, 'title' => 'Verified', 'priority' => 2, 'color' => '#3B82F6', 'is_system' => true, 'is_enabled' => true],
            ['stage_label' => Order::STAGE_BOOKING_KYC, 'label' => Order::STATUS_IN_PROGRESS, 'title' => 'In progress', 'priority' => 1, 'color' => '#8B5CF6', 'is_system' => true, 'is_enabled' => true],
            ['stage_label' => Order::STAGE_ACTIVE, 'label' => Order::STATUS_CURRENT, 'title' => 'Current', 'priority' => 1, 'color' => '#06B6D4', 'is_system' => true, 'is_enabled' => true],
            ['stage_label' => Order::STAGE_ACTIVE, 'label' => Order::STATUS_OVERDUE, 'title' => 'Overdue', 'priority' => 2, 'color' => '#F59E0B', 'is_system' => true, 'is_enabled' => true],
            ['stage_label' => Order::STAGE_ACTIVE, 'label' => Order::STATUS_DEFAULTER, 'title' => 'Defaulter', 'priority' => 3, 'color' => '#EF4444', 'is_system' => true, 'is_enabled' => true],
            ['stage_label' => Order::STAGE_ACTIVE, 'label' => Order::STATUS_LITIGATION, 'title' => 'Litigation', 'priority' => 4, 'color' => '#DC2626', 'is_system' => true, 'is_enabled' => true],
            ['stage_label' => Order::STAGE_CLOSED, 'label' => Order::STATUS_COMPLETED, 'title' => 'Completed', 'priority' => 1, 'color' => '#059669', 'is_system' => true, 'is_enabled' => true],
            ['stage_label' => Order::STAGE_CLOSED, 'label' => Order::STATUS_CANCELLED, 'title' => 'Cancelled', 'priority' => 2, 'color' => '#64748B', 'is_system' => true, 'is_enabled' => true],
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
     * @return list<array{id: int, stage_label: string, label: string, title: string, priority: int, color: ?string, is_system: bool, is_enabled: bool}>
     */
    public static function catalog(?string $stageLabel = null, bool $enabledOnly = true): array
    {
        static::ensureDefaults();

        $query = static::query()->orderBy('stage_label')->orderBy('priority');

        if ($stageLabel !== null) {
            $query->forStage($stageLabel);
        }

        if ($enabledOnly) {
            $query->enabled();
        }

        return $query
            ->get(['id', 'stage_label', 'label', 'title', 'priority', 'color', 'is_system', 'is_enabled'])
            ->map(fn (self $status): array => [
                'id' => $status->id,
                'stage_label' => (string) $status->stage_label,
                'label' => (string) $status->label,
                'title' => (string) $status->title,
                'priority' => (int) $status->priority,
                'color' => $status->color,
                'is_system' => (bool) $status->is_system,
                'is_enabled' => (bool) $status->is_enabled,
            ])
            ->values()
            ->all();
    }

    public static function titleFor(?string $label, ?string $fallback = null): string
    {
        if ($label === null || $label === '') {
            return $fallback ?? 'Hold';
        }

        static::ensureDefaults();

        $title = static::query()->where('label', $label)->value('title');

        if (is_string($title) && $title !== '') {
            return $title;
        }

        foreach (static::defaultDefinitions() as $definition) {
            if ($definition['label'] === $label) {
                return $definition['title'];
            }
        }

        return $fallback ?? $label;
    }

    protected function casts(): array
    {
        return [
            'priority' => 'integer',
            'is_system' => 'boolean',
            'is_enabled' => 'boolean',
        ];
    }
}

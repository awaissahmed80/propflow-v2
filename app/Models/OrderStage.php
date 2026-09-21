<?php

namespace App\Models;

use App\Traits\LogUserActivity;
use Database\Factories\OrderStageFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['label', 'title', 'priority', 'color', 'is_system', 'is_enabled'])]
#[Connection('tenant')]
#[Table(timestamps: false)]
class OrderStage extends Model
{
    /** @use HasFactory<OrderStageFactory> */
    use HasFactory, LogUserActivity;

    public function getRouteKeyName(): string
    {
        return 'label';
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
     * @return list<array{label: string, title: string, priority: int, color: string, is_system: bool, is_enabled: bool}>
     */
    public static function defaultDefinitions(): array
    {
        return [
            ['label' => Order::STAGE_BOOKING, 'title' => 'Booking & KYC', 'priority' => 1, 'color' => '#3B82F6', 'is_system' => true, 'is_enabled' => true],
            ['label' => Order::STAGE_PLAN, 'title' => 'Payment plan', 'priority' => 2, 'color' => '#8B5CF6', 'is_system' => true, 'is_enabled' => true],
            ['label' => Order::STAGE_TRACKING, 'title' => 'Installments', 'priority' => 3, 'color' => '#06B6D4', 'is_system' => true, 'is_enabled' => true],
            ['label' => Order::STAGE_TRANSFER, 'title' => 'Balloting', 'priority' => 4, 'color' => '#F59E0B', 'is_system' => true, 'is_enabled' => true],
            ['label' => Order::STAGE_HANDOVER, 'title' => 'Handover', 'priority' => 5, 'color' => '#F97316', 'is_system' => true, 'is_enabled' => true],
            ['label' => Order::STAGE_DELIVERED, 'title' => 'Delivered', 'priority' => 6, 'color' => '#059669', 'is_system' => true, 'is_enabled' => true],
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
     * @return list<array{id: int, label: string, title: string, priority: int, color: ?string, is_system: bool, is_enabled: bool}>
     */
    public static function catalog(bool $enabledOnly = true): array
    {
        static::ensureDefaults();

        $query = static::query()->orderBy('priority');

        if ($enabledOnly) {
            $query->enabled();
        }

        return $query
            ->get(['id', 'label', 'title', 'priority', 'color', 'is_system', 'is_enabled'])
            ->map(fn (self $stage): array => [
                'id' => $stage->id,
                'label' => (string) $stage->label,
                'title' => (string) $stage->title,
                'priority' => (int) $stage->priority,
                'color' => $stage->color,
                'is_system' => (bool) $stage->is_system,
                'is_enabled' => (bool) $stage->is_enabled,
            ])
            ->values()
            ->all();
    }

    public static function titleFor(?string $label, ?string $fallback = null): string
    {
        if ($label === null || $label === '') {
            return $fallback ?? 'Booking & KYC';
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

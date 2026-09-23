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

#[Fillable(['label', 'title', 'priority', 'color', 'is_system', 'is_enabled'])]
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
     * @return list<array{label: string, title: string, priority: int, color: string, is_system: bool, is_enabled: bool}>
     */
    public static function defaultDefinitions(): array
    {
        return [
            ['label' => Order::STATUS_HOLD, 'title' => 'Hold', 'priority' => 1, 'color' => '#94A3B8', 'is_system' => true, 'is_enabled' => true],
            ['label' => Order::STATUS_IN_PROGRESS, 'title' => 'In progress', 'priority' => 2, 'color' => '#EA580C', 'is_system' => true, 'is_enabled' => true],
            ['label' => Order::STATUS_OVERDUE, 'title' => 'Overdue', 'priority' => 3, 'color' => '#D97706', 'is_system' => true, 'is_enabled' => true],
            ['label' => Order::STATUS_DEFAULTER, 'title' => 'Defaulter', 'priority' => 4, 'color' => '#E11D48', 'is_system' => true, 'is_enabled' => true],
            ['label' => Order::STATUS_LITIGATION, 'title' => 'Litigation', 'priority' => 5, 'color' => '#BE123C', 'is_system' => true, 'is_enabled' => true],
            ['label' => Order::STATUS_COMPLETED, 'title' => 'Completed', 'priority' => 6, 'color' => '#16A34A', 'is_system' => true, 'is_enabled' => true],
            ['label' => Order::STATUS_CANCELLED, 'title' => 'Cancelled', 'priority' => 7, 'color' => '#6B7280', 'is_system' => true, 'is_enabled' => true],
        ];
    }

    /**
     * @return list<string>
     */
    public static function obsoleteLabels(): array
    {
        return ['verified', 'current'];
    }

    public static function ensureDefaults(): void
    {
        if (static::query()->whereIn('label', static::obsoleteLabels())->exists()) {
            Order::query()
                ->whereIn('status', static::obsoleteLabels())
                ->update(['status' => Order::STATUS_IN_PROGRESS]);

            static::query()->whereIn('label', static::obsoleteLabels())->delete();
        }

        $defaults = collect(static::defaultDefinitions())->keyBy('label');
        $existing = static::query()->get()->keyBy('label');

        foreach ($defaults as $label => $definition) {
            if ($existing->has($label)) {
                continue;
            }

            static::query()->create($definition);
        }

        foreach ($defaults as $label => $definition) {
            static::query()->where('label', $label)->update([
                'priority' => $definition['priority'],
                'is_system' => true,
                'is_enabled' => true,
            ]);
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
            ->map(fn (self $status): array => [
                'id' => $status->id,
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

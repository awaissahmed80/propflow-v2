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
            ['label' => Order::STAGE_TOKEN, 'title' => 'Token', 'priority' => 1, 'color' => '#3B82F6', 'is_system' => true, 'is_enabled' => true],
            ['label' => Order::STAGE_BOOKING_KYC, 'title' => 'Booking & KYC', 'priority' => 2, 'color' => '#8B5CF6', 'is_system' => true, 'is_enabled' => true],
            ['label' => Order::STAGE_ACTIVE, 'title' => 'Active', 'priority' => 3, 'color' => '#06B6D4', 'is_system' => true, 'is_enabled' => true],
            ['label' => Order::STAGE_CLOSED, 'title' => 'Closed', 'priority' => 4, 'color' => '#059669', 'is_system' => true, 'is_enabled' => true],
        ];
    }

    public static function ensureDefaults(): void
    {
        OrderStatus::ensureDefaults();

        $defaults = collect(static::defaultDefinitions())->keyBy('label');
        $existing = static::query()->get()->keyBy('label');

        foreach ($defaults as $label => $definition) {
            if ($existing->has($label)) {
                continue;
            }

            static::query()->create($definition);
        }

        // Drop legacy non-system or obsolete stage keys that are not in the fixed catalog.
        static::query()
            ->whereNotIn('label', $defaults->keys()->all())
            ->delete();

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
            return $fallback ?? 'Token';
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

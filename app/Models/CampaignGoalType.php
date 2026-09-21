<?php

namespace App\Models;

use App\Traits\LogUserActivity;
use Database\Factories\CampaignGoalTypeFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['label', 'title', 'priority', 'color'])]
#[Connection('tenant')]
#[Table(timestamps: false)]
class CampaignGoalType extends Model
{
    /** @use HasFactory<CampaignGoalTypeFactory> */
    use HasFactory, LogUserActivity;

    public function getRouteKeyName(): string
    {
        return 'label';
    }

    /**
     * @return list<array{label: string, title: string, priority: int, color: string}>
     */
    public static function defaultDefinitions(): array
    {
        return [
            ['label' => 'total_leads', 'title' => 'Total Leads', 'priority' => 1, 'color' => '#3B82F6'],
            ['label' => 'qualified_leads', 'title' => 'Qualified Leads', 'priority' => 2, 'color' => '#06B6D4'],
            ['label' => 'engagement', 'title' => 'Engagement', 'priority' => 3, 'color' => '#F59E0B'],
            ['label' => 'closed_deals', 'title' => 'Closed Deals', 'priority' => 4, 'color' => '#059669'],
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
     * @return list<array{id: int, label: string, title: string, priority: int, color: ?string}>
     */
    public static function catalog(): array
    {
        static::ensureDefaults();

        return static::query()
            ->orderBy('priority')
            ->get(['id', 'label', 'title', 'priority', 'color'])
            ->map(fn (self $goal): array => [
                'id' => $goal->id,
                'label' => $goal->label,
                'title' => $goal->title,
                'priority' => $goal->priority,
                'color' => $goal->color,
            ])
            ->values()
            ->all();
    }
}

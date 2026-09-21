<?php

namespace App\Models;

use App\Traits\LogUserActivity;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['label', 'title', 'priority', 'color', 'is_system', 'is_enabled'])]
#[Connection('tenant')]
#[Table(timestamps: false)]
class LeadStage extends Model
{
    use HasFactory, LogUserActivity;

    public const LABEL_NEW = 'new';

    public function getRouteKeyName(): string
    {
        return 'label';
    }

    public function leads()
    {
        return $this->hasMany(Lead::class);
    }

    public function activeLeads()
    {
        return $this->hasMany(Lead::class)->whereNull('archived_at');
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
            ['label' => 'new', 'title' => 'New', 'priority' => 1, 'color' => '#3B82F6', 'is_system' => true, 'is_enabled' => true],
            ['label' => 'contacted', 'title' => 'Contacted', 'priority' => 2, 'color' => '#8B5CF6', 'is_system' => true, 'is_enabled' => true],
            ['label' => 'qualified', 'title' => 'Qualified', 'priority' => 3, 'color' => '#06B6D4', 'is_system' => true, 'is_enabled' => true],
            ['label' => 'site_visit', 'title' => 'Site Visit', 'priority' => 4, 'color' => '#F59E0B', 'is_system' => true, 'is_enabled' => true],
            ['label' => 'negotiation', 'title' => 'Negotiation', 'priority' => 5, 'color' => '#F97316', 'is_system' => true, 'is_enabled' => true],
            ['label' => 'closed_won', 'title' => 'Closed Won', 'priority' => 6, 'color' => '#059669', 'is_system' => true, 'is_enabled' => true],
            ['label' => 'closed_lost', 'title' => 'Closed Lost', 'priority' => 7, 'color' => '#EF4444', 'is_system' => true, 'is_enabled' => true],
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

    public static function defaultStageId(): ?int
    {
        return static::query()->enabled()->where('label', self::LABEL_NEW)->value('id')
            ?? static::query()->enabled()->orderBy('priority')->value('id')
            ?? static::query()->where('label', self::LABEL_NEW)->value('id')
            ?? static::query()->orderBy('priority')->value('id');
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

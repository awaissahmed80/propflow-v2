<?php

namespace App\Models;

use App\Traits\LogUserActivity;
use Database\Factories\LeadActionTypeFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['kind', 'label', 'title', 'priority', 'icon', 'color', 'is_system', 'is_enabled'])]
#[Connection('tenant')]
#[Table(timestamps: false)]
class LeadActionType extends Model
{
    /** @use HasFactory<LeadActionTypeFactory> */
    use HasFactory, LogUserActivity;

    public const KIND_ACTIVITY = 'activity';

    public const KIND_NEXT_ACTION = 'next_action';

    public const LABEL_DO_NOTHING = 'do_nothing';

    public const DEFAULT_COLOR = '#64B5F6';

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeOfKind(Builder $query, string $kind): Builder
    {
        return $query->where('kind', $kind);
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
     * @return list<array{label: string, title: string, priority: int, icon: ?string, color: string, is_system: bool, is_enabled: bool}>
     */
    public static function defaultDefinitions(string $kind): array
    {
        if ($kind === self::KIND_ACTIVITY) {
            return [
                ['label' => 'call', 'title' => 'Call', 'priority' => 1, 'icon' => 'phone-line', 'color' => '#64B5F6', 'is_system' => true, 'is_enabled' => true],
                ['label' => 'meeting', 'title' => 'Meeting', 'priority' => 2, 'icon' => 'team-line', 'color' => '#FFB74D', 'is_system' => true, 'is_enabled' => true],
                ['label' => 'site_visit', 'title' => 'Site Visit', 'priority' => 3, 'icon' => 'map-pin-line', 'color' => '#9575CD', 'is_system' => true, 'is_enabled' => true],
                ['label' => 'email', 'title' => 'Email', 'priority' => 4, 'icon' => 'mail-line', 'color' => '#F06292', 'is_system' => true, 'is_enabled' => true],
                ['label' => 'message', 'title' => 'Message', 'priority' => 5, 'icon' => 'chat-1-line', 'color' => '#0284C7', 'is_system' => true, 'is_enabled' => true],
                ['label' => 'whatsapp_call', 'title' => 'WhatsApp Call', 'priority' => 6, 'icon' => 'whatsapp-line', 'color' => '#16A34A', 'is_system' => true, 'is_enabled' => true],
                ['label' => 'whatsapp_message', 'title' => 'WhatsApp Message', 'priority' => 7, 'icon' => 'whatsapp-line', 'color' => '#0D9488', 'is_system' => true, 'is_enabled' => true],
                ['label' => 'note', 'title' => 'Note', 'priority' => 8, 'icon' => 'sticky-note-line', 'color' => '#64748B', 'is_system' => true, 'is_enabled' => true],
            ];
        }

        return [
            ['label' => 'follow_up', 'title' => 'Follow-up', 'priority' => 1, 'icon' => 'calendar-check-line', 'color' => '#16A34A', 'is_system' => true, 'is_enabled' => true],
            ['label' => 'arrange_site_visit', 'title' => 'Arrange Site Visit', 'priority' => 2, 'icon' => 'map-pin-line', 'color' => '#FF8A65', 'is_system' => true, 'is_enabled' => true],
            ['label' => 'arrange_meeting', 'title' => 'Arrange Meeting', 'priority' => 3, 'icon' => 'team-line', 'color' => '#0284C7', 'is_system' => true, 'is_enabled' => true],
            ['label' => self::LABEL_DO_NOTHING, 'title' => 'Do Nothing', 'priority' => 4, 'icon' => 'close-circle-line', 'color' => '#FFB74D', 'is_system' => true, 'is_enabled' => true],
        ];
    }

    public static function ensureDefaults(?string $kind = null): void
    {
        $kinds = $kind === null
            ? [self::KIND_ACTIVITY, self::KIND_NEXT_ACTION]
            : [$kind];

        foreach ($kinds as $targetKind) {
            if (static::query()->ofKind($targetKind)->exists()) {
                continue;
            }

            foreach (static::defaultDefinitions($targetKind) as $definition) {
                static::query()->create([
                    ...$definition,
                    'kind' => $targetKind,
                ]);
            }
        }
    }

    /**
     * @return list<array{id: int, kind: string, label: string, title: string, priority: int, icon: ?string, color: ?string, is_system: bool, is_enabled: bool}>
     */
    public static function catalog(string $kind, bool $enabledOnly = false): array
    {
        static::ensureDefaults($kind);

        $query = static::query()
            ->ofKind($kind)
            ->orderBy('priority');

        if ($enabledOnly) {
            $query->enabled();
        }

        return $query
            ->get(['id', 'kind', 'label', 'title', 'priority', 'icon', 'color', 'is_system', 'is_enabled'])
            ->map(fn (self $row): array => [
                'id' => $row->id,
                'kind' => $row->kind,
                'label' => $row->label,
                'title' => $row->title,
                'priority' => $row->priority,
                'icon' => $row->icon,
                'color' => $row->color ?: self::DEFAULT_COLOR,
                'is_system' => (bool) $row->is_system,
                'is_enabled' => (bool) $row->is_enabled,
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<string>
     */
    public static function titles(string $kind): array
    {
        return array_values(array_map(
            fn (array $row): string => $row['title'],
            static::catalog($kind, enabledOnly: true),
        ));
    }

    public static function doNothingTitle(): string
    {
        static::ensureDefaults(self::KIND_NEXT_ACTION);

        $title = static::query()
            ->ofKind(self::KIND_NEXT_ACTION)
            ->where('label', self::LABEL_DO_NOTHING)
            ->value('title');

        return is_string($title) && $title !== '' ? $title : 'Do Nothing';
    }

    public static function isDoNothing(?string $title): bool
    {
        if ($title === null || $title === '') {
            return false;
        }

        return $title === static::doNothingTitle();
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

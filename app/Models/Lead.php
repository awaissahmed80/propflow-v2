<?php

namespace App\Models;

use App\Services\LeadActivity;
use App\Traits\LogUserActivity;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

#[Fillable([
    'code',
    'contact_id',
    'user_id',
    'project_id',
    'unit_id',
    'campaign_id',
    'assigned_to',
    'source',
    'score',
    'next_action',
    'due_date',
    'lead_stage_id',
    'tag',
    'budget',
    'contacted_at',
    'archived_at',
    'attributes',
    'notes',
    'group',
])]
#[Connection('tenant')]
class Lead extends Model
{
    use HasFactory, LogUserActivity, SoftDeletes;

    public const TAG_VERY_HOT = 'VERY HOT';

    public const TAG_HOT = 'HOT';

    public const TAG_MODERATE = 'MODERATE';

    public const TAG_COLD = 'COLD';

    public const TAG_VERY_COLD = 'VERY COLD';

    public const NEXT_ACTION_FOLLOW_UP = 'Follow-up';

    public const NEXT_ACTION_ARRANGE_SITE_VISIT = 'Arrange Site Visit';

    public const NEXT_ACTION_ARRANGE_MEETING = 'Arrange Meeting';

    public const NEXT_ACTION_DO_NOTHING = 'Do Nothing';

    /**
     * @return list<string>
     */
    public static function tags(): array
    {
        return [
            self::TAG_VERY_HOT,
            self::TAG_HOT,
            self::TAG_MODERATE,
            self::TAG_COLD,
            self::TAG_VERY_COLD,
        ];
    }

    /**
     * @return list<string>
     */
    public static function nextActions(): array
    {
        return LeadActionType::titles(LeadActionType::KIND_NEXT_ACTION);
    }

    public static function doNothingNextAction(): string
    {
        return LeadActionType::doNothingTitle();
    }

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'contact_id' => 'integer',
            'user_id' => 'integer',
            'project_id' => 'integer',
            'unit_id' => 'integer',
            'campaign_id' => 'integer',
            'assigned_to' => 'integer',
            'lead_stage_id' => 'integer',
            'attributes' => 'array',
            'budget' => 'decimal:2',
            'due_date' => 'datetime',
            'contacted_at' => 'datetime',
            'archived_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'code';
    }

    public static function boot(): void
    {
        parent::boot();

        static::creating(function (Lead $model): void {
            if (filled($model->code)) {
                return;
            }

            $lastId = static::withTrashed()->max('id') ?? 0;
            $datePart = date('dm');
            $numberPart = str_pad((string) ($lastId + 1), 6, '0', STR_PAD_LEFT);
            $tenantId = Tenant::current()?->id
                ?? Tenant::query()->latest('id')->value('id')
                ?? 0;
            $model->code = 'l'.$tenantId.$datePart.$numberPart;
        });

        static::created(function (Lead $lead): void {
            app(LeadActivity::class)->created($lead);
        });
    }

    /**
     * @param  Builder<Lead>  $query
     * @return Builder<Lead>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('archived_at');
    }

    /**
     * @param  Builder<Lead>  $query
     * @return Builder<Lead>
     */
    public function scopeArchived(Builder $query): Builder
    {
        return $query->whereNotNull('archived_at');
    }

    public function isArchived(): bool
    {
        return $this->archived_at !== null;
    }

    public function archive(?Carbon $at = null): void
    {
        $this->forceFill([
            'archived_at' => $at ?? now(),
        ])->save();
    }

    public function restoreFromArchive(?int $fallbackStageId = null): void
    {
        if ($this->lead_stage_id === null && $fallbackStageId !== null) {
            $this->lead_stage_id = $fallbackStageId;
        }

        $this->forceFill([
            'archived_at' => null,
        ])->save();
    }

    /**
     * @return BelongsTo<LeadStage, $this>
     */
    public function stage(): BelongsTo
    {
        return $this->belongsTo(LeadStage::class, 'lead_stage_id');
    }

    /**
     * @return BelongsTo<Project, $this>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * @return BelongsTo<Unit, $this>
     */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    /**
     * @return BelongsTo<Contact, $this>
     */
    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    /**
     * @return HasMany<Order, $this>
     */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    /**
     * @return HasOne<Order, $this>
     */
    public function activeOrder(): HasOne
    {
        return $this->hasOne(Order::class)->ofMany(
            ['id' => 'max'],
            function ($query): void {
                $query->whereIn('status', Order::activeStatuses());
            },
        );
    }

    public function hasActiveDeal(): bool
    {
        if ($this->relationLoaded('activeOrder')) {
            return $this->activeOrder !== null;
        }

        return $this->activeOrder()->exists();
    }

    /**
     * @return MorphMany<Task, $this>
     */
    public function tasks(): MorphMany
    {
        return $this->morphMany(Task::class, 'taskable');
    }

    /**
     * @return BelongsTo<Campaign, $this>
     */
    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }
}

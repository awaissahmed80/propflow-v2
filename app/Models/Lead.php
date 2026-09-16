<?php

namespace App\Models;

use App\Traits\LogUserActivity;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

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
        ];
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
     * @return HasMany<Task, $this>
     */
    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }

    /**
     * @return BelongsTo<Campaign, $this>
     */
    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }
}

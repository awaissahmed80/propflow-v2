<?php

namespace App\Models;

use App\Support\AssetManager;
use App\Traits\LogUserActivity;
use Database\Factories\TaskFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'user_id',
    'taskable_type',
    'taskable_id',
    'stage',
    'stage_label',
    'action',
    'comments',
    'status',
    'type',
])]
#[Connection('tenant')]
class Task extends Model
{
    /** @use HasFactory<TaskFactory> */
    use HasFactory, LogUserActivity, SoftDeletes;

    /**
     * User-submitted activity (composer updates, scheduled next actions).
     * Always written with a human actor when available.
     */
    public const TYPE_ACTION = 'ACTION';

    /**
     * System / lifecycle event (stage change, payment recorded, booking created, etc.).
     */
    public const TYPE_LOG = 'LOG';

    public const TYPE_ATTACHMENT = 'ATTACHMENT';

    public const STATUS_IN_PROGRESS = 'IN-PROGRESS';

    public const STATUS_PENDING = 'PENDING';

    public const STATUS_COMPLETED = 'COMPLETED';

    public const STATUS_CANCELLED = 'CANCELLED';

    public function isUserAction(): bool
    {
        return $this->type === self::TYPE_ACTION;
    }

    public function isSystemLog(): bool
    {
        return $this->type === self::TYPE_LOG;
    }

    /**
     * @return list<string>
     */
    public static function activityTypes(): array
    {
        return LeadActionType::titles(LeadActionType::KIND_ACTIVITY);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return MorphTo<Model, $this>
     */
    public function taskable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * @return MorphMany<AssetLink, $this>
     */
    public function gallery(): MorphMany
    {
        return $this->morphMany(AssetLink::class, 'assetable')
            ->where('linkage', AssetManager::LINKAGE_GALLERY);
    }

    /**
     * @return MorphMany<AssetLink, $this>
     */
    public function documents(): MorphMany
    {
        return $this->morphMany(AssetLink::class, 'assetable')
            ->where('linkage', AssetManager::LINKAGE_DOCUMENT);
    }
}

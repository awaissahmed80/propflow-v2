<?php

namespace App\Models;

use App\Support\AssetManager;
use App\Traits\LogUserActivity;
use Database\Factories\CampaignFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Support\Str;

#[Fillable([
    'public_id',
    'slug',
    'title',
    'description',
    'purpose',
    'source_type',
    'source_config',
    'owner_id',
    'channel',
    'budget',
    'target_cpl',
    'tags',
    'utm',
    'default_assignee_id',
    'default_lead_stage_id',
    'status',
    'project_id',
    'campaign_form_id',
    'landing',
    'goals',
    'starts_at',
    'ends_at',
])]
#[Connection('tenant')]
class Campaign extends Model
{
    /** @use HasFactory<CampaignFactory> */
    use HasFactory, LogUserActivity;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_ARCHIVED = 'archived';

    public const SOURCE_CUSTOM_FORM = 'custom_form';

    public const SOURCE_FACEBOOK = 'facebook';

    public const SOURCE_WHATSAPP = 'whatsapp';

    public const PURPOSE_LEAD_GENERATION = 'lead_generation';

    public const PURPOSE_BRAND_AWARENESS = 'brand_awareness';

    public const PURPOSE_SALES = 'sales';

    public const PURPOSE_EVENT = 'event';

    public const CHANNEL_WEBSITE = 'website';

    public const CHANNEL_SOCIAL = 'social';

    public const CHANNEL_SEARCH = 'search';

    public const CHANNEL_EMAIL = 'email';

    public const CHANNEL_REFERRAL = 'referral';

    public const CHANNEL_OFFLINE = 'offline';

    public const CHANNEL_PARTNER = 'partner';

    public const CHANNEL_OTHER = 'other';

    /**
     * @return list<string>
     */
    public static function statuses(): array
    {
        return [
            self::STATUS_DRAFT,
            self::STATUS_ACTIVE,
            self::STATUS_ARCHIVED,
        ];
    }

    /**
     * @return list<string>
     */
    public static function sourceTypes(): array
    {
        return [
            self::SOURCE_CUSTOM_FORM,
            self::SOURCE_FACEBOOK,
            self::SOURCE_WHATSAPP,
        ];
    }

    /**
     * @return list<string>
     */
    public static function purposes(): array
    {
        return [
            self::PURPOSE_LEAD_GENERATION,
            self::PURPOSE_BRAND_AWARENESS,
            self::PURPOSE_SALES,
            self::PURPOSE_EVENT,
        ];
    }

    /**
     * @return list<string>
     */
    public static function channels(): array
    {
        return [
            self::CHANNEL_WEBSITE,
            self::CHANNEL_SOCIAL,
            self::CHANNEL_SEARCH,
            self::CHANNEL_EMAIL,
            self::CHANNEL_REFERRAL,
            self::CHANNEL_OFFLINE,
            self::CHANNEL_PARTNER,
            self::CHANNEL_OTHER,
        ];
    }

    /**
     * @return array<string, array{enabled: bool, target: int}>
     */
    public static function defaultGoals(): array
    {
        CampaignGoalType::ensureDefaults();

        return CampaignGoalType::query()
            ->orderBy('priority')
            ->get(['label'])
            ->mapWithKeys(fn (CampaignGoalType $goal): array => [
                (string) $goal->label => ['enabled' => false, 'target' => 0],
            ])
            ->all();
    }

    /**
     * @return array{source: ?string, medium: ?string, campaign: ?string, content: ?string, term: ?string}
     */
    public static function defaultUtm(): array
    {
        return [
            'source' => null,
            'medium' => null,
            'campaign' => null,
            'content' => null,
            'term' => null,
        ];
    }

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'owner_id' => 'integer',
            'project_id' => 'integer',
            'campaign_form_id' => 'integer',
            'default_assignee_id' => 'integer',
            'default_lead_stage_id' => 'integer',
            'budget' => 'decimal:2',
            'target_cpl' => 'decimal:2',
            'tags' => 'array',
            'utm' => 'array',
            'source_config' => 'array',
            'landing' => 'array',
            'goals' => 'array',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Campaign $campaign): void {
            if (blank($campaign->public_id)) {
                $campaign->public_id = (string) Str::uuid();
            }

            if (blank($campaign->slug) && filled($campaign->title)) {
                $campaign->slug = static::uniqueSlugFromTitle($campaign->title);
            }
        });
    }

    public static function uniqueSlugFromTitle(string $title): string
    {
        $base = Str::slug($title) ?: 'campaign';
        $slug = $base;
        $suffix = 1;

        while (static::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * @return MorphOne<AssetLink, $this>
     */
    public function thumbnail(): MorphOne
    {
        return $this->morphOne(AssetLink::class, 'assetable')
            ->where('linkage', AssetManager::LINKAGE_THUMBNAIL);
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
     * @return BelongsTo<Project, $this>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * @return BelongsTo<CampaignForm, $this>
     */
    public function form(): BelongsTo
    {
        return $this->belongsTo(CampaignForm::class, 'campaign_form_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function defaultAssignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'default_assignee_id');
    }

    /**
     * @return BelongsTo<LeadStage, $this>
     */
    public function defaultLeadStage(): BelongsTo
    {
        return $this->belongsTo(LeadStage::class, 'default_lead_stage_id');
    }

    /**
     * @return HasMany<Lead, $this>
     */
    public function leads(): HasMany
    {
        return $this->hasMany(Lead::class);
    }

    /**
     * @return HasMany<CampaignFormSubmission, $this>
     */
    public function submissions(): HasMany
    {
        return $this->hasMany(CampaignFormSubmission::class);
    }
}

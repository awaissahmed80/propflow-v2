<?php

namespace App\Models;

use App\Traits\LogUserActivity;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

#[Fillable([
    'uuid',
    'first_name',
    'last_name',
    'email_address',
    'phone_number',
    'phone_number_alt',
    'profile',
    'demographics',
    'cnic',
    'address',
    'city',
    'country',
    'contact_preference',
    'tag',
    'income_level',
    'affordability',
    'capability',
    'goal',
    'net_worth',
    'type',
    'reference',
])]
#[Connection('tenant')]
class Contact extends Model
{
    use HasFactory, LogUserActivity, SoftDeletes;

    public const TAG_INVESTOR = 'INVESTOR';

    public const TAG_AFFILIATE = 'AFFILIATE';

    public const TAG_AGENT = 'AGENT';

    public const TAG_GENERAL = 'GENERAL';

    public const TYPE_LEAD = 'LEAD';

    public const TYPE_CLIENT = 'CLIENT';

    public const INCOME_LOW = 'LOW';

    public const INCOME_LOWER_MIDDLE = 'LOWER MIDDLE';

    public const INCOME_MIDDLE = 'MIDDLE';

    public const INCOME_UPPER_MIDDLE = 'UPPER MIDDLE';

    public const INCOME_HIGH = 'HIGH';

    public const INCOME_VERY_HIGH = 'VERY HIGH';

    public const AFFORDABILITY_LUXURY = 'LUXURY';

    public const AFFORDABILITY_MODERATE = 'MODERATE';

    public const AFFORDABILITY_BUDGET = 'BUDGET';

    public const CAPABILITY_LOW = 'LOW';

    public const CAPABILITY_MODERATE = 'MODERATE';

    public const CAPABILITY_HIGH = 'HIGH';

    /**
     * @return list<string>
     */
    public static function tags(): array
    {
        return [
            self::TAG_GENERAL,
            self::TAG_INVESTOR,
            self::TAG_AFFILIATE,
            self::TAG_AGENT,
        ];
    }

    /**
     * @return list<string>
     */
    public static function types(): array
    {
        return [
            self::TYPE_LEAD,
            self::TYPE_CLIENT,
        ];
    }

    /**
     * @return list<string>
     */
    public static function incomeLevels(): array
    {
        return [
            self::INCOME_LOW,
            self::INCOME_LOWER_MIDDLE,
            self::INCOME_MIDDLE,
            self::INCOME_UPPER_MIDDLE,
            self::INCOME_HIGH,
            self::INCOME_VERY_HIGH,
        ];
    }

    /**
     * @return list<string>
     */
    public static function affordabilityLevels(): array
    {
        return [
            self::AFFORDABILITY_BUDGET,
            self::AFFORDABILITY_MODERATE,
            self::AFFORDABILITY_LUXURY,
        ];
    }

    /**
     * @return list<string>
     */
    public static function capabilityLevels(): array
    {
        return [
            self::CAPABILITY_LOW,
            self::CAPABILITY_MODERATE,
            self::CAPABILITY_HIGH,
        ];
    }

    public function getDisplayNameAttribute(): string
    {
        $name = trim(implode(' ', array_filter([
            $this->first_name,
            $this->last_name,
        ])));

        return $name !== '' ? $name : 'Contact #'.$this->id;
    }

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'profile' => 'array',
            'demographics' => 'array',
            'net_worth' => 'decimal:2',
        ];
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Contact $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }

    public function leads(): HasMany
    {
        return $this->hasMany(Lead::class);
    }
}

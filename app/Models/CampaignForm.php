<?php

namespace App\Models;

use Database\Factories\CampaignFormFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

#[Fillable([
    'public_id',
    'name',
    'status',
    'fields',
    'settings',
    'branding',
])]
#[Connection('tenant')]
class CampaignForm extends Model
{
    /** @use HasFactory<CampaignFormFactory> */
    use HasFactory;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_ARCHIVED = 'archived';

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
     * @return list<array{key: string, label: string, type: string, required: bool, enabled: bool, placeholder?: string}>
     */
    public static function defaultFields(): array
    {
        return [
            [
                'key' => 'first_name',
                'label' => 'First name',
                'type' => 'text',
                'required' => true,
                'enabled' => true,
                'placeholder' => 'First name',
            ],
            [
                'key' => 'last_name',
                'label' => 'Last name',
                'type' => 'text',
                'required' => false,
                'enabled' => true,
                'placeholder' => 'Last name',
            ],
            [
                'key' => 'phone_number',
                'label' => 'Phone',
                'type' => 'tel',
                'required' => false,
                'enabled' => true,
                'placeholder' => 'Phone number',
            ],
            [
                'key' => 'email_address',
                'label' => 'Email',
                'type' => 'email',
                'required' => false,
                'enabled' => true,
                'placeholder' => 'Email address',
            ],
            [
                'key' => 'budget',
                'label' => 'Budget',
                'type' => 'number',
                'required' => false,
                'enabled' => false,
                'placeholder' => 'Budget',
            ],
            [
                'key' => 'notes',
                'label' => 'Notes',
                'type' => 'textarea',
                'required' => false,
                'enabled' => false,
                'placeholder' => 'Anything we should know?',
            ],
            [
                'key' => 'preferred_contact_time',
                'label' => 'Preferred contact time',
                'type' => 'text',
                'required' => false,
                'enabled' => false,
                'placeholder' => 'e.g. Weekday evenings',
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function defaultSettings(): array
    {
        return [
            'lead_stage_id' => null,
            'assigned_to' => null,
            'project_id' => null,
            'source' => 'Website form',
            'landing_source' => 'Campaign landing',
            'thank_you_message' => 'Thanks — we will be in touch shortly.',
            'redirect_url' => null,
            'honeypot_field' => 'company_website',
        ];
    }

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'fields' => 'array',
            'settings' => 'array',
            'branding' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (CampaignForm $form): void {
            if (blank($form->public_id)) {
                $form->public_id = (string) Str::uuid();
            }

            if ($form->fields === null) {
                $form->fields = static::defaultFields();
            }

            if ($form->settings === null) {
                $form->settings = static::defaultSettings();
            }
        });
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    /**
     * @return HasMany<Campaign, $this>
     */
    public function campaigns(): HasMany
    {
        return $this->hasMany(Campaign::class, 'campaign_form_id');
    }

    /**
     * @return HasMany<CampaignFormSubmission, $this>
     */
    public function submissions(): HasMany
    {
        return $this->hasMany(CampaignFormSubmission::class);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function enabledFields(): array
    {
        $fields = $this->fields ?? static::defaultFields();

        return array_values(array_filter(
            $fields,
            fn (array $field): bool => (bool) ($field['enabled'] ?? false),
        ));
    }
}

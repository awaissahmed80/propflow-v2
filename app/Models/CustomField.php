<?php

namespace App\Models;

use App\Traits\LogUserActivity;
use Database\Factories\CustomFieldFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'entity',
    'key',
    'label',
    'type',
    'required',
    'enabled',
    'placeholder',
    'priority',
    'is_system',
])]
#[Connection('tenant')]
class CustomField extends Model
{
    /** @use HasFactory<CustomFieldFactory> */
    use HasFactory, LogUserActivity;

    public const ENTITY_CAMPAIGN_FORM = 'campaign_form';

    public function getRouteKeyName(): string
    {
        return 'key';
    }

    /**
     * Campaign form routes only address fields for that entity.
     */
    public function resolveRouteBinding($value, $field = null): ?static
    {
        return $this->resolveRouteBindingQuery($this, $value, $field)
            ->where('entity', self::ENTITY_CAMPAIGN_FORM)
            ->first();
    }

    /**
     * @return list<string>
     */
    public static function fieldTypes(): array
    {
        return ['text', 'email', 'tel', 'number', 'textarea'];
    }

    /**
     * @return list<array{
     *     key: string,
     *     label: string,
     *     type: string,
     *     required: bool,
     *     enabled: bool,
     *     placeholder?: string|null,
     *     is_system: bool
     * }>
     */
    public static function defaultCampaignFormDefinitions(): array
    {
        return [
            [
                'key' => 'first_name',
                'label' => 'First name',
                'type' => 'text',
                'required' => true,
                'enabled' => true,
                'placeholder' => 'First name',
                'is_system' => true,
            ],
            [
                'key' => 'last_name',
                'label' => 'Last name',
                'type' => 'text',
                'required' => false,
                'enabled' => true,
                'placeholder' => 'Last name',
                'is_system' => true,
            ],
            [
                'key' => 'phone_number',
                'label' => 'Phone',
                'type' => 'tel',
                'required' => false,
                'enabled' => true,
                'placeholder' => 'Phone number',
                'is_system' => true,
            ],
            [
                'key' => 'email_address',
                'label' => 'Email',
                'type' => 'email',
                'required' => false,
                'enabled' => true,
                'placeholder' => 'Email address',
                'is_system' => true,
            ],
            [
                'key' => 'budget',
                'label' => 'Budget',
                'type' => 'number',
                'required' => false,
                'enabled' => false,
                'placeholder' => 'Budget',
                'is_system' => true,
            ],
            [
                'key' => 'notes',
                'label' => 'Notes',
                'type' => 'textarea',
                'required' => false,
                'enabled' => false,
                'placeholder' => 'Anything we should know?',
                'is_system' => true,
            ],
            [
                'key' => 'preferred_contact_time',
                'label' => 'Preferred contact time',
                'type' => 'text',
                'required' => false,
                'enabled' => false,
                'placeholder' => 'e.g. Weekday evenings',
                'is_system' => true,
            ],
        ];
    }

    public static function ensureCampaignFormDefaults(): void
    {
        if (static::query()->where('entity', self::ENTITY_CAMPAIGN_FORM)->exists()) {
            return;
        }

        foreach (static::defaultCampaignFormDefinitions() as $index => $definition) {
            static::query()->create([
                ...$definition,
                'entity' => self::ENTITY_CAMPAIGN_FORM,
                'priority' => $index + 1,
            ]);
        }
    }

    /**
     * @return list<array{
     *     id: int,
     *     key: string,
     *     label: string,
     *     type: string,
     *     required: bool,
     *     enabled: bool,
     *     placeholder: ?string,
     *     priority: int,
     *     is_system: bool
     * }>
     */
    public static function campaignFormCatalog(): array
    {
        static::ensureCampaignFormDefaults();

        return static::query()
            ->where('entity', self::ENTITY_CAMPAIGN_FORM)
            ->orderBy('priority')
            ->get([
                'id',
                'key',
                'label',
                'type',
                'required',
                'enabled',
                'placeholder',
                'priority',
                'is_system',
            ])
            ->map(fn (self $field): array => [
                'id' => $field->id,
                'key' => $field->key,
                'label' => $field->label,
                'type' => $field->type,
                'required' => (bool) $field->required,
                'enabled' => (bool) $field->enabled,
                'placeholder' => $field->placeholder,
                'priority' => (int) $field->priority,
                'is_system' => (bool) $field->is_system,
            ])
            ->values()
            ->all();
    }

    /**
     * Field shapes used when creating new campaign forms.
     *
     * @return list<array{key: string, label: string, type: string, required: bool, enabled: bool, placeholder?: string}>
     */
    public static function campaignFormFieldDefinitions(): array
    {
        return array_map(
            function (array $field): array {
                $definition = [
                    'key' => $field['key'],
                    'label' => $field['label'],
                    'type' => $field['type'],
                    'required' => (bool) $field['required'],
                    'enabled' => (bool) $field['enabled'],
                ];

                if (filled($field['placeholder'] ?? null)) {
                    $definition['placeholder'] = $field['placeholder'];
                }

                return $definition;
            },
            static::campaignFormCatalog(),
        );
    }

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'required' => 'boolean',
            'enabled' => 'boolean',
            'priority' => 'integer',
            'is_system' => 'boolean',
        ];
    }
}

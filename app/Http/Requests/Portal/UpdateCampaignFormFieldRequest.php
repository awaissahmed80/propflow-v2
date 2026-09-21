<?php

namespace App\Http\Requests\Portal;

use App\Models\CustomField;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UpdateCampaignFormFieldRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        /** @var CustomField|null $field */
        $field = $this->route('field');

        return [
            'label' => ['required', 'string', 'max:150'],
            'key' => [
                'nullable',
                'string',
                'max:100',
                'regex:/^[a-z][a-z0-9_]*$/',
                Rule::unique(CustomField::class, 'key')
                    ->where(fn ($query) => $query->where('entity', CustomField::ENTITY_CAMPAIGN_FORM))
                    ->ignore($field?->id),
            ],
            'type' => ['nullable', 'string', Rule::in(CustomField::fieldTypes())],
            'required' => ['sometimes', 'boolean'],
            'enabled' => ['sometimes', 'boolean'],
            'placeholder' => ['nullable', 'string', 'max:255'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('key')) {
            $this->merge([
                'key' => Str::slug((string) $this->input('key'), '_'),
            ]);
        }
    }
}

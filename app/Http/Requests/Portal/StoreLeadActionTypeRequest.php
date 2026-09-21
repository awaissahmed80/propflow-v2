<?php

namespace App\Http\Requests\Portal;

use App\Models\LeadActionType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StoreLeadActionTypeRequest extends FormRequest
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
        $kind = (string) $this->input('kind');

        return [
            'kind' => ['required', 'string', Rule::in([
                LeadActionType::KIND_ACTIVITY,
                LeadActionType::KIND_NEXT_ACTION,
            ])],
            'title' => ['required', 'string', 'max:100'],
            'label' => [
                'nullable',
                'string',
                'max:100',
                Rule::unique(LeadActionType::class, 'label')->where(fn ($query) => $query->where('kind', $kind)),
            ],
            'icon' => ['nullable', 'string', 'max:64'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('title') && blank($this->input('label'))) {
            $this->merge([
                'label' => Str::slug((string) $this->input('title'), '_'),
            ]);
        }
    }
}

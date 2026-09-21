<?php

namespace App\Http\Requests\Portal;

use App\Models\LeadActionType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateLeadActionTypeRequest extends FormRequest
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
        /** @var LeadActionType $actionType */
        $actionType = $this->route('actionType');

        return [
            'title' => ['sometimes', 'required', 'string', 'max:100'],
            'label' => [
                'nullable',
                'string',
                'max:100',
                Rule::unique(LeadActionType::class, 'label')
                    ->where(fn ($query) => $query->where('kind', $actionType->kind))
                    ->ignore($actionType->id),
            ],
            'icon' => ['nullable', 'string', 'max:64'],
            'is_enabled' => ['sometimes', 'boolean'],
        ];
    }
}

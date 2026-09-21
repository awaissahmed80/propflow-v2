<?php

namespace App\Http\Requests\Portal;

use App\Models\LeadStage;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateLeadStageRequest extends FormRequest
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
        /** @var LeadStage $stage */
        $stage = $this->route('stage');

        return [
            'title' => ['sometimes', 'required', 'string', 'max:100'],
            'label' => [
                'nullable',
                'string',
                'max:100',
                Rule::unique(LeadStage::class, 'label')->ignore($stage->id),
            ],
            'color' => ['nullable', 'string', 'max:20'],
            'is_enabled' => ['sometimes', 'boolean'],
        ];
    }
}

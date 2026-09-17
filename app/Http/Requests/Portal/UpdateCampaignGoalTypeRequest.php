<?php

namespace App\Http\Requests\Portal;

use App\Models\CampaignGoalType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCampaignGoalTypeRequest extends FormRequest
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
        /** @var CampaignGoalType $goalType */
        $goalType = $this->route('goalType');

        return [
            'title' => ['required', 'string', 'max:100'],
            'label' => [
                'nullable',
                'string',
                'max:100',
                Rule::unique(CampaignGoalType::class, 'label')->ignore($goalType->id),
            ],
            'color' => ['nullable', 'string', 'max:20'],
        ];
    }
}

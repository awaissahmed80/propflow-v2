<?php

namespace App\Http\Requests\Portal;

use App\Models\CustomField;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReorderCampaignFormFieldsRequest extends FormRequest
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
        return [
            'order' => ['required', 'array', 'min:1'],
            'order.*' => [
                'integer',
                Rule::exists(CustomField::class, 'id')->where(
                    fn ($query) => $query->where('entity', CustomField::ENTITY_CAMPAIGN_FORM)
                ),
            ],
        ];
    }
}

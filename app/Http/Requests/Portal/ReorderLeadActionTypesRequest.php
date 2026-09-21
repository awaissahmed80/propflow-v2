<?php

namespace App\Http\Requests\Portal;

use App\Models\LeadActionType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReorderLeadActionTypesRequest extends FormRequest
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
            'kind' => ['required', 'string', Rule::in([
                LeadActionType::KIND_ACTIVITY,
                LeadActionType::KIND_NEXT_ACTION,
            ])],
            'order' => ['required', 'array', 'min:1'],
            'order.*' => ['integer', Rule::exists(LeadActionType::class, 'id')],
        ];
    }
}

<?php

namespace App\Http\Requests\Portal;

use App\Models\Unit;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BulkUnitRequest extends FormRequest
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
            'ids' => ['required', 'array', 'min:1', 'max:100'],
            'ids.*' => ['integer', 'distinct', Rule::exists(Unit::class, 'id')],
            'action' => ['required', 'string', Rule::in(['status', 'destroy'])],
            'status' => [
                'nullable',
                'string',
                Rule::requiredIf(fn (): bool => $this->input('action') === 'status'),
                Rule::in(Unit::statuses()),
            ],
        ];
    }
}

<?php

namespace App\Http\Requests\Portal;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Partial-friendly rules for full form saves and inline patch updates.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'max:150'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'type' => ['sometimes', 'nullable', 'string', 'max:50'],
            'purpose' => ['sometimes', 'nullable', 'string', 'max:100'],
            'country' => ['sometimes', 'nullable', 'string', 'max:100'],
            'city' => ['sometimes', 'nullable', 'string', 'max:100'],
            'location' => ['sometimes', 'nullable', 'string', 'max:255'],
            'status' => ['sometimes', 'nullable', 'string', 'max:20', Rule::in(['draft', 'active', 'on_hold', 'completed', 'archived'])],
            'start_date' => ['sometimes', 'nullable', 'date'],
            'end_date' => ['sometimes', 'nullable', 'date', 'after_or_equal:start_date'],
            'progress' => ['sometimes', 'integer', 'min:0', 'max:100'],
            'pin_location' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'area_unit' => ['sometimes', 'nullable', 'string', 'max:50'],
            'total_area' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'features' => ['sometimes', 'nullable', 'array'],
            'features.*' => ['required', 'string', 'max:150'],
            'balloting_enabled' => ['sometimes', 'boolean'],
        ];
    }
}

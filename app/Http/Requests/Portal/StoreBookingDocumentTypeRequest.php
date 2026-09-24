<?php

namespace App\Http\Requests\Portal;

use App\Models\BookingDocumentType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StoreBookingDocumentTypeRequest extends FormRequest
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
            'title' => ['required', 'string', 'max:150'],
            'label' => ['nullable', 'string', 'max:100', Rule::unique(BookingDocumentType::class, 'label')],
            'description' => ['nullable', 'string', 'max:255'],
            'is_required' => ['sometimes', 'boolean'],
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

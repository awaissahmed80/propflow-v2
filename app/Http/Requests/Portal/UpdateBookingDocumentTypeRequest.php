<?php

namespace App\Http\Requests\Portal;

use App\Models\BookingDocumentType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateBookingDocumentTypeRequest extends FormRequest
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
        /** @var BookingDocumentType $documentType */
        $documentType = $this->route('documentType');

        return [
            'title' => ['required', 'string', 'max:150'],
            'label' => [
                'nullable',
                'string',
                'max:100',
                Rule::unique(BookingDocumentType::class, 'label')->ignore($documentType->id),
            ],
            'description' => ['nullable', 'string', 'max:255'],
            'is_required' => ['sometimes', 'boolean'],
        ];
    }
}

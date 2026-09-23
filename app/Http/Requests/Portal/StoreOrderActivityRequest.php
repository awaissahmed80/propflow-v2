<?php

namespace App\Http\Requests\Portal;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreOrderActivityRequest extends FormRequest
{
    public const ACTION_NOTE = 'Note';

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'action' => self::ACTION_NOTE,
        ]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'action' => ['required', 'string', Rule::in([self::ACTION_NOTE])],
            'comments' => ['required', 'string', 'max:2000'],
            'media_ids' => ['nullable', 'array'],
            'media_ids.*' => ['integer'],
            'document_ids' => ['nullable', 'array'],
            'document_ids.*' => ['integer'],
        ];
    }
}

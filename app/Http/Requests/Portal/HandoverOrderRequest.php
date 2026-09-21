<?php

namespace App\Http\Requests\Portal;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class HandoverOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'original_files' => $this->boolean('original_files'),
            'allotment_letter' => $this->boolean('allotment_letter'),
            'registry_docs' => $this->boolean('registry_docs'),
        ]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'original_files' => ['boolean'],
            'allotment_letter' => ['boolean'],
            'registry_docs' => ['boolean'],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                foreach (['original_files', 'allotment_letter', 'registry_docs'] as $key) {
                    if (! $this->boolean($key)) {
                        $validator->errors()->add($key, 'Confirm every original document is in the file.');
                    }
                }
            },
        ];
    }
}

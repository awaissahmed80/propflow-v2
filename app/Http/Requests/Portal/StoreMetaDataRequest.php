<?php

namespace App\Http\Requests\Portal;

use App\Models\MetaData;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMetaDataRequest extends FormRequest
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
            'type' => ['required', 'string', Rule::in(MetaData::types())],
            'value' => ['required', 'string', 'max:150'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'type' => is_string($this->type) ? strtoupper(trim($this->type)) : $this->type,
            'value' => is_string($this->value) ? trim($this->value) : $this->value,
        ]);
    }
}

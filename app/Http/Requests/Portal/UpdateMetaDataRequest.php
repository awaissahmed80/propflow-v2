<?php

namespace App\Http\Requests\Portal;

use App\Models\MetaData;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMetaDataRequest extends FormRequest
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
            'value' => ['required', 'string', 'max:150'],
            'type' => ['sometimes', 'string', Rule::in(MetaData::types())],
        ];
    }
}

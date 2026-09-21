<?php

namespace App\Http\Requests\Portal;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class InterpretAssistantRequest extends FormRequest
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
            'transcript' => ['required', 'string', 'max:500'],
            'intent_hint' => ['nullable', 'string', 'max:50'],
            'intent_score' => ['nullable', 'numeric', 'min:0', 'max:1'],
            'context' => ['nullable', 'array'],
            'context.intent' => ['nullable', 'string', 'max:50'],
            'context.slots' => ['nullable', 'array'],
            'context.missing' => ['nullable', 'array'],
            'context.missing.*' => ['string', 'max:50'],
        ];
    }
}

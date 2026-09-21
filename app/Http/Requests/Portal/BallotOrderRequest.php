<?php

namespace App\Http\Requests\Portal;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class BallotOrderRequest extends FormRequest
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
            'plot_number' => ['required', 'string', 'max:80'],
            'dimensions' => ['required', 'string', 'max:80'],
            'phase' => ['nullable', 'string', 'max:120'],
            'sector' => ['nullable', 'string', 'max:120'],
        ];
    }
}

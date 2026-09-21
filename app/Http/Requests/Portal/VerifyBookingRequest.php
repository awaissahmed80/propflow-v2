<?php

namespace App\Http\Requests\Portal;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class VerifyBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'overseas' => $this->boolean('overseas'),
            'premium' => $this->input('premium', 0),
            'discount' => $this->input('discount', 0),
        ]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'identity_kind' => ['required', 'string', Rule::in(['cnic', 'passport'])],
            'identity_number' => ['required', 'string', 'max:40'],
            'overseas' => ['boolean'],
            'local_phone' => ['nullable', 'string', 'max:40'],
            'nominee_name' => ['required', 'string', 'max:120'],
            'nominee_relation' => ['required', 'string', 'max:40'],
            'nominee_cnic' => ['required', 'string', 'max:40'],
            'nominee_phone' => ['nullable', 'string', 'max:40'],
            'phase' => ['nullable', 'string', 'max:120'],
            'sector' => ['nullable', 'string', 'max:120'],
            'plot_or_file' => ['required', 'string', 'max:80'],
            'category' => ['required', 'string', Rule::in(['standard', 'corner', 'main_boulevard', 'park_facing'])],
            'premium' => ['numeric', 'min:0'],
            'discount' => ['numeric', 'min:0'],
        ];
    }
}

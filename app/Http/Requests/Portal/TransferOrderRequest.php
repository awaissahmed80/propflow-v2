<?php

namespace App\Http\Requests\Portal;

use App\Models\Contact;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TransferOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'ndc_cleared' => $this->boolean('ndc_cleared'),
        ]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $existing = filled($this->input('to_contact_id'));

        return [
            'to_contact_id' => ['nullable', 'integer', Rule::exists(Contact::class, 'id')],
            'first_name' => [Rule::requiredIf(! $existing), 'nullable', 'string', 'max:80'],
            'last_name' => ['nullable', 'string', 'max:80'],
            'phone_number' => [Rule::requiredIf(! $existing), 'nullable', 'string', 'max:40'],
            'cnic' => ['nullable', 'string', 'max:40'],
            'ndc_cleared' => ['boolean'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }
}

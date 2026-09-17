<?php

namespace App\Http\Requests\Portal;

use App\Models\Contact;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreContactRequest extends FormRequest
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
            'first_name' => ['required', 'string', 'max:150'],
            'last_name' => ['nullable', 'string', 'max:150'],
            'phone_number' => [
                'nullable',
                'string',
                'max:50',
                Rule::requiredIf(fn (): bool => blank($this->input('email_address'))),
            ],
            'phone_number_alt' => ['nullable', 'string', 'max:150'],
            'email_address' => [
                'nullable',
                'email',
                'max:150',
                Rule::requiredIf(fn (): bool => blank($this->input('phone_number'))),
            ],
            'cnic' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:150'],
            'country' => ['nullable', 'string', 'max:150'],
            'contact_preference' => ['nullable', 'string', 'max:150'],
            'tag' => ['nullable', 'string', Rule::in(Contact::tags())],
            'income_level' => ['nullable', 'string', Rule::in(Contact::incomeLevels())],
            'affordability' => ['nullable', 'string', Rule::in(Contact::affordabilityLevels())],
            'capability' => ['nullable', 'string', Rule::in(Contact::capabilityLevels())],
            'goal' => ['nullable', 'string', 'max:255'],
            'net_worth' => ['nullable', 'numeric', 'min:0'],
            'type' => ['nullable', 'string', Rule::in(Contact::types())],
            'reference' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if (blank($this->input('phone_number')) && blank($this->input('email_address'))) {
                $validator->errors()->add(
                    'phone_number',
                    'Provide a phone number or email address.'
                );
            }
        });
    }
}

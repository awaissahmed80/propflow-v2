<?php

namespace App\Http\Requests\Portal;

use App\Models\Contact;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateContactRequest extends FormRequest
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
            'first_name' => ['sometimes', 'required', 'string', 'max:150'],
            'last_name' => ['sometimes', 'nullable', 'string', 'max:150'],
            'phone_number' => ['sometimes', 'nullable', 'string', 'max:50'],
            'phone_number_alt' => ['sometimes', 'nullable', 'string', 'max:150'],
            'email_address' => ['sometimes', 'nullable', 'email', 'max:150'],
            'cnic' => ['sometimes', 'nullable', 'string', 'max:50'],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'city' => ['sometimes', 'nullable', 'string', 'max:150'],
            'country' => ['sometimes', 'nullable', 'string', 'max:150'],
            'contact_preference' => ['sometimes', 'nullable', 'string', 'max:150'],
            'tag' => ['sometimes', 'nullable', 'string', Rule::in(Contact::tags())],
            'income_level' => ['sometimes', 'nullable', 'string', Rule::in(Contact::incomeLevels())],
            'affordability' => ['sometimes', 'nullable', 'string', Rule::in(Contact::affordabilityLevels())],
            'capability' => ['sometimes', 'nullable', 'string', Rule::in(Contact::capabilityLevels())],
            'goal' => ['sometimes', 'nullable', 'string', 'max:255'],
            'net_worth' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'type' => ['sometimes', 'nullable', 'string', Rule::in(Contact::types())],
            'reference' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            /** @var Contact $contact */
            $contact = $this->route('contact');

            $phone = array_key_exists('phone_number', $this->all())
                ? $this->input('phone_number')
                : $contact->phone_number;
            $email = array_key_exists('email_address', $this->all())
                ? $this->input('email_address')
                : $contact->email_address;

            if (blank($phone) && blank($email)) {
                $validator->errors()->add(
                    'phone_number',
                    'Provide a phone number or email address.'
                );
            }
        });
    }
}

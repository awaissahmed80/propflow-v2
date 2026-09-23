<?php

namespace App\Http\Requests\Portal;

use App\Models\PaymentAccount;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StorePaymentAccountRequest extends FormRequest
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
            'type' => ['required', 'string', Rule::in(PaymentAccount::types())],
            'name' => ['required', 'string', 'max:150'],
            'bank_name' => ['nullable', 'string', 'max:150'],
            'account_title' => ['nullable', 'string', 'max:150'],
            'account_number' => ['nullable', 'string', 'max:80'],
            'iban' => ['nullable', 'string', 'max:80'],
            'swift' => ['nullable', 'string', 'max:40'],
            'branch' => ['nullable', 'string', 'max:150'],
            'is_default' => ['sometimes', 'boolean'],
            'is_enabled' => ['sometimes', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($this->input('type') !== PaymentAccount::TYPE_BANK) {
                return;
            }

            $bankFields = ['bank_name', 'account_title', 'account_number', 'iban', 'swift', 'branch'];
            $filled = collect($bankFields)->filter(fn (string $field): bool => filled($this->input($field)));

            if ($filled->isEmpty()) {
                return;
            }

            foreach (['bank_name', 'account_title', 'account_number'] as $required) {
                if (! filled($this->input($required))) {
                    $validator->errors()->add($required, 'Required when any bank detail is provided.');
                }
            }
        });
    }
}

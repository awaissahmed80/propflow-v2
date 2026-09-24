<?php

namespace App\Http\Requests\Portal;

use App\Support\Deals\PaymentSchedule;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

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
            'nominee_identity_kind' => $this->input('nominee_identity_kind', 'cnic'),
        ]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $wantsPlan = $this->filled('first_due_on');
        $custom = $this->input('template') === PaymentSchedule::TEMPLATE_CUSTOM
            || $this->input('template_id') === 'custom';

        return [
            'customer_legal_name' => ['required', 'string', 'max:160'],
            'identity_kind' => ['required', 'string', Rule::in(['cnic', 'nicop', 'passport'])],
            'identity_number' => ['required', 'string', 'max:40'],
            'overseas' => ['boolean'],
            'international_phone' => ['required', 'string', 'max:40'],
            'local_phone' => ['nullable', 'string', 'max:40'],
            'nominee_name' => ['required', 'string', 'max:120'],
            'nominee_relation' => ['required', 'string', 'max:40'],
            'nominee_identity_kind' => ['required', 'string', Rule::in(['cnic', 'nicop', 'passport'])],
            'nominee_cnic' => ['required', 'string', 'max:40'],
            'nominee_phone' => ['nullable', 'string', 'max:40'],
            'phase' => ['nullable', 'string', 'max:120'],
            'sector' => ['nullable', 'string', 'max:120'],
            'plot_or_file' => ['nullable', 'string', 'max:80'],
            'category' => ['required', 'string', 'max:120'],
            'premium' => ['numeric', 'min:0'],
            'discount' => ['numeric', 'min:0'],
            'template_id' => [Rule::requiredIf($wantsPlan), 'nullable'],
            'template' => ['nullable', 'string', Rule::in([
                PaymentSchedule::TEMPLATE_QUARTERLY,
                PaymentSchedule::TEMPLATE_BALLOON,
                PaymentSchedule::TEMPLATE_CUSTOM,
            ])],
            'down_payment' => [Rule::requiredIf($wantsPlan), 'nullable', 'numeric', 'min:0'],
            'handover_percent' => [Rule::requiredIf($wantsPlan), 'nullable', 'numeric', 'min:0', 'max:100'],
            'installment_count' => [Rule::requiredIf($wantsPlan && $custom), 'nullable', 'integer', 'min:1', 'max:120'],
            'frequency' => [Rule::requiredIf($wantsPlan && $custom), 'nullable', 'string', Rule::in(['monthly', 'quarterly'])],
            'first_due_on' => ['nullable', 'date'],
            'late_fee_basis' => ['nullable', 'string', Rule::in(['daily', 'monthly'])],
            'late_fee_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if (! $this->filled('first_due_on')) {
                return;
            }

            if ($this->filled('template_id') || $this->filled('template')) {
                return;
            }

            $validator->errors()->add('template_id', 'Choose a payment plan template.');
        });
    }
}

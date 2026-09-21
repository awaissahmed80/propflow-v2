<?php

namespace App\Http\Requests\Portal;

use App\Support\Deals\PaymentSchedule;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class GeneratePaymentPlanRequest extends FormRequest
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
        $templateId = $this->input('template_id');
        $custom = $this->input('template') === PaymentSchedule::TEMPLATE_CUSTOM
            || $templateId === 'custom'
            || $templateId === null && $this->input('template') === PaymentSchedule::TEMPLATE_CUSTOM;

        return [
            'template_id' => ['nullable'],
            'template' => ['nullable', 'string', Rule::in([
                PaymentSchedule::TEMPLATE_QUARTERLY,
                PaymentSchedule::TEMPLATE_BALLOON,
                PaymentSchedule::TEMPLATE_CUSTOM,
            ])],
            'down_payment' => ['required', 'numeric', 'min:0'],
            'handover_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'installment_count' => [Rule::requiredIf($custom), 'nullable', 'integer', 'min:1', 'max:120'],
            'frequency' => [Rule::requiredIf($custom), 'nullable', 'string', Rule::in(['monthly', 'quarterly'])],
            'first_due_on' => ['required', 'date'],
            'late_fee_basis' => ['nullable', 'string', Rule::in(['daily', 'monthly'])],
            'late_fee_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($this->filled('template_id') || $this->filled('template')) {
                return;
            }

            $validator->errors()->add('template_id', 'Choose a payment plan template.');
        });
    }
}

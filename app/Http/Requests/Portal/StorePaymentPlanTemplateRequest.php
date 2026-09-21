<?php

namespace App\Http\Requests\Portal;

use App\Models\Project;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePaymentPlanTemplateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:120'],
            'project_id' => ['nullable', 'integer', Rule::exists(Project::class, 'id')],
            'frequency' => ['required', Rule::in(['monthly', 'quarterly'])],
            'installment_count' => ['required', 'integer', 'min:1', 'max:120'],
            'balloon_every' => ['nullable', 'integer', 'min:2', 'max:24'],
            'down_payment_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'handover_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'late_fee_basis' => ['nullable', Rule::in(['daily', 'monthly'])],
            'late_fee_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'is_enabled' => ['sometimes', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('is_enabled')) {
            $this->merge([
                'is_enabled' => filter_var($this->input('is_enabled'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? true,
            ]);
        }
    }
}

<?php

namespace App\Http\Requests\Portal;

use App\Models\Order;
use App\Models\Project;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateOrderRequest extends FormRequest
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
            'project_id' => ['sometimes', 'nullable', 'integer', Rule::exists(Project::class, 'id')],
            'assigned_to' => ['sometimes', 'nullable', 'integer', Rule::exists(User::class, 'id')],
            'status' => ['sometimes', 'nullable', 'string', Rule::in(Order::manualStatuses())],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if (! $this->filled('status')) {
                return;
            }

            if (in_array($this->input('status'), Order::automatedStatuses(), true)) {
                $validator->errors()->add(
                    'status',
                    'That status is set automatically by the payment pipeline.',
                );
            }
        });
    }
}

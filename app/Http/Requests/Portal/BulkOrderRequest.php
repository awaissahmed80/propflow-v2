<?php

namespace App\Http\Requests\Portal;

use App\Models\Order;
use App\Models\OrderStatus;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class BulkOrderRequest extends FormRequest
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
        OrderStatus::ensureDefaults();

        return [
            'ids' => ['required', 'array', 'min:1', 'max:100'],
            'ids.*' => ['integer', 'distinct', Rule::exists(Order::class, 'id')],
            'action' => ['required', 'string', Rule::in(['assign', 'status', 'cancel'])],
            'assigned_to' => [
                'nullable',
                'integer',
                Rule::requiredIf(fn (): bool => $this->input('action') === 'assign'),
                Rule::exists(User::class, 'id'),
            ],
            'status' => [
                'nullable',
                'string',
                Rule::requiredIf(fn (): bool => $this->input('action') === 'status'),
                Rule::in(Order::manualStatuses()),
            ],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($this->input('action') !== 'assign' || ! $this->filled('assigned_to')) {
                return;
            }

            $tenant = Tenant::current();

            if (! $tenant) {
                return;
            }

            $isMember = TenantUser::query()
                ->where('tenant_id', $tenant->id)
                ->where('user_id', $this->input('assigned_to'))
                ->exists();

            if (! $isMember) {
                $validator->errors()->add(
                    'assigned_to',
                    'The selected assignee is not a member of this workspace.',
                );
            }
        });
    }
}

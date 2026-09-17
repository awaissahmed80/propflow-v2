<?php

namespace App\Http\Requests\Portal;

use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class BulkLeadRequest extends FormRequest
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
            'ids' => ['required', 'array', 'min:1', 'max:100'],
            'ids.*' => ['integer', 'distinct', Rule::exists(Lead::class, 'id')],
            'action' => ['required', 'string', Rule::in(['archive', 'restore', 'destroy', 'assign', 'stage'])],
            'assigned_to' => [
                'nullable',
                'integer',
                Rule::requiredIf(fn (): bool => $this->input('action') === 'assign'),
                Rule::exists(User::class, 'id'),
            ],
            'lead_stage_id' => [
                'nullable',
                'integer',
                Rule::requiredIf(fn (): bool => $this->input('action') === 'stage'),
                Rule::exists(LeadStage::class, 'id'),
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

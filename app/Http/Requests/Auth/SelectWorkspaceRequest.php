<?php

namespace App\Http\Requests\Auth;

use App\Services\TenantContext;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SelectWorkspaceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'tenant_id' => ['required', 'integer'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $user = $this->user();
            $tenantId = (int) $this->input('tenant_id');

            if ($user === null) {
                $validator->errors()->add('tenant_id', 'You must be signed in to choose a workspace.');

                return;
            }

            $allowed = app(TenantContext::class)
                ->activeMembershipsFor($user)
                ->contains(fn ($membership) => (int) $membership->tenant_id === $tenantId);

            if (! $allowed) {
                $validator->errors()->add('tenant_id', 'You do not have access to that workspace.');
            }
        });
    }
}

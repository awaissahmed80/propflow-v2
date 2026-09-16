<?php

namespace App\Http\Requests\Portal;

use App\Models\Tenant;
use App\Models\TenantUser;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;

class StoreTeamRequest extends FormRequest
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
            'title' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:1000'],
            'color' => ['nullable', 'string', 'max:20', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'leader_id' => ['required', 'integer', $this->tenantUserExistsRule()],
            'member_ids' => ['nullable', 'array'],
            'member_ids.*' => ['integer', $this->tenantUserExistsRule()],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'leader_id.required' => 'A team must have at least one lead.',
        ];
    }

    protected function tenantUserExistsRule(): Exists
    {
        /** @var Tenant $tenant */
        $tenant = Tenant::current();

        return Rule::exists(TenantUser::class, 'user_id')
            ->where(fn ($query) => $query->where('tenant_id', $tenant->id));
    }
}

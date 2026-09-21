<?php

namespace App\Http\Requests\Portal;

use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends FormRequest
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
        $membershipCode = (string) $this->route('user');
        $userId = TenantUser::query()
            ->where('tenant_id', Tenant::current()?->id)
            ->where('code', $membershipCode)
            ->value('user_id');

        return [
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'title' => ['required', 'string', 'max:150'],
            'department' => ['nullable', 'string', 'max:150'],
            'manager_id' => ['nullable', 'integer', Rule::exists(User::class, 'id')],
            'email_address' => [
                'required',
                'email',
                'max:255',
                Rule::unique(User::class, 'email_address')->ignore($userId),
            ],
            'phone_number' => ['required', 'string', 'max:30'],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
            'roles' => ['nullable', 'array'],
            'roles.*' => ['string', Rule::exists(Role::class, 'name')],
            'avatar' => ['nullable', 'image', 'max:2048'],
            'remove_avatar' => ['sometimes', 'boolean'],
        ];
    }
}

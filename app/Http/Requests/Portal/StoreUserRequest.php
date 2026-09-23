<?php

namespace App\Http\Requests\Portal;

use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantInvitation;
use App\Models\TenantUser;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreUserRequest extends FormRequest
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
            'department' => ['nullable', 'string', 'max:150'],
            'manager_id' => ['nullable', 'integer', Rule::exists(User::class, 'id')],
            'email_address' => ['required', 'email', 'max:255'],
            'phone_number' => ['nullable', 'string', 'max:30'],
            'roles' => ['nullable', 'array'],
            'roles.*' => ['string', Rule::exists(Role::class, 'name')],
            'avatar' => ['nullable', 'image', 'max:2048'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            /** @var Tenant|null $tenant */
            $tenant = Tenant::current();

            if ($tenant === null) {
                return;
            }

            $email = mb_strtolower(trim((string) $this->input('email_address')));

            $existing = User::query()->where('email_address', $email)->first();

            if ($existing?->isPlatformUser()) {
                $validator->errors()->add(
                    'email_address',
                    'This email belongs to a platform account and cannot join a workspace.'
                );

                return;
            }

            if ($existing !== null) {
                $alreadyMember = TenantUser::query()
                    ->where('tenant_id', $tenant->id)
                    ->where('user_id', $existing->id)
                    ->exists();

                if ($alreadyMember) {
                    $validator->errors()->add(
                        'email_address',
                        'This user is already a member of this workspace.'
                    );

                    return;
                }
            }

            $pendingInvite = TenantInvitation::query()
                ->pending()
                ->where('tenant_id', $tenant->id)
                ->where('email', $email)
                ->exists();

            if ($pendingInvite) {
                $validator->errors()->add(
                    'email_address',
                    'An invitation is already pending for this email.'
                );
            }
        });
    }
}

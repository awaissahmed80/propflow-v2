<?php

namespace App\Http\Requests\Auth;

use App\Models\TenantInvitation;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\Validator;

class AcceptInviteRequest extends FormRequest
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
        if ($this->inviteeHasExistingAccount()) {
            if ($this->authenticatedAsInvitee()) {
                return [];
            }

            return [
                'password' => ['required', 'string'],
            ];
        }

        return [
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'phone_number' => ['nullable', 'string', 'max:30'],
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty() || ! $this->inviteeHasExistingAccount()) {
                return;
            }

            if ($this->authenticatedAsInvitee()) {
                return;
            }

            $user = $this->inviteeUser();

            if ($user === null) {
                return;
            }

            $password = (string) $this->input('password', '');

            if ($password === '' || ! Hash::check($password, $user->getAuthPassword())) {
                $validator->errors()->add(
                    'password',
                    'Enter the password for your existing Propflow account.'
                );
            }
        });
    }

    public function inviteeHasExistingAccount(): bool
    {
        $user = $this->inviteeUser();

        return $user !== null && ! $user->isPlatformUser();
    }

    public function authenticatedAsInvitee(): bool
    {
        $user = $this->user();
        $invitee = $this->inviteeUser();

        return $user !== null && $invitee !== null && $user->is($invitee);
    }

    public function inviteeUser(): ?User
    {
        $invitation = $this->pendingInvitation();

        if ($invitation === null) {
            return null;
        }

        return User::query()
            ->where('email_address', mb_strtolower($invitation->email))
            ->first();
    }

    public function pendingInvitation(): ?TenantInvitation
    {
        $token = (string) $this->route('token');

        if ($token === '') {
            return null;
        }

        $invitation = TenantInvitation::query()
            ->where('token', $token)
            ->first();

        if ($invitation === null || ! $invitation->isPending()) {
            return null;
        }

        return $invitation;
    }
}

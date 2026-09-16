<?php

namespace App\Http\Requests\Auth;

use App\Enums\UserStatus;
use App\Enums\UserType;
use App\Models\User;
use App\Services\TenantContext;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
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
            'email_address' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @throws ValidationException
     */
    public function authenticate(): void
    {
        $this->ensureIsNotRateLimited();

        $credentials = $this->only('email_address', 'password');

        if (! Auth::attempt($credentials, $this->boolean('remember'))) {
            RateLimiter::hit($this->throttleKey());

            $this->throwInvalidCredentials();
        }

        /** @var User $user */
        $user = Auth::user();

        if ($user->type !== UserType::Tenant || $user->status !== UserStatus::Active) {
            Auth::logout();
            RateLimiter::hit($this->throttleKey());

            $this->throwInvalidCredentials();
        }

        $memberships = app(TenantContext::class)->activeMembershipsFor($user);

        if ($memberships->isEmpty()) {
            Auth::logout();
            RateLimiter::hit($this->throttleKey());

            $this->throwInvalidCredentials();
        }

        RateLimiter::clear($this->throttleKey());

        $this->attributes->set('tenant_membership', $memberships->first());
    }

    /**
     * @throws ValidationException
     */
    public function ensureIsNotRateLimited(): void
    {
        if (! RateLimiter::tooManyAttempts($this->throttleKey(), 5)) {
            return;
        }

        event(new Lockout($this));

        $seconds = RateLimiter::availableIn($this->throttleKey());

        throw ValidationException::withMessages([
            'email_address' => trans('auth.throttle', [
                'seconds' => $seconds,
                'minutes' => ceil($seconds / 60),
            ]),
        ]);
    }

    public function throttleKey(): string
    {
        return Str::transliterate(Str::lower($this->string('email_address')).'|'.$this->ip());
    }

    /**
     * @throws ValidationException
     */
    protected function throwInvalidCredentials(): never
    {
        throw ValidationException::withMessages([
            'email_address' => __('Invalid credentials'),
            'message' => __('Invalid credentials'),
        ]);
    }
}

<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\AcceptInviteRequest;
use App\Models\TenantInvitation;
use App\Models\User;
use App\Services\InviteWorkspaceMember;
use App\Services\TenantContext;
use App\Support\Domain;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class AcceptInviteController extends Controller
{
    public function __construct(
        protected InviteWorkspaceMember $invites,
        protected TenantContext $tenantContext,
    ) {}

    public function show(string $token): Response|RedirectResponse
    {
        $invitation = TenantInvitation::query()
            ->with(['tenant:id,name,identifier'])
            ->where('token', $token)
            ->first();

        if ($invitation === null || ! $invitation->isPending()) {
            return Inertia::render('auth/accept-invite', [
                'invalid' => true,
                'message' => 'This invitation is invalid or has expired.',
                'invitation' => null,
                'existing_account' => false,
                'authenticated_as_invitee' => false,
            ]);
        }

        $invitee = User::query()
            ->where('email_address', mb_strtolower($invitation->email))
            ->first();

        $existingAccount = $invitee !== null && ! $invitee->isPlatformUser();
        $authenticatedAsInvitee = $existingAccount
            && Auth::check()
            && Auth::user()?->is($invitee);

        return Inertia::render('auth/accept-invite', [
            'invalid' => false,
            'message' => null,
            'existing_account' => $existingAccount,
            'authenticated_as_invitee' => $authenticatedAsInvitee,
            'invitation' => [
                'token' => $invitation->token,
                'email' => $invitation->email,
                'first_name' => $invitation->first_name,
                'last_name' => $invitation->last_name,
                'phone_number' => $invitation->phone_number,
                'workspace' => $invitation->tenant?->name,
                'expires_at' => $invitation->expires_at?->toIso8601String(),
            ],
        ]);
    }

    public function store(AcceptInviteRequest $request, string $token): RedirectResponse|Response
    {
        $invitation = TenantInvitation::query()
            ->where('token', $token)
            ->first();

        if ($invitation === null || ! $invitation->isPending()) {
            return Inertia::render('auth/accept-invite', [
                'invalid' => true,
                'message' => 'This invitation is invalid or has expired.',
                'invitation' => null,
                'existing_account' => false,
                'authenticated_as_invitee' => false,
            ]);
        }

        $user = $this->invites->accept(
            $invitation,
            $request->validated(),
            $request->user(),
        );
        $tenant = $invitation->tenant()->firstOrFail();

        Auth::login($user);
        $request->session()->regenerate();
        $this->tenantContext->enter($tenant, $user);

        return Inertia::render('auth/accept-invite', [
            'invalid' => false,
            'message' => null,
            'invitation' => null,
            'existing_account' => false,
            'authenticated_as_invitee' => false,
            'status' => 'accepted',
            'redirect' => Domain::portal(),
        ]);
    }
}

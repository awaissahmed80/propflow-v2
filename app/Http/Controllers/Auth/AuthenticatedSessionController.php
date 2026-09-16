<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\TenantUser;
use App\Services\TenantContext;
use App\Support\Domain;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class AuthenticatedSessionController extends Controller
{
    public function store(LoginRequest $request, TenantContext $tenantContext): InertiaResponse
    {
        $request->authenticate();

        $request->session()->regenerate();

        /** @var TenantUser $membership */
        $membership = $request->attributes->get('tenant_membership');
        $membership->loadMissing('tenant');

        $tenantContext->enter($membership->tenant, $request->user());

        return Inertia::render('auth/login', [
            'status' => 'authenticated',
            'redirect' => Domain::portal(),
        ]);
    }

    public function destroy(Request $request, TenantContext $tenantContext): InertiaResponse
    {
        $tenantContext->leave();

        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return Inertia::render('auth/login', [
            'status' => 'logged_out',
            'redirect' => Domain::auth(),
        ]);
    }
}

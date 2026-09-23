<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\SelectWorkspaceRequest;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Services\TenantContext;
use App\Support\Domain;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class AuthenticatedSessionController extends Controller
{
    public function store(LoginRequest $request, TenantContext $tenantContext): InertiaResponse
    {
        $request->authenticate();

        $request->session()->regenerate();

        /** @var Collection<int, TenantUser> $memberships */
        $memberships = $request->attributes->get('tenant_memberships');

        if ($memberships->count() === 1) {
            $membership = $memberships->first();
            $membership->loadMissing('tenant');
            $tenantContext->enter($membership->tenant, $request->user());

            return Inertia::render('auth/login', [
                'status' => 'authenticated',
                'redirect' => Domain::portal(),
                'workspaces' => [],
            ]);
        }

        return Inertia::render('auth/login', [
            'status' => 'select_workspace',
            'redirect' => null,
            'workspaces' => $this->workspaceOptions($memberships),
        ]);
    }

    public function workspaces(Request $request, TenantContext $tenantContext): InertiaResponse|RedirectResponse
    {
        $user = $request->user();

        if ($user === null) {
            return redirect()->to(Domain::auth());
        }

        $memberships = $tenantContext->activeMembershipsFor($user);

        if ($memberships->isEmpty()) {
            $tenantContext->leave();
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()->to(Domain::auth());
        }

        if ($memberships->count() === 1) {
            $tenantContext->enter($memberships->first()->tenant, $user);

            return redirect()->to(Domain::portal());
        }

        if ($tenantContext->currentTenantId() !== null) {
            return redirect()->to(Domain::portal());
        }

        return Inertia::render('auth/login', [
            'status' => 'select_workspace',
            'redirect' => null,
            'workspaces' => $this->workspaceOptions($memberships),
        ]);
    }

    public function selectWorkspace(SelectWorkspaceRequest $request, TenantContext $tenantContext): InertiaResponse
    {
        $tenant = Tenant::query()->findOrFail((int) $request->validated('tenant_id'));
        $tenantContext->enter($tenant, $request->user());

        return Inertia::render('auth/login', [
            'status' => 'authenticated',
            'redirect' => Domain::portal(),
            'workspaces' => [],
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
            'workspaces' => [],
        ]);
    }

    /**
     * @param  Collection<int, TenantUser>  $memberships
     * @return list<array{id: int, name: string, identifier: string|null}>
     */
    protected function workspaceOptions(Collection $memberships): array
    {
        return $memberships
            ->map(function (TenantUser $membership): ?array {
                $tenant = $membership->tenant;

                if ($tenant === null) {
                    return null;
                }

                return [
                    'id' => $tenant->id,
                    'name' => $tenant->name,
                    'identifier' => $tenant->identifier,
                ];
            })
            ->filter()
            ->values()
            ->all();
    }
}

<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use App\Models\User;
use App\Services\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTenantContext
{
    public function __construct(public TenantContext $tenantContext) {}

    /**
     * Ensure the session tenant is current and the user may access it.
     *
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        /** @var User|null $user */
        $user = $request->user();

        if (! $user) {
            return $next($request);
        }

        if ($user->isPlatformUser() && ! $this->tenantContext->isImpersonating()) {
            $this->tenantContext->refreshPermissionState($user);

            return $next($request);
        }

        $tenant = Tenant::current() ?? $this->resolveTenantFromSession();

        if (! $tenant) {
            abort(403, 'No tenant selected.');
        }

        if ($user->isTenantUser() && ! $this->tenantContext->userBelongsToTenant($user, $tenant)) {
            abort(403, 'You do not have access to this tenant.');
        }

        if (! $tenant->isCurrent()) {
            $tenant->makeCurrent();
        }

        $this->tenantContext->refreshPermissionState($user);

        return $next($request);
    }

    protected function resolveTenantFromSession(): ?Tenant
    {
        $tenantId = $this->tenantContext->currentTenantId();

        if (! $tenantId) {
            return null;
        }

        return Tenant::query()->whereKey($tenantId)->first();
    }
}

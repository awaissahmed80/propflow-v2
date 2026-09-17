<?php

namespace App\Http\Middleware;

use App\Enums\TenantStatus;
use App\Models\Tenant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResolveTenantByIdentifier
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $identifier = $request->route('identifier');

        if (! is_string($identifier) || $identifier === '') {
            abort(404);
        }

        $tenant = Tenant::query()
            ->where('identifier', $identifier)
            ->first();

        if (! $tenant || $tenant->status !== TenantStatus::Active) {
            abort(404);
        }

        $tenant->makeCurrent();
        $request->attributes->set('tenant', $tenant);

        try {
            return $next($request);
        } finally {
            Tenant::forgetCurrent();
        }
    }
}

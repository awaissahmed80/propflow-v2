<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use App\Services\TenantContext;
use App\Support\Domain;
use Closure;
use Illuminate\Http\Request;
use Inertia\Middleware;
use Symfony\Component\HttpFoundation\Response;

class HandlePortalRequests extends Middleware
{
    // protected $rootView = 'portal';
    public function rootView(Request $request): string
    {
        return 'portal';
    }
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    // public function handle(Request $request, Closure $next): Response
    // {
    //     return $next($request);
    // }

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $tenantContext = app(TenantContext::class);

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user()?->only([
                    'id',
                    'display_name',
                    'first_name',
                    'last_name',
                    'email_address',
                ]),
            ],
            'urls' => [
                'auth' => Domain::auth(),
                'portal' => Domain::portal(),
            ],
            'tenant' => [
                'current' => Tenant::current()?->only(['id', 'name', 'identifier']),
                'impersonating' => $tenantContext->isImpersonating(),
                'impersonator' => $tenantContext->impersonator()?->only(['id', 'display_name', 'email_address']),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }
}

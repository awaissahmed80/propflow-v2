<?php

use App\Http\Middleware\EnsureTenantContext;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\HandlePortalRequests;
use App\Http\Middleware\ResolveTenantByIdentifier;
use App\Support\Domain;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Inertia\Support\Header as InertiaHeader;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            Route::domain('api.'.config('app.base_domain'))
                ->middleware('api')
                ->prefix('')
                ->group(base_path('routes/api.php'));

            RateLimiter::for('login', function (Request $request) {
                return Limit::perMinute(5)->by(
                    (string) $request->string('email_address').'|'.$request->ip()
                );
            });

            RateLimiter::for('form-submit', function (Request $request) {
                return Limit::perMinute(20)->by(
                    $request->ip().'|'.$request->route('form')
                );
            });
        }
    )
    ->withMiddleware(function (Middleware $middleware): void {

        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);
        $middleware->validateCsrfTokens(except: [
            'webhooks/*',
            '*/forms/*/submit',
        ]);

        $middleware->redirectGuestsTo(fn () => Domain::auth());
        $middleware->redirectUsersTo(fn () => Domain::portal());

        $middleware->web(append: [
            // HandleAppearance::class,
            // HandleInertiaRequests::class,
            // AddLinkHeadersForPreloadedAssets::class,
        ]);

        $middleware->group('public', [
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        $middleware->group('portal', [
            HandleAppearance::class,
            HandlePortalRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        $middleware->alias([
            'tenant' => EnsureTenantContext::class,
            'tenant.identifier' => ResolveTenantByIdentifier::class,
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
        ]);

        // Tenant DB must be selected before implicit route-model binding
        // resolves tenant-connection models (LeadStage, MetaData, etc.).
        $middleware->prependToPriorityList(
            before: SubstituteBindings::class,
            prepend: EnsureTenantContext::class,
        );
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->header(InertiaHeader::INERTIA)) {
                return Inertia::location($e->redirectTo($request) ?? Domain::auth());
            }
        });

        $exceptions->render(function (TokenMismatchException $e, Request $request) {
            if ($request->header(InertiaHeader::INERTIA)) {
                return Inertia::location(Domain::auth());
            }
        });

        $exceptions->respond(function (Response $response, Throwable $e, Request $request) {
            if (
                $request->header(InertiaHeader::INERTIA)
                && in_array($response->getStatusCode(), [301, 302, 303, 307, 308], true)
            ) {
                $location = $response->headers->get('Location');
                $targetHost = $location ? parse_url($location, PHP_URL_HOST) : null;

                if (is_string($targetHost) && strcasecmp($targetHost, $request->getHost()) !== 0) {
                    return Inertia::location($location);
                }
            }

            return $response;
        });

        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'message' => 'Record not found.',
                ], 404);
            }

            $isPortal = str_starts_with($request->getHost(), 'portal.');

            Inertia::setRootView($isPortal ? 'portal' : 'app');

            return Inertia::render('errors/not-found', [
                'status' => 404,
                'homeUrl' => $isPortal ? Domain::portal() : Domain::url(null, '/'),
                'portalUrl' => Domain::portal(),
                'authUrl' => Domain::auth(),
            ])->toResponse($request)->setStatusCode(404);
        });
    })->create();

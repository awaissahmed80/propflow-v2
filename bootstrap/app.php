<?php

use App\Http\Middleware\EnsureTenantContext;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\HandlePortalRequests;
use App\Support\Domain;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;
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
        }
    )
    ->withMiddleware(function (Middleware $middleware): void {

        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);
        $middleware->validateCsrfTokens(except: [
            'webhooks/*',
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
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'message' => 'Record not found.',
                ], 404);
            }

            return Inertia::render('errors/not-found')->toResponse($request)->setStatusCode(404);
        });
    })->create();

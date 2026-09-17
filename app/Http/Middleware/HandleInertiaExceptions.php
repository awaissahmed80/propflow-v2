<?php

namespace App\Http\Middleware;

use App\Support\Domain;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class HandleInertiaExceptions
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        try {
            return $next($request);
        } catch (NotFoundHttpException $e) {
            if ($request->inertia()) {
                $isPortal = str_starts_with($request->getHost(), 'portal.');

                Inertia::setRootView($isPortal ? 'portal' : 'app');

                return Inertia::render('errors/not-found', [
                    'status' => 404,
                    'homeUrl' => $isPortal ? Domain::portal() : Domain::url(null, '/'),
                    'portalUrl' => Domain::portal(),
                    'authUrl' => Domain::auth(),
                ])
                    ->toResponse($request)
                    ->setStatusCode(404);
            }

            throw $e;
        }
    }
}

<?php

namespace App\Http\Middleware;

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
                // Set the root view dynamically before rendering
                Inertia::setRootView('public');

                return Inertia::render('errors/not-found')
                    ->toResponse($request)
                    ->setStatusCode(404);
            }

            throw $e;
        }
    }
}

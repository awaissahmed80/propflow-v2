<?php

namespace App\Http\Middleware;

use App\Support\Domain;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    public function rootView(Request $request): string
    {
        return 'app';
    }

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
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
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
            ],
            'urls' => [
                'home' => Domain::url(null, '/'),
                'auth' => Domain::auth(),
                'portal' => Domain::portal(),
                'contact_email' => 'hello@'.Domain::base(),
            ],
            'flash' => [
                'contact_reused' => fn () => $request->session()->get('contact_reused'),
            ],
        ];
    }
}

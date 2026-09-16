<?php

namespace App\Http\Middleware;

use App\Models\MetaData;
use App\Models\Tenant;
use App\Services\TenantContext;
use App\Support\Domain;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Middleware;

class HandlePortalRequests extends Middleware
{
    public function rootView(Request $request): string
    {
        return 'portal';
    }

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
            // Always included so partial reloads keep meta lists fresh.
            'meta' => Inertia::always(fn (): array => $this->sharedMeta()),
        ];
    }

    /**
     * @return array{
     *     CITY: list<string>,
     *     COUNTRY: list<string>,
     *     PROJECT: list<string>,
     *     UNIT: list<string>,
     *     AREA: list<string>,
     *     LINK: list<string>,
     *     DEPARTMENT: list<string>
     * }
     */
    protected function sharedMeta(): array
    {
        if (! Tenant::current()) {
            return [
                'CITY' => [],
                'COUNTRY' => [],
                'PROJECT' => [],
                'UNIT' => [],
                'AREA' => [],
                'LINK' => [],
                'DEPARTMENT' => [],
            ];
        }

        return [
            'CITY' => MetaData::valuesFor(MetaData::TYPE_CITY)->all(),
            'COUNTRY' => MetaData::valuesFor(MetaData::TYPE_COUNTRY)->all(),
            'PROJECT' => MetaData::valuesFor(MetaData::TYPE_PROJECT)->all(),
            'UNIT' => MetaData::valuesFor(MetaData::TYPE_UNIT)->all(),
            'AREA' => MetaData::valuesFor(MetaData::TYPE_AREA)->all(),
            'LINK' => MetaData::valuesFor(MetaData::TYPE_LINK)->all(),
            'DEPARTMENT' => MetaData::valuesFor(MetaData::TYPE_DEPARTMENT)->all(),
        ];
    }
}

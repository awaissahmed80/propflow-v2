<?php

namespace App\Http\Middleware;

use App\Models\MetaData;
use App\Models\Setting;
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
                'user' => $this->sharedAuthUser($request),
            ],
            'urls' => [
                'auth' => Domain::auth(),
                'portal' => Domain::portal(),
            ],
            'tenant' => [
                'current' => Tenant::current()?->only(['id', 'name', 'identifier']),
                'available' => $this->availableWorkspaces($request, $tenantContext),
                'impersonating' => $tenantContext->isImpersonating(),
                'impersonator' => $tenantContext->impersonator()?->only(['id', 'display_name', 'email_address']),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            // Always included so partial reloads keep meta lists fresh.
            'meta' => Inertia::always(fn (): array => $this->sharedMeta()),
            'currency' => Inertia::always(fn (): array => $this->sharedCurrency()),
        ];
    }

    /**
     * @return list<array{id: int, name: string, identifier: string|null}>
     */
    protected function availableWorkspaces(Request $request, TenantContext $tenantContext): array
    {
        $user = $request->user();

        if ($user === null || ! $user->isTenantUser()) {
            return [];
        }

        return $tenantContext->activeMembershipsFor($user)
            ->map(function ($membership): ?array {
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

    /**
     * @return array{code: string, symbol: string}
     */
    protected function sharedCurrency(): array
    {
        if (! Tenant::current()) {
            return [
                'code' => 'USD',
                'symbol' => '$',
            ];
        }

        $configuration = Setting::group(Setting::GROUP_CONFIGURATION, [
            'currency_code' => 'USD',
            'currency_symbol' => '$',
        ]);

        $code = strtoupper(trim((string) ($configuration['currency_code'] ?? 'USD')));
        $symbol = trim((string) ($configuration['currency_symbol'] ?? '$'));

        return [
            'code' => $code !== '' ? $code : 'USD',
            'symbol' => $symbol !== '' ? $symbol : '$',
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
                'UNIT_CATEGORY' => [],
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
            'UNIT_CATEGORY' => MetaData::unitCategoryOptions(),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    protected function sharedAuthUser(Request $request): ?array
    {
        $user = $request->user();

        if ($user === null) {
            return null;
        }

        $permissions = [];

        try {
            $permissions = $user->getAllPermissions()->pluck('name')->values()->all();
        } catch (\Throwable) {
            $permissions = [];
        }

        $tenant = Tenant::current();
        $membership = null;

        if ($tenant !== null) {
            $membership = $user->memberships()
                ->where('tenant_id', $tenant->id)
                ->first(['is_owner']);
        }

        return [
            'id' => $user->id,
            'display_name' => $user->display_name,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'email_address' => $user->email_address,
            'is_owner' => (bool) ($membership?->is_owner ?? false),
            'permissions' => $permissions,
        ];
    }
}

<?php

namespace App\Tenancy;

use App\Enums\TenantStatus;
use App\Models\Tenant;
use App\Services\TenantContext;
use Illuminate\Http\Request;
use Spatie\Multitenancy\Contracts\IsTenant;
use Spatie\Multitenancy\TenantFinder\TenantFinder;

class SessionTenantFinder extends TenantFinder
{
    public function findForRequest(Request $request): ?IsTenant
    {
        if (! $request->hasSession()) {
            return null;
        }

        $tenantId = $request->session()->get(TenantContext::SESSION_TENANT_ID);

        if (blank($tenantId)) {
            return null;
        }

        return Tenant::query()
            ->whereKey($tenantId)
            ->where('status', TenantStatus::Active)
            ->first();
    }
}

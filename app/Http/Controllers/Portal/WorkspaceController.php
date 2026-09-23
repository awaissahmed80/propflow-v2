<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\SelectWorkspaceRequest;
use App\Models\Tenant;
use App\Services\TenantContext;
use App\Support\Domain;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class WorkspaceController extends Controller
{
    public function switch(SelectWorkspaceRequest $request, TenantContext $tenantContext): Response
    {
        $tenant = Tenant::query()->findOrFail((int) $request->validated('tenant_id'));

        if ($tenantContext->currentTenantId() === $tenant->id) {
            return back();
        }

        $tenantContext->enter($tenant, $request->user());

        return Inertia::location(Domain::portal());
    }
}

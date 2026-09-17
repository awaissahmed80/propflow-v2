<?php

namespace Tests\Feature\Portal;

use App\Http\Middleware\EnsureTenantContext;
use Illuminate\Foundation\Http\Kernel;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Tests\TestCase;

class TenantMiddlewarePriorityTest extends TestCase
{
    public function test_tenant_context_runs_before_route_model_binding(): void
    {
        $priority = $this->app->make(Kernel::class)->getMiddlewarePriority();

        $tenantIndex = array_search(EnsureTenantContext::class, $priority, true);
        $bindingsIndex = array_search(SubstituteBindings::class, $priority, true);

        $this->assertNotFalse($tenantIndex);
        $this->assertNotFalse($bindingsIndex);
        $this->assertLessThan(
            $bindingsIndex,
            $tenantIndex,
            'EnsureTenantContext must run before SubstituteBindings so tenant models resolve against the selected database.'
        );
    }
}

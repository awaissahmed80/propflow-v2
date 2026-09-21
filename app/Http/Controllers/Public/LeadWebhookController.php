<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Support\LeadWebhooks\LeadWebhookReceiver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeadWebhookController extends Controller
{
    public function __construct(protected LeadWebhookReceiver $receiver) {}

    public function receive(Request $request, string $identifier): JsonResponse
    {
        $tenant = Tenant::query()->where('identifier', $identifier)->first();

        if (! $tenant) {
            abort(404);
        }

        $tenant->makeCurrent();

        try {
            return $this->receiver->handle($request);
        } finally {
            Tenant::forgetCurrent();
        }
    }
}

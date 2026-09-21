<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessMetaWebhook;
use App\Models\Integration;
use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class MetaWebhookController extends Controller
{
    /**
     * Meta webhook verification challenge.
     */
    public function verify(Request $request, string $identifier): Response|SymfonyResponse
    {
        $mode = $request->query('hub_mode');
        $token = $request->query('hub_verify_token');
        $challenge = $request->query('hub_challenge');

        if ($mode !== 'subscribe' || ! is_string($token) || ! is_string($challenge)) {
            abort(403);
        }

        $tenant = Tenant::query()->where('identifier', $identifier)->first();

        if (! $tenant) {
            abort(404);
        }

        $tenant->makeCurrent();

        try {
            $integration = Integration::query()
                ->where('provider', Integration::PROVIDER_META)
                ->where('status', Integration::STATUS_CONNECTED)
                ->first();

            $expected = $integration?->webhook_verify_token
                ?: config('services.meta.webhook_verify_token');

            if (! is_string($expected) || $expected === '' || ! hash_equals($expected, $token)) {
                abort(403);
            }

            return response($challenge, 200)->header('Content-Type', 'text/plain');
        } finally {
            Tenant::forgetCurrent();
        }
    }

    /**
     * Receive leadgen + messaging notifications from Meta.
     */
    public function receive(Request $request, string $identifier): Response
    {
        $tenant = Tenant::query()->where('identifier', $identifier)->first();

        if (! $tenant) {
            abort(404);
        }

        $appSecret = config('services.meta.app_secret');

        if (filled($appSecret) && ! $this->signatureIsValid($request, (string) $appSecret)) {
            abort(403);
        }

        $tenant->makeCurrent();

        try {
            $integration = Integration::query()
                ->where('provider', Integration::PROVIDER_META)
                ->where('status', Integration::STATUS_CONNECTED)
                ->first();

            if (! $integration) {
                abort(404);
            }

            ProcessMetaWebhook::dispatch($identifier, $request->all());

            return response('EVENT_RECEIVED', 200);
        } finally {
            Tenant::forgetCurrent();
        }
    }

    protected function signatureIsValid(Request $request, string $appSecret): bool
    {
        $header = $request->header('X-Hub-Signature-256');

        if (! is_string($header) || ! str_starts_with($header, 'sha256=')) {
            return false;
        }

        $expected = 'sha256='.hash_hmac('sha256', $request->getContent(), $appSecret);

        return hash_equals($expected, $header);
    }
}

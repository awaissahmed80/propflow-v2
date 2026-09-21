<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\UpdateMetaIntegrationRequest;
use App\Models\Integration;
use App\Models\LeadStage;
use App\Support\Domain;
use App\Support\Integrations\Meta\MetaGraphClient;
use App\Support\Integrations\Meta\MetaLeadSettings;
use App\Support\Integrations\Meta\MetaOAuthClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class MetaIntegrationController extends Controller
{
    public function __construct(
        protected MetaOAuthClient $meta,
        protected MetaGraphClient $graph,
    ) {}

    public function redirect(Request $request): RedirectResponse
    {
        if (! $this->meta->isConfigured()) {
            return redirect()
                ->to(Domain::portal('/settings/integrations'))
                ->with('error', 'Meta app credentials are missing. Add META_APP_ID and META_APP_SECRET to your environment.');
        }

        try {
            $authorization = $this->meta->authorizationRedirect();
        } catch (Throwable $exception) {
            Log::warning('Meta OAuth redirect failed', ['message' => $exception->getMessage()]);

            return redirect()
                ->to(Domain::portal('/settings/integrations'))
                ->with('error', $exception->getMessage());
        }

        $request->session()->put(MetaOAuthClient::SESSION_STATE_KEY, $authorization['state']);

        return redirect()->away($authorization['url']);
    }

    public function callback(Request $request): RedirectResponse
    {
        $settingsUrl = Domain::portal('/settings/integrations');

        if ($request->filled('error')) {
            $request->session()->forget(MetaOAuthClient::SESSION_STATE_KEY);

            $description = $request->string('error_description')->toString()
                ?: $request->string('error')->toString();

            return redirect()->to($settingsUrl)->with('error', $description ?: 'Meta authorization was cancelled.');
        }

        $expectedState = $request->session()->pull(MetaOAuthClient::SESSION_STATE_KEY);
        $state = $request->string('state')->toString();
        $code = $request->string('code')->toString();

        if (! is_string($expectedState) || $expectedState === '' || ! hash_equals($expectedState, $state) || $code === '') {
            return redirect()->to($settingsUrl)->with('error', 'Meta authorization state was invalid. Please try connecting again.');
        }

        try {
            $result = $this->meta->completeAuthorization($code);
        } catch (Throwable $exception) {
            Log::warning('Meta OAuth callback failed', ['message' => $exception->getMessage()]);

            return redirect()->to($settingsUrl)->with('error', $exception->getMessage());
        }

        if ($result['pages'] === []) {
            return redirect()
                ->to($settingsUrl)
                ->with('error', 'No Facebook Pages were returned. Make sure your Facebook account manages at least one Page and granted Page permissions.');
        }

        $pages = $this->meta->encryptPageTokens($result['pages']);
        $primary = $pages[0];

        $integration = Integration::query()->firstOrNew([
            'provider' => Integration::PROVIDER_META,
        ]);

        $verifyToken = $integration->webhook_verify_token
            ?: (config('services.meta.webhook_verify_token') ?: Str::random(32));

        try {
            $primaryToken = $this->meta->decryptPageToken($primary['access_token']);
        } catch (Throwable $exception) {
            return redirect()->to($settingsUrl)->with('error', 'Unable to store Page tokens. Please try connecting again.');
        }

        $defaultStageId = LeadStage::query()->where('label', 'new')->value('id')
            ?? LeadStage::query()->orderBy('priority')->value('id');

        $existingLeadSettings = data_get($integration->settings, 'lead_settings');
        $leadSettings = MetaLeadSettings::normalize(
            is_array($existingLeadSettings) ? $existingLeadSettings : null,
            $defaultStageId ? (int) $defaultStageId : null,
        );

        $integration->fill([
            'status' => Integration::STATUS_CONNECTED,
            'external_id' => $primary['id'],
            'external_name' => $primary['name'],
            'access_token' => $primaryToken,
            'refresh_token' => $result['user_access_token'],
            'webhook_verify_token' => $verifyToken,
            'last_error' => null,
            'settings' => [
                'connected_via' => 'facebook_login',
                'meta_user_id' => $result['user']['id'],
                'meta_user_name' => $result['user']['name'],
                'scopes' => $this->meta->scopes(),
                'pages' => $pages,
                'primary_page_id' => $primary['id'],
                'lead_settings' => $leadSettings,
            ],
        ]);
        $integration->save();

        $pageCount = count($pages);
        $message = $pageCount === 1
            ? 'Meta connected — synced '.$primary['name'].'.'
            : 'Meta connected — synced '.$pageCount.' Pages. Primary: '.$primary['name'].'.';

        return redirect()
            ->to($settingsUrl)
            ->with('success', $message)
            ->with('open_meta_config', true);
    }

    public function forms(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page_id' => ['required', 'string', 'max:100'],
        ]);

        $integration = Integration::query()
            ->where('provider', Integration::PROVIDER_META)
            ->where('status', Integration::STATUS_CONNECTED)
            ->first();

        if (! $integration) {
            return response()->json([
                'message' => 'Connect Meta before loading lead forms.',
            ], 422);
        }

        $pageId = $validated['page_id'];
        $pageToken = $this->pageAccessToken($integration, $pageId);

        if ($pageToken === null) {
            return response()->json([
                'message' => 'That Facebook Page is not available on this Meta connection.',
            ], 422);
        }

        try {
            $forms = $this->graph->fetchLeadgenForms($pageId, $pageToken);
        } catch (Throwable $exception) {
            Log::warning('Meta lead forms fetch failed', [
                'page_id' => $pageId,
                'message' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }

        return response()->json([
            'forms' => $forms,
        ]);
    }

    public function update(UpdateMetaIntegrationRequest $request): RedirectResponse
    {
        $integration = Integration::query()
            ->where('provider', Integration::PROVIDER_META)
            ->where('status', Integration::STATUS_CONNECTED)
            ->first();

        if (! $integration) {
            return back()->with('error', 'Connect Meta before saving configuration.');
        }

        $settings = $integration->settings ?? [];
        $settings['lead_settings'] = $request->leadSettings();

        $pageId = $request->validated('page_id');

        if (filled($pageId)) {
            /** @var list<array{id: string, name: string, access_token: string, tasks?: list<string>}> $pages */
            $pages = data_get($settings, 'pages', []);
            $selected = collect($pages)->firstWhere('id', $pageId);

            if (! $selected) {
                return back()->withErrors(['page_id' => 'That Page is not available on this Meta connection.']);
            }

            try {
                $pageToken = $this->meta->decryptPageToken($selected['access_token']);
            } catch (Throwable $exception) {
                return back()->with('error', 'Unable to read the selected Page token. Please reconnect Meta.');
            }

            $settings['primary_page_id'] = $selected['id'];

            $integration->forceFill([
                'external_id' => $selected['id'],
                'external_name' => $selected['name'],
                'access_token' => $pageToken,
                'settings' => $settings,
                'last_error' => null,
            ])->save();
        } else {
            $integration->forceFill([
                'settings' => $settings,
                'last_error' => null,
            ])->save();
        }

        return back()->with('success', 'Meta Lead Ads settings saved.');
    }

    public function disconnect(): RedirectResponse
    {
        $integration = Integration::query()
            ->where('provider', Integration::PROVIDER_META)
            ->first();

        if ($integration) {
            $integration->forceFill([
                'status' => Integration::STATUS_INACTIVE,
                'access_token' => null,
                'refresh_token' => null,
                'external_id' => null,
                'external_name' => null,
                'last_error' => null,
                'settings' => [
                    'connected_via' => 'facebook_login',
                ],
            ])->save();
        }

        return back()->with('success', 'Meta disconnected.');
    }

    protected function pageAccessToken(Integration $integration, string $pageId): ?string
    {
        if ($integration->external_id === $pageId && filled($integration->access_token)) {
            return $integration->access_token;
        }

        /** @var list<array{id: string, access_token?: string}> $pages */
        $pages = data_get($integration->settings, 'pages', []);

        foreach ($pages as $page) {
            if (($page['id'] ?? null) !== $pageId || blank($page['access_token'] ?? null)) {
                continue;
            }

            try {
                return $this->meta->decryptPageToken($page['access_token']);
            } catch (Throwable) {
                return null;
            }
        }

        return filled($integration->access_token) ? $integration->access_token : null;
    }
}

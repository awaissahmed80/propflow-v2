<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\UpdateWhatsAppIntegrationRequest;
use App\Models\Integration;
use App\Models\LeadStage;
use App\Support\Domain;
use App\Support\Integrations\WhatsApp\WhatsAppGraphClient;
use App\Support\Integrations\WhatsApp\WhatsAppLeadSettings;
use App\Support\Integrations\WhatsApp\WhatsAppOAuthClient;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class WhatsAppIntegrationController extends Controller
{
    public function __construct(
        protected WhatsAppOAuthClient $whatsapp,
        protected WhatsAppGraphClient $graph,
    ) {}

    public function redirect(Request $request): RedirectResponse
    {
        if (! $this->whatsapp->isConfigured()) {
            return redirect()
                ->to(Domain::portal('/settings/integrations'))
                ->with('error', 'WhatsApp app credentials are missing. Add META_APP_ID / META_APP_SECRET (or WHATSAPP_*) to your environment.');
        }

        try {
            $authorization = $this->whatsapp->authorizationRedirect();
        } catch (Throwable $exception) {
            Log::warning('WhatsApp OAuth redirect failed', ['message' => $exception->getMessage()]);

            return redirect()
                ->to(Domain::portal('/settings/integrations'))
                ->with('error', $exception->getMessage());
        }

        $request->session()->put(WhatsAppOAuthClient::SESSION_STATE_KEY, $authorization['state']);

        return redirect()->away($authorization['url']);
    }

    public function callback(Request $request): RedirectResponse
    {
        $settingsUrl = Domain::portal('/settings/integrations');

        if ($request->filled('error')) {
            $request->session()->forget(WhatsAppOAuthClient::SESSION_STATE_KEY);

            $description = $request->string('error_description')->toString()
                ?: $request->string('error')->toString();

            return redirect()->to($settingsUrl)->with('error', $description ?: 'WhatsApp authorization was cancelled.');
        }

        $expectedState = $request->session()->pull(WhatsAppOAuthClient::SESSION_STATE_KEY);
        $state = $request->string('state')->toString();
        $code = $request->string('code')->toString();

        if (! is_string($expectedState) || $expectedState === '' || ! hash_equals($expectedState, $state) || $code === '') {
            return redirect()->to($settingsUrl)->with('error', 'WhatsApp authorization state was invalid. Please try connecting again.');
        }

        try {
            $result = $this->whatsapp->completeAuthorization($code);
        } catch (Throwable $exception) {
            Log::warning('WhatsApp OAuth callback failed', ['message' => $exception->getMessage()]);

            return redirect()->to($settingsUrl)->with('error', $exception->getMessage());
        }

        $phones = $this->whatsapp->phonesForPublic($result['wabas']);

        if ($phones === []) {
            return redirect()
                ->to($settingsUrl)
                ->with('error', 'No WhatsApp phone numbers were returned. Make sure your Meta Business has a WhatsApp Business Account with at least one phone number.');
        }

        $primaryPhone = $phones[0];
        $primaryWaba = collect($result['wabas'])->firstWhere('id', $primaryPhone['waba_id'])
            ?? $result['wabas'][0];

        $integration = Integration::query()->firstOrNew([
            'provider' => Integration::PROVIDER_WHATSAPP,
        ]);

        $verifyToken = $integration->webhook_verify_token
            ?: (config('services.whatsapp.webhook_verify_token') ?: Str::random(32));

        $defaultStageId = LeadStage::defaultStageId();

        $existingLeadSettings = data_get($integration->settings, 'lead_settings');
        $leadSettings = WhatsAppLeadSettings::normalize(
            is_array($existingLeadSettings) ? $existingLeadSettings : null,
            $defaultStageId ? (int) $defaultStageId : null,
        );

        try {
            $this->graph->subscribedFields($primaryWaba['id'], $result['user_access_token']);
        } catch (Throwable $exception) {
            Log::warning('WhatsApp WABA webhook subscribe failed', [
                'waba_id' => $primaryWaba['id'],
                'message' => $exception->getMessage(),
            ]);
        }

        $integration->fill([
            'status' => Integration::STATUS_CONNECTED,
            'external_id' => $primaryPhone['id'],
            'external_name' => $primaryPhone['verified_name']
                ?: $primaryPhone['display_phone_number'],
            'access_token' => $result['user_access_token'],
            'refresh_token' => null,
            'webhook_verify_token' => $verifyToken,
            'last_error' => null,
            'settings' => [
                'connected_via' => 'facebook_login',
                'billing_disclaimer' => true,
                'meta_user_id' => $result['user']['id'],
                'meta_user_name' => $result['user']['name'],
                'scopes' => $this->whatsapp->scopes(),
                'wabas' => $this->whatsapp->wabasForPublic($result['wabas']),
                'primary_phone_number_id' => $primaryPhone['id'],
                'primary_waba_id' => $primaryWaba['id'],
                'lead_settings' => $leadSettings,
            ],
        ]);
        $integration->save();

        $phoneCount = count($phones);
        $message = $phoneCount === 1
            ? 'WhatsApp connected — '.$primaryPhone['display_phone_number'].'.'
            : 'WhatsApp connected — synced '.$phoneCount.' phone numbers. Primary: '.$primaryPhone['display_phone_number'].'.';

        return redirect()
            ->to($settingsUrl)
            ->with('success', $message)
            ->with('open_whatsapp_config', true);
    }

    public function update(UpdateWhatsAppIntegrationRequest $request): RedirectResponse
    {
        $integration = Integration::query()
            ->where('provider', Integration::PROVIDER_WHATSAPP)
            ->where('status', Integration::STATUS_CONNECTED)
            ->first();

        if (! $integration) {
            return back()->with('error', 'Connect WhatsApp before saving configuration.');
        }

        $settings = $integration->settings ?? [];
        $settings['lead_settings'] = $request->leadSettings();

        $phoneNumberId = $request->validated('phone_number_id');

        if (filled($phoneNumberId)) {
            $phones = app(WhatsAppOAuthClient::class)->phonesForPublic(
                is_array(data_get($settings, 'wabas')) ? data_get($settings, 'wabas') : []
            );
            $selected = collect($phones)->firstWhere('id', $phoneNumberId);

            if (! $selected) {
                return back()->withErrors(['phone_number_id' => 'That WhatsApp number is not available on this connection.']);
            }

            $settings['primary_phone_number_id'] = $selected['id'];
            $settings['primary_waba_id'] = $selected['waba_id'];

            $integration->forceFill([
                'external_id' => $selected['id'],
                'external_name' => $selected['verified_name'] ?: $selected['display_phone_number'],
                'settings' => $settings,
                'last_error' => null,
            ])->save();
        } else {
            $integration->forceFill([
                'settings' => $settings,
                'last_error' => null,
            ])->save();
        }

        return back()->with('success', 'WhatsApp settings saved.');
    }

    public function disconnect(): RedirectResponse
    {
        $integration = Integration::query()
            ->where('provider', Integration::PROVIDER_WHATSAPP)
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
                    'billing_disclaimer' => true,
                ],
            ])->save();
        }

        return back()->with('success', 'WhatsApp disconnected.');
    }
}

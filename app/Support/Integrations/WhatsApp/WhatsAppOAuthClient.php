<?php

namespace App\Support\Integrations\WhatsApp;

use App\Support\Domain;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class WhatsAppOAuthClient
{
    public const SESSION_STATE_KEY = 'whatsapp_oauth_state';

    /**
     * Permissions allowed for WhatsApp connect. Page / Instagram / Lead Ads
     * scopes are never requested on this flow, even if misconfigured in env.
     *
     * @var list<string>
     */
    public const ALLOWED_SCOPES = [
        'whatsapp_business_management',
        'whatsapp_business_messaging',
        'business_management',
    ];

    public function isConfigured(): bool
    {
        return filled(config('services.whatsapp.app_id'))
            && filled(config('services.whatsapp.app_secret'));
    }

    public function redirectUri(): string
    {
        $configured = config('services.whatsapp.redirect');

        if (filled($configured)) {
            return (string) $configured;
        }

        return Domain::portal('/settings/integrations/whatsapp/callback');
    }

    /**
     * @return list<string>
     */
    public function scopes(): array
    {
        /** @var list<string> $configured */
        $configured = config('services.whatsapp.scopes', []);

        $scopes = array_values(array_filter(
            array_map(
                static fn (mixed $scope): string => trim((string) $scope),
                is_array($configured) ? $configured : []
            ),
            fn (string $scope): bool => $scope !== '' && in_array($scope, self::ALLOWED_SCOPES, true)
        ));

        if ($scopes === []) {
            return self::ALLOWED_SCOPES;
        }

        return array_values(array_unique($scopes));
    }

    public function graphVersion(): string
    {
        return (string) config('services.whatsapp.graph_version', 'v21.0');
    }

    /**
     * @return array{url: string, state: string}
     */
    public function authorizationRedirect(): array
    {
        $this->ensureConfigured();

        $state = Str::random(40);

        // WhatsApp-only Login: never send Page / Instagram / Lead Ads scopes.
        // auth_type=rerequest forces Facebook to show only the scopes below,
        // instead of re-listing previously granted Meta Lead Ads permissions.
        $params = [
            'client_id' => config('services.whatsapp.app_id'),
            'redirect_uri' => $this->redirectUri(),
            'state' => $state,
            'scope' => implode(',', $this->scopes()),
            'response_type' => 'code',
            'auth_type' => 'rerequest',
        ];

        // Only use a Login for Business / Embedded Signup config that is
        // WhatsApp-only. A shared Meta Lead Ads config_id would request Pages/IG.
        $configId = config('services.whatsapp.config_id');

        if (filled($configId)) {
            $params['config_id'] = $configId;
            $params['override_default_response_type'] = 'true';
            $params['extras'] = json_encode([
                'setup' => new \stdClass,
                'featureType' => 'whatsapp_business_app_onboarding',
                'sessionInfoVersion' => '3',
            ], JSON_THROW_ON_ERROR);
        }

        $url = 'https://www.facebook.com/'.$this->graphVersion().'/dialog/oauth?'.http_build_query($params);

        return ['url' => $url, 'state' => $state];
    }

    /**
     * @return array{
     *     user: array{id: string, name: ?string},
     *     user_access_token: string,
     *     wabas: list<array{
     *         id: string,
     *         name: ?string,
     *         phone_numbers: list<array{
     *             id: string,
     *             display_phone_number: string,
     *             verified_name: ?string,
     *             quality_rating: ?string
     *         }>
     *     }>
     * }
     */
    public function completeAuthorization(string $code): array
    {
        $this->ensureConfigured();

        $shortLived = $this->exchangeCodeForToken($code);
        $longLived = $this->exchangeForLongLivedToken($shortLived);
        $user = $this->fetchUser($longLived);
        $wabas = $this->fetchWhatsAppBusinessAccounts($longLived);

        return [
            'user' => $user,
            'user_access_token' => $longLived,
            'wabas' => $wabas,
        ];
    }

    /**
     * @param  list<array{
     *     id: string,
     *     name: ?string,
     *     phone_numbers: list<array{
     *         id: string,
     *         display_phone_number: string,
     *         verified_name: ?string,
     *         quality_rating: ?string
     *     }>
     * }>  $wabas
     * @return list<array{
     *     id: string,
     *     name: ?string,
     *     phone_numbers: list<array{
     *         id: string,
     *         display_phone_number: string,
     *         verified_name: ?string,
     *         quality_rating: ?string
     *     }>
     * }>
     */
    public function wabasForPublic(array $wabas): array
    {
        return array_map(function (array $waba): array {
            return [
                'id' => (string) $waba['id'],
                'name' => isset($waba['name']) && is_string($waba['name']) ? $waba['name'] : null,
                'phone_numbers' => array_values(array_map(function (array $phone): array {
                    return [
                        'id' => (string) $phone['id'],
                        'display_phone_number' => (string) $phone['display_phone_number'],
                        'verified_name' => isset($phone['verified_name']) && is_string($phone['verified_name'])
                            ? $phone['verified_name']
                            : null,
                        'quality_rating' => isset($phone['quality_rating']) && is_string($phone['quality_rating'])
                            ? $phone['quality_rating']
                            : null,
                    ];
                }, $waba['phone_numbers'] ?? [])),
            ];
        }, $wabas);
    }

    /**
     * Flatten WABAs into campaign phone options.
     *
     * @param  list<array{
     *     id: string,
     *     name: ?string,
     *     phone_numbers: list<array{
     *         id: string,
     *         display_phone_number: string,
     *         verified_name: ?string,
     *         quality_rating: ?string
     *     }>
     * }>  $wabas
     * @return list<array{
     *     id: string,
     *     display_phone_number: string,
     *     verified_name: ?string,
     *     waba_id: string,
     *     waba_name: ?string
     * }>
     */
    public function phonesForPublic(array $wabas): array
    {
        $phones = [];

        foreach ($wabas as $waba) {
            foreach ($waba['phone_numbers'] ?? [] as $phone) {
                $phones[] = [
                    'id' => (string) $phone['id'],
                    'display_phone_number' => (string) $phone['display_phone_number'],
                    'verified_name' => isset($phone['verified_name']) && is_string($phone['verified_name'])
                        ? $phone['verified_name']
                        : null,
                    'waba_id' => (string) $waba['id'],
                    'waba_name' => isset($waba['name']) && is_string($waba['name']) ? $waba['name'] : null,
                ];
            }
        }

        return $phones;
    }

    protected function exchangeCodeForToken(string $code): string
    {
        $response = Http::asForm()
            ->acceptJson()
            ->get($this->graphUrl('/oauth/access_token'), [
                'client_id' => config('services.whatsapp.app_id'),
                'client_secret' => config('services.whatsapp.app_secret'),
                'redirect_uri' => $this->redirectUri(),
                'code' => $code,
            ]);

        $this->throwIfFailed($response, 'Unable to exchange WhatsApp authorization code.');

        $token = $response->json('access_token');

        if (! is_string($token) || $token === '') {
            throw new RuntimeException('WhatsApp did not return an access token.');
        }

        return $token;
    }

    protected function exchangeForLongLivedToken(string $shortLivedToken): string
    {
        $response = Http::acceptJson()->get($this->graphUrl('/oauth/access_token'), [
            'grant_type' => 'fb_exchange_token',
            'client_id' => config('services.whatsapp.app_id'),
            'client_secret' => config('services.whatsapp.app_secret'),
            'fb_exchange_token' => $shortLivedToken,
        ]);

        $this->throwIfFailed($response, 'Unable to exchange WhatsApp long-lived token.');

        $token = $response->json('access_token');

        if (! is_string($token) || $token === '') {
            throw new RuntimeException('WhatsApp did not return a long-lived access token.');
        }

        return $token;
    }

    /**
     * @return array{id: string, name: ?string}
     */
    protected function fetchUser(string $userAccessToken): array
    {
        $response = Http::acceptJson()->get($this->graphUrl('/me'), [
            'fields' => 'id,name',
            'access_token' => $userAccessToken,
        ]);

        $this->throwIfFailed($response, 'Unable to fetch WhatsApp user profile.');

        $id = $response->json('id');

        if (! is_string($id) || $id === '') {
            throw new RuntimeException('WhatsApp user profile was incomplete.');
        }

        $name = $response->json('name');

        return [
            'id' => $id,
            'name' => is_string($name) ? $name : null,
        ];
    }

    /**
     * @return list<array{
     *     id: string,
     *     name: ?string,
     *     phone_numbers: list<array{
     *         id: string,
     *         display_phone_number: string,
     *         verified_name: ?string,
     *         quality_rating: ?string
     *     }>
     * }>
     */
    protected function fetchWhatsAppBusinessAccounts(string $userAccessToken): array
    {
        $response = Http::acceptJson()->get($this->graphUrl('/me/businesses'), [
            'fields' => 'id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name,quality_rating}}',
            'access_token' => $userAccessToken,
            'limit' => 100,
        ]);

        $this->throwIfFailed($response, 'Unable to fetch WhatsApp Business accounts.');

        /** @var list<array<string, mixed>> $businesses */
        $businesses = $response->json('data') ?? [];
        $wabas = [];

        foreach ($businesses as $business) {
            $owned = data_get($business, 'owned_whatsapp_business_accounts.data', []);

            if (! is_array($owned)) {
                continue;
            }

            foreach ($owned as $waba) {
                if (! is_array($waba)) {
                    continue;
                }

                $id = $waba['id'] ?? null;

                if (! is_string($id) || $id === '') {
                    continue;
                }

                $phones = [];
                $phoneData = data_get($waba, 'phone_numbers.data', $waba['phone_numbers'] ?? []);

                if (! is_array($phoneData)) {
                    $phoneData = [];
                }

                foreach ($phoneData as $phone) {
                    if (! is_array($phone)) {
                        continue;
                    }

                    $phoneId = $phone['id'] ?? null;
                    $display = $phone['display_phone_number'] ?? null;

                    if (! is_string($phoneId) || $phoneId === '' || ! is_string($display) || $display === '') {
                        continue;
                    }

                    $phones[] = [
                        'id' => $phoneId,
                        'display_phone_number' => $display,
                        'verified_name' => is_string($phone['verified_name'] ?? null) ? $phone['verified_name'] : null,
                        'quality_rating' => is_string($phone['quality_rating'] ?? null) ? $phone['quality_rating'] : null,
                    ];
                }

                $wabas[] = [
                    'id' => $id,
                    'name' => is_string($waba['name'] ?? null) ? $waba['name'] : null,
                    'phone_numbers' => $phones,
                ];
            }
        }

        return $wabas;
    }

    protected function graphUrl(string $path): string
    {
        return 'https://graph.facebook.com/'.$this->graphVersion().'/'.ltrim($path, '/');
    }

    /**
     * @param  Response  $response
     */
    protected function throwIfFailed($response, string $fallback): void
    {
        if ($response->successful()) {
            return;
        }

        $message = data_get($response->json(), 'error.message');

        throw new RuntimeException(is_string($message) && $message !== '' ? $message : $fallback);
    }

    protected function ensureConfigured(): void
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException('WhatsApp app credentials are not configured.');
        }
    }
}

<?php

namespace App\Support\Integrations\Meta;

use App\Support\Domain;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class MetaOAuthClient
{
    public const SESSION_STATE_KEY = 'meta_oauth_state';

    public function isConfigured(): bool
    {
        return filled(config('services.meta.app_id'))
            && filled(config('services.meta.app_secret'));
    }

    public function redirectUri(): string
    {
        $configured = config('services.meta.redirect');

        if (filled($configured)) {
            return (string) $configured;
        }

        return Domain::portal('/settings/integrations/meta/callback');
    }

    /**
     * @return list<string>
     */
    public function scopes(): array
    {
        /** @var list<string> $scopes */
        $scopes = config('services.meta.scopes', []);

        return $scopes;
    }

    public function graphVersion(): string
    {
        return (string) config('services.meta.graph_version', 'v21.0');
    }

    /**
     * @return array{url: string, state: string}
     */
    public function authorizationRedirect(): array
    {
        $this->ensureConfigured();

        $state = Str::random(40);

        $url = 'https://www.facebook.com/'.$this->graphVersion().'/dialog/oauth?'.http_build_query([
            'client_id' => config('services.meta.app_id'),
            'redirect_uri' => $this->redirectUri(),
            'state' => $state,
            'scope' => implode(',', $this->scopes()),
            'response_type' => 'code',
        ]);

        return ['url' => $url, 'state' => $state];
    }

    /**
     * Exchange the OAuth code for a long-lived user token and permitted pages.
     *
     * @return array{
     *     user: array{id: string, name: ?string},
     *     user_access_token: string,
     *     pages: list<array{
     *         id: string,
     *         name: string,
     *         access_token: string,
     *         tasks: list<string>,
     *         instagram: ?array{id: string, username: ?string, name: ?string}
     *     }>
     * }
     */
    public function completeAuthorization(string $code): array
    {
        $this->ensureConfigured();

        $shortLived = $this->exchangeCodeForToken($code);
        $longLived = $this->exchangeForLongLivedToken($shortLived);
        $user = $this->fetchUser($longLived);
        $pages = $this->fetchPages($longLived);

        return [
            'user' => $user,
            'user_access_token' => $longLived,
            'pages' => $pages,
        ];
    }

    /**
     * @param  list<array{id: string, name: string, access_token: string, tasks?: list<string>, instagram?: ?array{id: string, username: ?string, name: ?string}}>  $pages
     * @return list<array{id: string, name: string, access_token: string, tasks: list<string>, instagram: ?array{id: string, username: ?string, name: ?string}}>
     */
    public function encryptPageTokens(array $pages): array
    {
        return array_map(function (array $page): array {
            return [
                'id' => $page['id'],
                'name' => $page['name'],
                'tasks' => array_values($page['tasks'] ?? []),
                'instagram' => $page['instagram'] ?? null,
                'access_token' => Crypt::encryptString($page['access_token']),
            ];
        }, $pages);
    }

    /**
     * @param  list<array{id: string, name: string, access_token?: string, tasks?: list<string>, instagram?: ?array{id: string, username: ?string, name: ?string}}>  $pages
     * @return list<array{id: string, name: string, tasks: list<string>, instagram: ?array{id: string, username: ?string, name: ?string}}>
     */
    public function pagesForPublic(array $pages): array
    {
        return array_map(function (array $page): array {
            $instagram = null;

            if (isset($page['instagram']) && is_array($page['instagram']) && filled($page['instagram']['id'] ?? null)) {
                $instagram = [
                    'id' => (string) $page['instagram']['id'],
                    'username' => isset($page['instagram']['username']) && is_string($page['instagram']['username'])
                        ? $page['instagram']['username']
                        : null,
                    'name' => isset($page['instagram']['name']) && is_string($page['instagram']['name'])
                        ? $page['instagram']['name']
                        : null,
                ];
            }

            return [
                'id' => (string) $page['id'],
                'name' => (string) $page['name'],
                'tasks' => array_values($page['tasks'] ?? []),
                'instagram' => $instagram,
            ];
        }, $pages);
    }

    public function decryptPageToken(string $encrypted): string
    {
        return Crypt::decryptString($encrypted);
    }

    protected function exchangeCodeForToken(string $code): string
    {
        $response = Http::asForm()
            ->acceptJson()
            ->get($this->graphUrl('/oauth/access_token'), [
                'client_id' => config('services.meta.app_id'),
                'client_secret' => config('services.meta.app_secret'),
                'redirect_uri' => $this->redirectUri(),
                'code' => $code,
            ]);

        $this->throwIfFailed($response, 'Unable to exchange Meta authorization code.');

        $token = $response->json('access_token');

        if (! is_string($token) || $token === '') {
            throw new RuntimeException('Meta did not return an access token.');
        }

        return $token;
    }

    protected function exchangeForLongLivedToken(string $shortLivedToken): string
    {
        $response = Http::acceptJson()->get($this->graphUrl('/oauth/access_token'), [
            'grant_type' => 'fb_exchange_token',
            'client_id' => config('services.meta.app_id'),
            'client_secret' => config('services.meta.app_secret'),
            'fb_exchange_token' => $shortLivedToken,
        ]);

        $this->throwIfFailed($response, 'Unable to exchange Meta long-lived token.');

        $token = $response->json('access_token');

        if (! is_string($token) || $token === '') {
            throw new RuntimeException('Meta did not return a long-lived access token.');
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

        $this->throwIfFailed($response, 'Unable to fetch Meta user profile.');

        $id = $response->json('id');

        if (! is_string($id) || $id === '') {
            throw new RuntimeException('Meta user profile was incomplete.');
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
     *     name: string,
     *     access_token: string,
     *     tasks: list<string>,
     *     instagram: ?array{id: string, username: ?string, name: ?string}
     * }>
     */
    protected function fetchPages(string $userAccessToken): array
    {
        $response = Http::acceptJson()->get($this->graphUrl('/me/accounts'), [
            'fields' => 'id,name,access_token,tasks,instagram_business_account{id,username,name}',
            'access_token' => $userAccessToken,
            'limit' => 100,
        ]);

        $this->throwIfFailed($response, 'Unable to fetch Meta pages.');

        /** @var list<array<string, mixed>> $data */
        $data = $response->json('data') ?? [];

        $pages = [];

        foreach ($data as $page) {
            $id = $page['id'] ?? null;
            $name = $page['name'] ?? null;
            $token = $page['access_token'] ?? null;

            if (! is_string($id) || $id === '' || ! is_string($name) || ! is_string($token) || $token === '') {
                continue;
            }

            $tasks = $page['tasks'] ?? [];
            $instagram = null;
            $igAccount = $page['instagram_business_account'] ?? null;

            if (is_array($igAccount) && is_string($igAccount['id'] ?? null) && $igAccount['id'] !== '') {
                $instagram = [
                    'id' => $igAccount['id'],
                    'username' => is_string($igAccount['username'] ?? null) ? $igAccount['username'] : null,
                    'name' => is_string($igAccount['name'] ?? null) ? $igAccount['name'] : null,
                ];
            }

            $pages[] = [
                'id' => $id,
                'name' => $name,
                'access_token' => $token,
                'tasks' => is_array($tasks)
                    ? array_values(array_filter($tasks, 'is_string'))
                    : [],
                'instagram' => $instagram,
            ];
        }

        return $pages;
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
            throw new RuntimeException('Meta app credentials are not configured.');
        }
    }
}

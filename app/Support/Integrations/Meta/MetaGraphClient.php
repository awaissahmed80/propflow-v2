<?php

namespace App\Support\Integrations\Meta;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class MetaGraphClient
{
    public function graphVersion(): string
    {
        return (string) config('services.meta.graph_version', 'v21.0');
    }

    /**
     * @return array{
     *     id: string,
     *     created_time?: string,
     *     ad_id?: string,
     *     form_id?: string,
     *     field_data: list<array{name: string, values: list<string>}>
     * }
     */
    public function fetchLead(string $leadgenId, string $pageAccessToken): array
    {
        $response = Http::acceptJson()->get($this->graphUrl('/'.$leadgenId), [
            'fields' => 'id,created_time,ad_id,form_id,field_data',
            'access_token' => $pageAccessToken,
        ]);

        $this->throwIfFailed($response, 'Unable to fetch Meta lead.');

        $id = $response->json('id');

        if (! is_string($id) || $id === '') {
            throw new RuntimeException('Meta lead payload was incomplete.');
        }

        /** @var list<array{name?: mixed, values?: mixed}> $fieldData */
        $fieldData = $response->json('field_data') ?? [];

        return [
            'id' => $id,
            'created_time' => is_string($response->json('created_time')) ? $response->json('created_time') : null,
            'ad_id' => is_string($response->json('ad_id')) ? $response->json('ad_id') : null,
            'form_id' => is_string($response->json('form_id')) ? $response->json('form_id') : null,
            'field_data' => array_values(array_filter(array_map(function (array $field): ?array {
                $name = $field['name'] ?? null;
                $values = $field['values'] ?? [];

                if (! is_string($name) || $name === '' || ! is_array($values)) {
                    return null;
                }

                return [
                    'name' => $name,
                    'values' => array_values(array_filter($values, 'is_string')),
                ];
            }, $fieldData))),
        ];
    }

    /**
     * @return list<array{id: string, name: string, status: ?string, leads_count: int}>
     */
    public function fetchLeadgenForms(string $pageId, string $pageAccessToken): array
    {
        $response = Http::acceptJson()->get($this->graphUrl('/'.$pageId.'/leadgen_forms'), [
            'fields' => 'id,name,status,leads_count',
            'access_token' => $pageAccessToken,
            'limit' => 100,
        ]);

        $this->throwIfFailed($response, 'Unable to fetch Meta lead forms.');

        /** @var list<array<string, mixed>> $data */
        $data = $response->json('data') ?? [];
        $forms = [];

        foreach ($data as $form) {
            $id = $form['id'] ?? null;
            $name = $form['name'] ?? null;

            if (! is_string($id) || $id === '' || ! is_string($name) || $name === '') {
                continue;
            }

            $forms[] = [
                'id' => $id,
                'name' => $name,
                'status' => is_string($form['status'] ?? null) ? $form['status'] : null,
                'leads_count' => (int) ($form['leads_count'] ?? 0),
            ];
        }

        return $forms;
    }

    /**
     * @return array{id: string, username: ?string, name: ?string}|null
     */
    public function fetchPageInstagramAccount(string $pageId, string $pageAccessToken): ?array
    {
        $response = Http::acceptJson()->get($this->graphUrl('/'.$pageId), [
            'fields' => 'instagram_business_account{id,username,name}',
            'access_token' => $pageAccessToken,
        ]);

        if (! $response->successful()) {
            return null;
        }

        $account = $response->json('instagram_business_account');

        if (! is_array($account) || ! is_string($account['id'] ?? null) || $account['id'] === '') {
            return null;
        }

        return [
            'id' => $account['id'],
            'username' => is_string($account['username'] ?? null) ? $account['username'] : null,
            'name' => is_string($account['name'] ?? null) ? $account['name'] : null,
        ];
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
}

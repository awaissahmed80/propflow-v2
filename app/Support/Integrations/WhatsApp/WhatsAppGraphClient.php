<?php

namespace App\Support\Integrations\WhatsApp;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class WhatsAppGraphClient
{
    public function graphVersion(): string
    {
        return (string) config('services.whatsapp.graph_version', 'v21.0');
    }

    /**
     * Subscribe the WABA to the app's webhook for inbound messages.
     *
     * @return list<string>
     */
    public function subscribedFields(string $wabaId, string $accessToken): array
    {
        $response = Http::asForm()->acceptJson()->post($this->graphUrl('/'.$wabaId.'/subscribed_apps'), [
            'access_token' => $accessToken,
        ]);

        $this->throwIfFailed($response, 'Unable to subscribe WhatsApp Business account to webhooks.');

        return ['messages'];
    }

    /**
     * @return list<array{
     *     id: string,
     *     display_phone_number: string,
     *     verified_name: ?string,
     *     quality_rating: ?string
     * }>
     */
    public function fetchPhoneNumbers(string $wabaId, string $accessToken): array
    {
        $response = Http::acceptJson()->get($this->graphUrl('/'.$wabaId.'/phone_numbers'), [
            'fields' => 'id,display_phone_number,verified_name,quality_rating',
            'access_token' => $accessToken,
        ]);

        $this->throwIfFailed($response, 'Unable to fetch WhatsApp phone numbers.');

        /** @var list<array<string, mixed>> $data */
        $data = $response->json('data') ?? [];
        $phones = [];

        foreach ($data as $phone) {
            $id = $phone['id'] ?? null;
            $display = $phone['display_phone_number'] ?? null;

            if (! is_string($id) || $id === '' || ! is_string($display) || $display === '') {
                continue;
            }

            $phones[] = [
                'id' => $id,
                'display_phone_number' => $display,
                'verified_name' => is_string($phone['verified_name'] ?? null) ? $phone['verified_name'] : null,
                'quality_rating' => is_string($phone['quality_rating'] ?? null) ? $phone['quality_rating'] : null,
            ];
        }

        return $phones;
    }

    public function sendText(string $phoneNumberId, string $accessToken, string $to, string $body): void
    {
        $digits = preg_replace('/\D+/', '', $to) ?? '';

        if (str_starts_with($digits, '0')) {
            $digits = '92'.substr($digits, 1);
        }

        $response = Http::withToken($accessToken)->acceptJson()->post($this->graphUrl('/'.$phoneNumberId.'/messages'), [
            'messaging_product' => 'whatsapp',
            'to' => $digits,
            'type' => 'text',
            'text' => ['body' => $body],
        ]);

        $this->throwIfFailed($response, 'Unable to send the WhatsApp reminder.');
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

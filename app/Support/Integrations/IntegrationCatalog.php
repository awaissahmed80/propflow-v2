<?php

namespace App\Support\Integrations;

use App\Models\Integration;
use App\Models\LeadStage;
use App\Models\Tenant;
use App\Support\Domain;
use App\Support\Integrations\Meta\MetaLeadSettings;
use App\Support\Integrations\Meta\MetaOAuthClient;
use App\Support\Integrations\WhatsApp\WhatsAppLeadSettings;
use App\Support\Integrations\WhatsApp\WhatsAppOAuthClient;
use Illuminate\Support\Collection;

class IntegrationCatalog
{
    /**
     * @return list<array{
     *     provider: string,
     *     name: string,
     *     description: string,
     *     icon: string,
     *     brand_color: string,
     *     available: bool
     * }>
     */
    public static function definitions(): array
    {
        return [
            [
                'provider' => Integration::PROVIDER_META,
                'name' => 'Meta',
                'description' => 'Lead Ads, Messenger & Instagram',
                'icon' => 'meta-fill',
                'brand_color' => '#0866FF',
                'available' => true,
            ],
            [
                'provider' => Integration::PROVIDER_WHATSAPP,
                'name' => 'WhatsApp Business',
                'description' => 'Campaign intake from WhatsApp messages',
                'icon' => 'whatsapp-fill',
                'brand_color' => '#25D366',
                'available' => true,
            ],
            [
                'provider' => Integration::PROVIDER_GOOGLE,
                'name' => 'Google Lead Forms',
                'description' => 'Google Ads lead extensions',
                'icon' => 'google-fill',
                'brand_color' => '#4285F4',
                'available' => false,
            ],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function forTenant(?Tenant $tenant = null): array
    {
        $tenant ??= Tenant::current();
        $connections = Integration::query()
            ->get()
            ->keyBy('provider');

        return collect(static::definitions())
            ->map(function (array $definition) use ($connections, $tenant): array {
                /** @var Integration|null $connection */
                $connection = $connections->get($definition['provider']);

                $pages = [];
                $phones = [];
                $wabas = [];
                $leadSettings = null;
                $webhookUrl = null;
                $billingDisclaimer = null;

                $fallbackStageId = LeadStage::query()->where('label', 'new')->value('id')
                    ?? LeadStage::query()->orderBy('priority')->value('id');

                if ($definition['provider'] === Integration::PROVIDER_META) {
                    $leadSettings = MetaLeadSettings::normalize(
                        is_array(data_get($connection?->settings, 'lead_settings'))
                            ? data_get($connection->settings, 'lead_settings')
                            : null,
                        $fallbackStageId ? (int) $fallbackStageId : null,
                    );

                    if ($connection) {
                        /** @var list<array{id: string, name: string, access_token?: string, tasks?: list<string>}> $storedPages */
                        $storedPages = data_get($connection->settings, 'pages', []);
                        $pages = app(MetaOAuthClient::class)->pagesForPublic($storedPages);
                    }

                    $webhookUrl = $tenant
                        ? Domain::campaign('/webhooks/meta/'.$tenant->identifier)
                        : null;
                }

                if ($definition['provider'] === Integration::PROVIDER_WHATSAPP) {
                    $leadSettings = WhatsAppLeadSettings::normalize(
                        is_array(data_get($connection?->settings, 'lead_settings'))
                            ? data_get($connection->settings, 'lead_settings')
                            : null,
                        $fallbackStageId ? (int) $fallbackStageId : null,
                    );

                    if ($connection) {
                        /** @var list<array{id: string, name: ?string, phone_numbers: list<array<string, mixed>>}> $storedWabas */
                        $storedWabas = data_get($connection->settings, 'wabas', []);
                        $oauth = app(WhatsAppOAuthClient::class);
                        $wabas = $oauth->wabasForPublic(is_array($storedWabas) ? $storedWabas : []);
                        $phones = $oauth->phonesForPublic($wabas);
                    }

                    $webhookUrl = $tenant
                        ? Domain::campaign('/webhooks/whatsapp/'.$tenant->identifier)
                        : null;
                    $billingDisclaimer = 'Propflow connects your WhatsApp Business account. Message and conversation charges are billed by Meta to your business account.';
                }

                return [
                    ...$definition,
                    'status' => $connection?->status ?? Integration::STATUS_INACTIVE,
                    'external_id' => $connection?->external_id,
                    'external_name' => $connection?->external_name,
                    'leads_synced_count' => (int) ($connection?->leads_synced_count ?? 0),
                    'last_synced_at' => $connection?->last_synced_at?->toIso8601String(),
                    'last_error' => $connection?->last_error,
                    'webhook_url' => $webhookUrl,
                    'webhook_verify_token' => $connection?->webhook_verify_token,
                    'has_access_token' => filled($connection?->access_token),
                    'pages' => $pages,
                    'phones' => $phones,
                    'wabas' => $wabas,
                    'lead_settings' => $leadSettings,
                    'billing_disclaimer' => $billingDisclaimer,
                    'meta_user_name' => data_get($connection?->settings, 'meta_user_name'),
                    'connected_via' => data_get($connection?->settings, 'connected_via'),
                    'connected_at' => $connection?->updated_at?->toIso8601String(),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return Collection<string, array<string, mixed>>
     */
    public static function keyedDefinitions(): Collection
    {
        return collect(static::definitions())->keyBy('provider');
    }
}

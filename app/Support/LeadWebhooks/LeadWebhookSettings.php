<?php

namespace App\Support\LeadWebhooks;

use App\Models\Campaign;
use App\Models\LeadWebhook;
use App\Models\LeadWebhookDelivery;
use App\Models\Tenant;
use App\Support\Domain;

class LeadWebhookSettings
{
    /**
     * @return array{
     *     enabled: bool,
     *     url: ?string,
     *     signing_secret: ?string,
     *     signature_header: string,
     *     default_source: ?string,
     *     default_campaign_id: ?int,
     *     default_lead_stage_id: ?int,
     *     default_assignee_id: ?int,
     *     campaigns: list<array{id: int, title: string, public_id: string}>,
     *     deliveries: list<array{id: int, status: string, http_status: int, message: ?string, lead_code: ?string, created_at: ?string}>
     * }
     */
    public static function forCurrent(): array
    {
        $tenant = Tenant::current();
        $webhook = LeadWebhook::current();

        return [
            'enabled' => (bool) $webhook?->enabled,
            'url' => $tenant
                ? Domain::campaign('/webhooks/leads/'.$tenant->identifier)
                : null,
            'signing_secret' => $webhook?->signing_secret,
            'signature_header' => LeadWebhook::SIGNATURE_HEADER,
            'default_source' => $webhook?->default_source,
            'default_campaign_id' => $webhook?->default_campaign_id,
            'default_lead_stage_id' => $webhook?->default_lead_stage_id,
            'default_assignee_id' => $webhook?->default_assignee_id,
            'campaigns' => Campaign::query()
                ->where('status', Campaign::STATUS_ACTIVE)
                ->orderBy('title')
                ->get(['id', 'title', 'public_id'])
                ->map(fn (Campaign $campaign): array => [
                    'id' => $campaign->id,
                    'title' => $campaign->title,
                    'public_id' => $campaign->public_id,
                ])
                ->values()
                ->all(),
            'deliveries' => LeadWebhookDelivery::query()
                ->with('lead:id,code')
                ->latest('id')
                ->limit(20)
                ->get()
                ->map(fn (LeadWebhookDelivery $delivery): array => [
                    'id' => $delivery->id,
                    'status' => $delivery->status,
                    'http_status' => $delivery->http_status,
                    'message' => $delivery->message,
                    'lead_code' => $delivery->lead?->code,
                    'created_at' => $delivery->created_at?->toIso8601String(),
                ])
                ->values()
                ->all(),
        ];
    }
}

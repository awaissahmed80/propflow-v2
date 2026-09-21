<?php

namespace App\Support\Integrations\WhatsApp;

use App\Models\Campaign;
use App\Models\Contact;
use App\Models\Integration;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Services\LeadIntakeService;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class WhatsAppWebhookProcessor
{
    public function __construct(
        protected LeadIntakeService $intake,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     */
    public function handle(Integration $integration, array $payload): void
    {
        $object = data_get($payload, 'object');
        $entries = data_get($payload, 'entry', []);

        if ($object !== 'whatsapp_business_account' || ! is_array($entries)) {
            return;
        }

        $handled = 0;
        $failed = false;

        foreach ($entries as $entry) {
            if (! is_array($entry)) {
                continue;
            }

            [$count, $entryFailed] = $this->handleEntry($integration, $entry);
            $handled += $count;
            $failed = $failed || $entryFailed;
        }

        $integration->refresh();

        $updates = [
            'last_synced_at' => now(),
            'leads_synced_count' => (int) $integration->leads_synced_count + $handled,
        ];

        if (! $failed) {
            $updates['last_error'] = null;
            $updates['status'] = Integration::STATUS_CONNECTED;
        }

        $integration->forceFill($updates)->save();
    }

    /**
     * @param  array<string, mixed>  $entry
     * @return array{0: int, 1: bool}
     */
    protected function handleEntry(Integration $integration, array $entry): array
    {
        $handled = 0;
        $failed = false;
        $wabaId = is_string($entry['id'] ?? null) ? $entry['id'] : null;
        $changes = data_get($entry, 'changes', []);

        if (! is_array($changes)) {
            return [0, false];
        }

        foreach ($changes as $change) {
            if (! is_array($change) || ($change['field'] ?? null) !== 'messages') {
                continue;
            }

            $value = $change['value'] ?? null;

            if (! is_array($value)) {
                continue;
            }

            try {
                $count = $this->ingestMessages($integration, $value, $wabaId);
                $handled += $count;
            } catch (Throwable $exception) {
                $failed = true;
                Log::warning('WhatsApp message ingest failed', [
                    'waba_id' => $wabaId,
                    'phone_number_id' => data_get($value, 'metadata.phone_number_id'),
                    'message' => $exception->getMessage(),
                ]);
                $integration->forceFill([
                    'last_error' => $exception->getMessage(),
                    'status' => Integration::STATUS_ERROR,
                ])->save();
            }
        }

        return [$handled, $failed];
    }

    /**
     * @param  array<string, mixed>  $value
     */
    protected function ingestMessages(Integration $integration, array $value, ?string $wabaId): int
    {
        $messages = data_get($value, 'messages', []);

        if (! is_array($messages) || $messages === []) {
            return 0;
        }

        $phoneNumberId = data_get($value, 'metadata.phone_number_id');
        $displayPhone = data_get($value, 'metadata.display_phone_number');
        $contacts = data_get($value, 'contacts', []);
        $contactName = is_array($contacts) && isset($contacts[0]['profile']['name'])
            && is_string($contacts[0]['profile']['name'])
            ? $contacts[0]['profile']['name']
            : null;

        if (! is_string($phoneNumberId) || $phoneNumberId === '') {
            return 0;
        }

        $settings = WhatsAppLeadSettings::normalize(data_get($integration->settings, 'lead_settings'));
        $campaign = $this->resolveCampaign($phoneNumberId);
        $handled = 0;

        foreach ($messages as $message) {
            if (! is_array($message)) {
                continue;
            }

            if ($this->ingestMessage(
                $integration,
                $settings,
                $message,
                $phoneNumberId,
                is_string($displayPhone) ? $displayPhone : null,
                $wabaId,
                $contactName,
                $campaign,
            )) {
                $handled++;
            }
        }

        return $handled;
    }

    /**
     * @param  array{
     *     sync_frequency: string,
     *     default_owner: string,
     *     default_lead_stage_id: int|null,
     *     notify_on_new_leads: bool,
     *     deduplicate_by_phone: bool,
     *     auto_tag_source: bool
     * }  $settings
     * @param  array<string, mixed>  $message
     */
    protected function ingestMessage(
        Integration $integration,
        array $settings,
        array $message,
        string $phoneNumberId,
        ?string $displayPhone,
        ?string $wabaId,
        ?string $contactName,
        ?Campaign $campaign,
    ): bool {
        $messageId = data_get($message, 'id');
        $from = data_get($message, 'from');
        $type = data_get($message, 'type');

        if (! is_string($from) || $from === '') {
            return false;
        }

        if (! is_string($messageId) || $messageId === '') {
            $messageId = 'wa:'.$from.':'.(string) data_get($message, 'timestamp');
        }

        if ($this->messageAlreadyImported($messageId)) {
            return false;
        }

        $text = $this->extractMessageText($message, is_string($type) ? $type : null);

        if ($text === null || trim($text) === '') {
            return false;
        }

        $phone = $this->normalizePhone($from);

        if ($settings['deduplicate_by_phone'] && filled($phone)) {
            $existingContact = Contact::query()
                ->where('phone_number', $phone)
                ->orWhere('phone_number', '+'.$phone)
                ->orWhere('phone_number', $from)
                ->first();

            if ($existingContact && Lead::query()
                ->where('contact_id', $existingContact->id)
                ->where('campaign_id', $campaign?->id)
                ->whereNull('archived_at')
                ->exists()
            ) {
                // Still import as new lead notes? Plan says create leads from messages.
                // Dedup by phone only skips when already imported same message id above.
                // For phone dedupe: update notes on existing open lead instead of skipping entirely.
                $openLead = Lead::query()
                    ->where('contact_id', $existingContact->id)
                    ->where('campaign_id', $campaign?->id)
                    ->whereNull('archived_at')
                    ->latest('id')
                    ->first();

                if ($openLead) {
                    $openLead->forceFill([
                        'notes' => trim((string) $openLead->notes."\n".Str::limit(trim($text), 2000)),
                        'attributes' => array_replace_recursive($openLead->attributes ?? [], [
                            'whatsapp' => [
                                'message_id' => $messageId,
                                'last_message_at' => now()->toIso8601String(),
                            ],
                        ]),
                    ])->save();

                    return true;
                }
            }
        }

        $nameParts = $this->splitName($contactName);

        [$contact] = $this->intake->resolveContact([
            'first_name' => $nameParts['first_name'],
            'last_name' => $nameParts['last_name'],
            'phone_number' => $phone ?: $from,
            'email_address' => null,
        ]);

        $assigneeId = $campaign?->default_assignee_id
            ?? $this->resolveAssignee($settings['default_owner']);
        $stageId = $campaign?->default_lead_stage_id
            ?? $settings['default_lead_stage_id']
            ?? LeadStage::defaultStageId();

        $source = $settings['auto_tag_source']
            ? 'WhatsApp'
            : ($campaign?->title ? $campaign->title.' (WhatsApp)' : 'WhatsApp');

        $referral = data_get($message, 'referral');
        $notes = Str::limit(trim($text), 2000);

        if (is_array($referral) && filled($referral['headline'] ?? null)) {
            $notes = trim($notes."\nCTWA: ".$referral['headline']);
        }

        Lead::query()->create([
            'contact_id' => $contact->id,
            'campaign_id' => $campaign?->id,
            'project_id' => $campaign?->project_id,
            'assigned_to' => $assigneeId,
            'lead_stage_id' => $stageId ? (int) $stageId : null,
            'source' => $source,
            'tag' => Lead::TAG_MODERATE,
            'budget' => 0,
            'notes' => $notes,
            'attributes' => [
                'whatsapp' => [
                    'message_id' => $messageId,
                    'from' => $from,
                    'phone_number_id' => $phoneNumberId,
                    'display_phone_number' => $displayPhone,
                    'waba_id' => $wabaId,
                    'type' => is_string($type) ? $type : null,
                    'referral' => is_array($referral) ? [
                        'source_url' => $referral['source_url'] ?? null,
                        'source_type' => $referral['source_type'] ?? null,
                        'source_id' => $referral['source_id'] ?? null,
                        'headline' => $referral['headline'] ?? null,
                        'body' => $referral['body'] ?? null,
                        'ctwa_clid' => $referral['ctwa_clid'] ?? null,
                    ] : null,
                    'campaign_id' => $campaign?->id,
                    'integration_id' => $integration->id,
                ],
            ],
        ]);

        return true;
    }

    /**
     * @param  array<string, mixed>  $message
     */
    protected function extractMessageText(array $message, ?string $type): ?string
    {
        return match ($type) {
            'text' => is_string(data_get($message, 'text.body'))
                ? data_get($message, 'text.body')
                : null,
            'button' => is_string(data_get($message, 'button.text'))
                ? data_get($message, 'button.text')
                : null,
            'interactive' => is_string(data_get($message, 'interactive.button_reply.title'))
                ? data_get($message, 'interactive.button_reply.title')
                : (is_string(data_get($message, 'interactive.list_reply.title'))
                    ? data_get($message, 'interactive.list_reply.title')
                    : null),
            default => is_string($type) ? '['.$type.' message]' : null,
        };
    }

    protected function resolveCampaign(string $phoneNumberId): ?Campaign
    {
        $campaigns = Campaign::query()
            ->where('source_type', Campaign::SOURCE_WHATSAPP)
            ->where('status', Campaign::STATUS_ACTIVE)
            ->get()
            ->filter(fn (Campaign $campaign): bool => data_get($campaign->source_config, 'phone_number_id') === $phoneNumberId)
            ->values();

        return $campaigns->first();
    }

    protected function messageAlreadyImported(string $messageId): bool
    {
        return Lead::query()
            ->where('attributes->whatsapp->message_id', $messageId)
            ->exists();
    }

    protected function normalizePhone(string $from): string
    {
        return preg_replace('/\D+/', '', $from) ?: $from;
    }

    /**
     * @return array{first_name: string, last_name: ?string}
     */
    protected function splitName(?string $name): array
    {
        if (! filled($name)) {
            return [
                'first_name' => 'WhatsApp',
                'last_name' => 'Contact',
            ];
        }

        $parts = preg_split('/\s+/', trim($name), 2) ?: [];

        return [
            'first_name' => $parts[0] !== '' ? $parts[0] : 'WhatsApp',
            'last_name' => $parts[1] ?? null,
        ];
    }

    protected function resolveAssignee(string $defaultOwner): ?int
    {
        $tenant = Tenant::current();

        if ($defaultOwner === WhatsAppLeadSettings::OWNER_ROUND_ROBIN) {
            if (! $tenant) {
                return null;
            }

            $userIds = TenantUser::query()
                ->where('tenant_id', $tenant->id)
                ->pluck('user_id')
                ->filter()
                ->values();

            if ($userIds->isEmpty()) {
                return null;
            }

            return (int) $userIds->random();
        }

        if (! ctype_digit($defaultOwner)) {
            return null;
        }

        $userId = (int) $defaultOwner;

        if (! $tenant) {
            return User::query()->whereKey($userId)->exists() ? $userId : null;
        }

        $belongs = TenantUser::query()
            ->where('tenant_id', $tenant->id)
            ->where('user_id', $userId)
            ->exists();

        return $belongs ? $userId : null;
    }
}

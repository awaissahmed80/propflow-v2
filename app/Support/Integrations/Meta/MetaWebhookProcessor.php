<?php

namespace App\Support\Integrations\Meta;

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

class MetaWebhookProcessor
{
    public function __construct(
        protected MetaGraphClient $graph,
        protected MetaOAuthClient $oauth,
        protected LeadIntakeService $intake,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     */
    public function handle(Integration $integration, array $payload): void
    {
        $object = data_get($payload, 'object');
        $entries = data_get($payload, 'entry', []);

        if (! is_array($entries)) {
            return;
        }

        $handled = 0;
        $failed = false;

        foreach ($entries as $entry) {
            if (! is_array($entry)) {
                continue;
            }

            if ($object === 'page') {
                [$count, $entryFailed] = $this->handlePageEntry($integration, $entry);
                $handled += $count;
                $failed = $failed || $entryFailed;
            } elseif ($object === 'instagram') {
                [$count, $entryFailed] = $this->handleInstagramEntry($integration, $entry);
                $handled += $count;
                $failed = $failed || $entryFailed;
            }
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
    protected function handlePageEntry(Integration $integration, array $entry): array
    {
        $handled = 0;
        $failed = false;
        $pageId = is_string($entry['id'] ?? null) ? $entry['id'] : null;

        foreach (data_get($entry, 'changes', []) as $change) {
            if (! is_array($change)) {
                continue;
            }

            if (($change['field'] ?? null) === 'leadgen') {
                $value = is_array($change['value'] ?? null) ? $change['value'] : [];

                try {
                    if ($this->ingestLeadgen($integration, $value, $pageId)) {
                        $handled++;
                    }
                } catch (Throwable $exception) {
                    $failed = true;

                    Log::warning('Meta leadgen ingest failed', [
                        'page_id' => $pageId,
                        'leadgen_id' => data_get($value, 'leadgen_id'),
                        'message' => $exception->getMessage(),
                    ]);

                    $integration->forceFill([
                        'last_error' => $exception->getMessage(),
                        'status' => Integration::STATUS_ERROR,
                    ])->save();
                }
            }
        }

        foreach (data_get($entry, 'messaging', []) as $messageEvent) {
            if (! is_array($messageEvent)) {
                continue;
            }

            try {
                if ($this->ingestMessagingEvent($integration, $messageEvent, 'Messenger', $pageId)) {
                    $handled++;
                }
            } catch (Throwable $exception) {
                $failed = true;

                Log::warning('Meta Messenger ingest failed', [
                    'page_id' => $pageId,
                    'message' => $exception->getMessage(),
                ]);
            }
        }

        return [$handled, $failed];
    }

    /**
     * @param  array<string, mixed>  $entry
     * @return array{0: int, 1: bool}
     */
    protected function handleInstagramEntry(Integration $integration, array $entry): array
    {
        $handled = 0;
        $failed = false;
        $igAccountId = is_string($entry['id'] ?? null) ? $entry['id'] : null;

        foreach (data_get($entry, 'messaging', []) as $messageEvent) {
            if (! is_array($messageEvent)) {
                continue;
            }

            try {
                if ($this->ingestMessagingEvent($integration, $messageEvent, 'Instagram', $igAccountId)) {
                    $handled++;
                }
            } catch (Throwable $exception) {
                $failed = true;

                Log::warning('Meta Instagram ingest failed', [
                    'instagram_id' => $igAccountId,
                    'message' => $exception->getMessage(),
                ]);
            }
        }

        return [$handled, $failed];
    }

    /**
     * @param  array<string, mixed>  $value
     */
    protected function ingestLeadgen(Integration $integration, array $value, ?string $fallbackPageId): bool
    {
        $leadgenId = data_get($value, 'leadgen_id');
        $pageId = data_get($value, 'page_id') ?: $fallbackPageId;

        if (! is_string($leadgenId) || $leadgenId === '' || ! is_string($pageId) || $pageId === '') {
            return false;
        }

        if ($this->leadAlreadyImported($leadgenId)) {
            return false;
        }

        $pageToken = $this->pageAccessToken($integration, $pageId);

        if ($pageToken === null) {
            throw new \RuntimeException('No access token available for Facebook Page '.$pageId.'.');
        }

        $leadPayload = $this->graph->fetchLead($leadgenId, $pageToken);
        $mapped = $this->mapLeadFields($leadPayload['field_data']);
        $settings = MetaLeadSettings::normalize(data_get($integration->settings, 'lead_settings'));
        $formId = $leadPayload['form_id'] ?? data_get($value, 'form_id');
        $campaign = $this->resolveCampaign($pageId, is_string($formId) ? $formId : null);

        if ($settings['deduplicate_by_email'] && filled($mapped['email_address'])) {
            $existingContact = Contact::query()
                ->whereRaw('LOWER(email_address) = ?', [mb_strtolower($mapped['email_address'])])
                ->first();

            if ($existingContact && Lead::query()->where('contact_id', $existingContact->id)->exists()) {
                return false;
            }
        }

        [$contact] = $this->intake->resolveContact($mapped);

        $assigneeId = $campaign?->default_assignee_id
            ?? $this->resolveAssignee($settings['default_owner']);
        $stageId = $campaign?->default_lead_stage_id
            ?? $settings['default_lead_stage_id']
            ?? LeadStage::defaultStageId();

        $source = $settings['auto_tag_source']
            ? 'Meta Lead Ads'
            : ($campaign?->title ? $campaign->title.' (Meta)' : 'Facebook Lead Ads');
        $notes = $this->buildLeadNotes($mapped['extra'], $leadPayload);

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
                'meta' => [
                    'channel' => 'leadgen',
                    'leadgen_id' => $leadgenId,
                    'page_id' => $pageId,
                    'form_id' => $formId,
                    'ad_id' => $leadPayload['ad_id'] ?? data_get($value, 'ad_id'),
                    'created_time' => $leadPayload['created_time'] ?? null,
                    'campaign_id' => $campaign?->id,
                ],
            ],
        ]);

        return true;
    }

    protected function resolveCampaign(string $pageId, ?string $formId): ?Campaign
    {
        $campaigns = Campaign::query()
            ->where('source_type', Campaign::SOURCE_FACEBOOK)
            ->where('status', Campaign::STATUS_ACTIVE)
            ->orderByDesc('id')
            ->get()
            ->filter(fn (Campaign $campaign): bool => data_get($campaign->source_config, 'page_id') === $pageId)
            ->values();

        if ($campaigns->isEmpty()) {
            return null;
        }

        if (filled($formId)) {
            $exactForm = $campaigns->first(
                fn (Campaign $campaign): bool => data_get($campaign->source_config, 'form_id') === $formId
            );

            if ($exactForm) {
                return $exactForm;
            }
        }

        return $campaigns->first(
            fn (Campaign $campaign): bool => blank(data_get($campaign->source_config, 'form_id'))
        ) ?? $campaigns->first();
    }

    /**
     * @param  array<string, mixed>  $event
     */
    protected function ingestMessagingEvent(
        Integration $integration,
        array $event,
        string $channel,
        ?string $accountId,
    ): bool {
        $senderId = data_get($event, 'sender.id');
        $messageId = data_get($event, 'message.mid') ?: data_get($event, 'message.is_echo');
        $text = data_get($event, 'message.text');

        if (! is_string($senderId) || $senderId === '') {
            return false;
        }

        // Ignore echoes / delivery receipts without inbound text.
        if (data_get($event, 'message.is_echo') === true) {
            return false;
        }

        if (! is_string($text) || trim($text) === '') {
            return false;
        }

        $externalKey = is_string($messageId) && $messageId !== ''
            ? $messageId
            : $channel.':'.$senderId.':'.(string) data_get($event, 'timestamp');

        if ($this->messagingAlreadyImported($externalKey)) {
            return false;
        }

        $settings = MetaLeadSettings::normalize(data_get($integration->settings, 'lead_settings'));
        $contact = Contact::query()->create([
            'first_name' => $channel.' contact',
            'last_name' => substr($senderId, -6),
            'phone_number' => null,
            'email_address' => null,
            'reference' => $channel.' '.$senderId,
            'type' => 'LEAD',
            'tag' => 'GENERAL',
        ]);

        $assigneeId = $this->resolveAssignee($settings['default_owner']);
        $stageId = $settings['default_lead_stage_id']
            ?? LeadStage::defaultStageId();

        $source = $settings['auto_tag_source']
            ? 'Meta '.$channel
            : $channel;

        Lead::query()->create([
            'contact_id' => $contact->id,
            'assigned_to' => $assigneeId,
            'lead_stage_id' => $stageId ? (int) $stageId : null,
            'source' => $source,
            'tag' => Lead::TAG_MODERATE,
            'budget' => 0,
            'notes' => Str::limit(trim($text), 2000),
            'attributes' => [
                'meta' => [
                    'channel' => strtolower($channel),
                    'sender_id' => $senderId,
                    'account_id' => $accountId,
                    'message_id' => is_string($messageId) ? $messageId : null,
                    'external_key' => $externalKey,
                ],
            ],
        ]);

        return true;
    }

    /**
     * @param  list<array{name: string, values: list<string>}>  $fieldData
     * @return array{
     *     first_name: ?string,
     *     last_name: ?string,
     *     phone_number: ?string,
     *     email_address: ?string,
     *     extra: list<string>
     * }
     */
    protected function mapLeadFields(array $fieldData): array
    {
        $bag = [];

        foreach ($fieldData as $field) {
            $bag[mb_strtolower($field['name'])] = $field['values'][0] ?? null;
        }

        $fullName = $bag['full_name'] ?? $bag['name'] ?? null;
        $firstName = $bag['first_name'] ?? null;
        $lastName = $bag['last_name'] ?? null;

        if ((! filled($firstName) || ! filled($lastName)) && filled($fullName)) {
            $parts = preg_split('/\s+/', trim((string) $fullName), 2) ?: [];
            $firstName = $firstName ?: ($parts[0] ?? null);
            $lastName = $lastName ?: ($parts[1] ?? null);
        }

        $known = [
            'full_name', 'name', 'first_name', 'last_name',
            'email', 'email_address', 'phone', 'phone_number', 'work_phone_number',
        ];

        $extra = [];

        foreach ($bag as $key => $value) {
            if (in_array($key, $known, true) || blank($value)) {
                continue;
            }

            $extra[] = Str::title(str_replace('_', ' ', $key)).': '.$value;
        }

        return [
            'first_name' => filled($firstName) ? (string) $firstName : null,
            'last_name' => filled($lastName) ? (string) $lastName : null,
            'phone_number' => $bag['phone_number'] ?? $bag['phone'] ?? $bag['work_phone_number'] ?? null,
            'email_address' => $bag['email'] ?? $bag['email_address'] ?? null,
            'extra' => $extra,
        ];
    }

    /**
     * @param  list<string>  $extra
     * @param  array<string, mixed>  $leadPayload
     */
    protected function buildLeadNotes(array $extra, array $leadPayload): ?string
    {
        $parts = $extra;

        if (filled($leadPayload['form_id'] ?? null)) {
            $parts[] = 'Meta form ID: '.$leadPayload['form_id'];
        }

        if (filled($leadPayload['ad_id'] ?? null)) {
            $parts[] = 'Meta ad ID: '.$leadPayload['ad_id'];
        }

        $notes = trim(implode("\n", $parts));

        return $notes !== '' ? $notes : null;
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
                return $this->oauth->decryptPageToken($page['access_token']);
            } catch (Throwable) {
                return null;
            }
        }

        return filled($integration->access_token) ? $integration->access_token : null;
    }

    protected function resolveAssignee(string $defaultOwner): ?int
    {
        $tenant = Tenant::current();

        if ($defaultOwner === MetaLeadSettings::OWNER_ROUND_ROBIN) {
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

    protected function leadAlreadyImported(string $leadgenId): bool
    {
        return Lead::query()
            ->where('attributes->meta->leadgen_id', $leadgenId)
            ->exists();
    }

    protected function messagingAlreadyImported(string $externalKey): bool
    {
        return Lead::query()
            ->where('attributes->meta->external_key', $externalKey)
            ->exists();
    }
}

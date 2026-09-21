<?php

namespace App\Support\Integrations\WhatsApp;

class WhatsAppLeadSettings
{
    public const SYNC_REALTIME = 'realtime';

    public const SYNC_HOURLY = 'hourly';

    public const SYNC_DAILY = 'daily';

    public const OWNER_ROUND_ROBIN = 'round_robin';

    /**
     * @return array{
     *     sync_frequency: string,
     *     default_owner: string,
     *     default_lead_stage_id: int|null,
     *     notify_on_new_leads: bool,
     *     deduplicate_by_phone: bool,
     *     auto_tag_source: bool
     * }
     */
    public static function defaults(?int $defaultLeadStageId = null): array
    {
        return [
            'sync_frequency' => self::SYNC_REALTIME,
            'default_owner' => self::OWNER_ROUND_ROBIN,
            'default_lead_stage_id' => $defaultLeadStageId,
            'notify_on_new_leads' => false,
            'deduplicate_by_phone' => true,
            'auto_tag_source' => true,
        ];
    }

    /**
     * @param  array<string, mixed>|null  $stored
     * @return array{
     *     sync_frequency: string,
     *     default_owner: string,
     *     default_lead_stage_id: int|null,
     *     notify_on_new_leads: bool,
     *     deduplicate_by_phone: bool,
     *     auto_tag_source: bool
     * }
     */
    public static function normalize(?array $stored, ?int $fallbackStageId = null): array
    {
        $defaults = self::defaults($fallbackStageId);
        $stored ??= [];

        $frequency = $stored['sync_frequency'] ?? $defaults['sync_frequency'];
        if (! in_array($frequency, self::syncFrequencies(), true)) {
            $frequency = self::SYNC_REALTIME;
        }

        $owner = $stored['default_owner'] ?? $defaults['default_owner'];
        if ($owner !== self::OWNER_ROUND_ROBIN && ! ctype_digit((string) $owner)) {
            $owner = self::OWNER_ROUND_ROBIN;
        }

        $stageId = $stored['default_lead_stage_id'] ?? $defaults['default_lead_stage_id'];
        if ($stageId !== null && $stageId !== '') {
            $stageId = (int) $stageId;
        } else {
            $stageId = $fallbackStageId;
        }

        return [
            'sync_frequency' => $frequency,
            'default_owner' => (string) $owner,
            'default_lead_stage_id' => $stageId,
            'notify_on_new_leads' => (bool) ($stored['notify_on_new_leads'] ?? false),
            'deduplicate_by_phone' => (bool) ($stored['deduplicate_by_phone'] ?? true),
            'auto_tag_source' => (bool) ($stored['auto_tag_source'] ?? true),
        ];
    }

    /**
     * @return list<string>
     */
    public static function syncFrequencies(): array
    {
        return [
            self::SYNC_REALTIME,
            self::SYNC_HOURLY,
            self::SYNC_DAILY,
        ];
    }
}

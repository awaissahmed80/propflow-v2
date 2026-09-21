<?php

namespace App\Models;

use App\Traits\LogUserActivity;
use Database\Factories\LeadWebhookFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

#[Fillable([
    'enabled',
    'signing_secret',
    'default_source',
    'default_campaign_id',
    'default_lead_stage_id',
    'default_assignee_id',
])]
#[Connection('tenant')]
class LeadWebhook extends Model
{
    /** @use HasFactory<LeadWebhookFactory> */
    use HasFactory, LogUserActivity;

    public const SIGNATURE_HEADER = 'X-Propflow-Signature';

    public static function current(): ?self
    {
        return static::query()->first();
    }

    public static function ensure(): self
    {
        $webhook = static::query()->first();

        if ($webhook) {
            if (blank($webhook->signing_secret)) {
                $webhook->signing_secret = static::generateSecret();
                $webhook->save();
            }

            return $webhook;
        }

        return static::query()->create([
            'enabled' => false,
            'signing_secret' => static::generateSecret(),
        ]);
    }

    public static function generateSecret(): string
    {
        return Str::random(40);
    }

    public static function sign(string $body, string $secret): string
    {
        return 'sha256='.hash_hmac('sha256', $body, $secret);
    }

    public function acceptsSignatures(): bool
    {
        return $this->enabled && filled($this->signing_secret);
    }

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'enabled' => 'boolean',
            'signing_secret' => 'encrypted',
            'default_campaign_id' => 'integer',
            'default_lead_stage_id' => 'integer',
            'default_assignee_id' => 'integer',
        ];
    }
}

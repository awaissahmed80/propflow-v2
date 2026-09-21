<?php

namespace App\Models;

use Database\Factories\IntegrationFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'provider',
    'status',
    'external_id',
    'external_name',
    'access_token',
    'refresh_token',
    'webhook_verify_token',
    'settings',
    'leads_synced_count',
    'last_synced_at',
    'last_error',
])]
#[Connection('tenant')]
class Integration extends Model
{
    /** @use HasFactory<IntegrationFactory> */
    use HasFactory;

    public const PROVIDER_META = 'meta';

    public const PROVIDER_GOOGLE = 'google';

    public const PROVIDER_WHATSAPP = 'whatsapp';

    public const PROVIDER_BITRIX = 'bitrix';

    public const PROVIDER_SLACK = 'slack';

    public const PROVIDER_ZAPIER = 'zapier';

    public const STATUS_INACTIVE = 'inactive';

    public const STATUS_CONNECTED = 'connected';

    public const STATUS_ERROR = 'error';

    public const STATUS_SYNCING = 'syncing';

    public function isConnected(): bool
    {
        return $this->status === self::STATUS_CONNECTED;
    }

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'access_token' => 'encrypted',
            'refresh_token' => 'encrypted',
            'settings' => 'array',
            'leads_synced_count' => 'integer',
            'last_synced_at' => 'datetime',
        ];
    }
}

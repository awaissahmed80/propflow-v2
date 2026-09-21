<?php

namespace App\Models;

use Database\Factories\LeadWebhookDeliveryFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

#[Fillable([
    'status',
    'http_status',
    'message',
    'lead_id',
])]
#[Connection('tenant')]
class LeadWebhookDelivery extends Model
{
    /** @use HasFactory<LeadWebhookDeliveryFactory> */
    use HasFactory;

    public const STATUS_ACCEPTED = 'accepted';

    public const STATUS_REJECTED = 'rejected';

    public const RETAINED = 50;

    public static function record(string $status, int $httpStatus, ?string $message = null, ?int $leadId = null): self
    {
        $delivery = static::query()->create([
            'status' => $status,
            'http_status' => $httpStatus,
            'message' => filled($message) ? Str::limit($message, 180) : null,
            'lead_id' => $leadId,
        ]);

        $keep = static::query()->orderByDesc('id')->limit(self::RETAINED)->pluck('id');

        static::query()->whereNotIn('id', $keep)->delete();

        return $delivery;
    }

    /**
     * @return BelongsTo<Lead, $this>
     */
    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'http_status' => 'integer',
            'lead_id' => 'integer',
        ];
    }
}

<?php

namespace App\Models;

use App\Enums\TenantInvitationStatus;
use App\Support\Domain;
use Database\Factories\TenantInvitationFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

#[Fillable([
    'tenant_id',
    'invited_by',
    'email',
    'token',
    'first_name',
    'last_name',
    'phone_number',
    'title',
    'department',
    'manager_id',
    'roles',
    'status',
    'accepted_at',
    'expires_at',
])]
#[Connection('landlord')]
class TenantInvitation extends Model
{
    /** @use HasFactory<TenantInvitationFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'roles' => 'array',
            'status' => TenantInvitationStatus::class,
            'accepted_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (TenantInvitation $invitation): void {
            if (blank($invitation->token)) {
                $invitation->token = Str::random(64);
            }

            if ($invitation->expires_at === null) {
                $invitation->expires_at = Carbon::now()->addDays(7);
            }

            if ($invitation->status === null) {
                $invitation->status = TenantInvitationStatus::Pending;
            }
        });
    }

    /**
     * @return BelongsTo<Tenant, $this>
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function inviter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function manager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'manager_id');
    }

    public function isPending(): bool
    {
        return $this->status === TenantInvitationStatus::Pending
            && $this->expires_at !== null
            && $this->expires_at->isFuture();
    }

    public function markAccepted(): void
    {
        $this->forceFill([
            'status' => TenantInvitationStatus::Accepted,
            'accepted_at' => now(),
        ])->save();
    }

    /**
     * @param  Builder<TenantInvitation>  $query
     * @return Builder<TenantInvitation>
     */
    public function scopePending(Builder $query): Builder
    {
        return $query
            ->where('status', TenantInvitationStatus::Pending)
            ->where('expires_at', '>', now());
    }

    public function acceptUrl(): string
    {
        return Domain::auth('/invites/'.$this->token);
    }
}

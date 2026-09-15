<?php

namespace App\Models;

use App\Enums\TenantMembershipStatus;
use Database\Factories\TenantUserFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'user_id',
    'tenant_id',
    'code',
    'title',
    'department',
    'status',
    'is_owner',
    'manager_id',
])]
#[Connection('landlord')]
class TenantUser extends Model
{
    /** @use HasFactory<TenantUserFactory> */
    use HasFactory, SoftDeletes;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => TenantMembershipStatus::class,
            'is_owner' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (TenantUser $membership): void {
            if (filled($membership->code)) {
                return;
            }

            $lastId = static::withTrashed()->max('id') ?? 0;
            $membership->code = 'U'.$membership->tenant_id.str_pad((string) ($lastId + 1), 5, '0', STR_PAD_LEFT);
        });
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
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
    public function manager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'manager_id');
    }

    /**
     * @param  Builder<TenantUser>  $query
     * @return Builder<TenantUser>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', TenantMembershipStatus::Active);
    }
}

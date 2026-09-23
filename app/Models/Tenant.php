<?php

namespace App\Models;

use App\Enums\TenantStatus;
use Database\Factories\TenantFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Multitenancy\Models\Tenant as BaseTenant;

class Tenant extends BaseTenant
{
    /** @use HasFactory<TenantFactory> */
    use HasFactory, SoftDeletes;

    protected $connection = 'landlord';

    protected $fillable = [
        'name',
        'database',
        'identifier',
        'code',
        'status',
        'secret_key',
        'public_key',
        'api_key',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => TenantStatus::class,
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Tenant $tenant): void {
            if (blank($tenant->code)) {
                $tenant->code = self::generateCode();
            }
        });
    }

    /**
     * @return HasMany<TenantInvitation, $this>
     */
    public function invitations(): HasMany
    {
        return $this->hasMany(TenantInvitation::class);
    }

    /**
     * @return HasMany<TenantUser, $this>
     */
    public function tenantUsers(): HasMany
    {
        return $this->hasMany(TenantUser::class);
    }

    /**
     * @return BelongsToMany<User, $this>
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'tenant_users')
            ->withPivot(['id', 'code', 'title', 'department', 'status', 'is_owner', 'manager_id'])
            ->withTimestamps()
            ->wherePivotNull('deleted_at');
    }

    public function isActive(): bool
    {
        return $this->status === TenantStatus::Active;
    }

    public static function generateCode(int $length = 9): string
    {
        $characters = '0123456789ABCDEFGHIJKLMNOQRSTUVWXYZ';

        do {
            $randomString = substr(str_shuffle($characters), 0, $length);
        } while (static::where('code', $randomString)->exists());

        return $randomString;
    }
}

<?php

namespace App\Models;

use App\Enums\TenantMembershipStatus;
use App\Enums\TenantStatus;
use App\Enums\UserStatus;
use App\Enums\UserType;
use App\Support\PermissionConnection;
use App\Traits\LogUserActivity;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Contracts\Permission;
use Spatie\Permission\PermissionRegistrar;
use Spatie\Permission\Support\Config;
use Spatie\Permission\Traits\HasRoles;

#[Fillable([
    'display_name',
    'first_name',
    'last_name',
    'email_address',
    'password',
    'phone_number',
    'type',
    'status',
])]
#[Hidden(['password', 'remember_token'])]
#[Connection('landlord')]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasRoles, LogUserActivity, Notifiable, SoftDeletes;

    protected string $guard_name = 'web';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'type' => UserType::class,
            'status' => UserStatus::class,
        ];
    }

    public function getEmailForPasswordReset(): string
    {
        return $this->email_address;
    }

    public function getAuthIdentifierName(): string
    {
        return 'id';
    }

    /**
     * Active tenant memberships (pivot profile per tenant).
     *
     * @return HasMany<TenantUser, $this>
     */
    public function tenantUsers(): HasMany
    {
        return $this->hasMany(TenantUser::class);
    }

    /**
     * Alias for tenant memberships.
     *
     * @return HasMany<TenantUser, $this>
     */
    public function memberships(): HasMany
    {
        return $this->tenantUsers();
    }

    /**
     * Tenants this user belongs to.
     *
     * @return BelongsToMany<Tenant, $this>
     */
    public function tenants(): BelongsToMany
    {
        return $this->belongsToMany(Tenant::class, 'tenant_users')
            ->withPivot(['id', 'code', 'title', 'department', 'status', 'is_owner', 'manager_id'])
            ->withTimestamps()
            ->wherePivotNull('deleted_at');
    }

    /**
     * @return HasMany<TenantUser, $this>
     */
    public function activeTenantUsers(): HasMany
    {
        return $this->tenantUsers()->active();
    }

    /**
     * @return BelongsToMany<Tenant, $this>
     */
    public function activeTenants(): BelongsToMany
    {
        return $this->tenants()
            ->wherePivot('status', TenantMembershipStatus::Active->value)
            ->where('tenants.status', TenantStatus::Active->value);
    }

    public function isPlatformUser(): bool
    {
        return $this->type === UserType::Platform;
    }

    public function isPlatformAdmin(): bool
    {
        return $this->isPlatformUser();
    }

    public function isTenantUser(): bool
    {
        return $this->type === UserType::Tenant;
    }

    /**
     * Role pivots live on landlord (platform) or tenant DB depending on current tenant.
     */
    public function roles(): BelongsToMany
    {
        $relation = $this->morphToMany(
            Config::roleModel(),
            'model',
            Config::modelHasRolesTable(),
            Config::morphKey(),
            app(PermissionRegistrar::class)->pivotRole
        );

        return $this->onPermissionConnection($relation);
    }

    /**
     * Direct permission pivots (unused by policy — roles only), same connection rules as roles().
     */
    public function permissions(): BelongsToMany
    {
        $relation = $this->morphToMany(
            Config::permissionModel(),
            'model',
            Config::modelHasPermissionsTable(),
            Config::morphKey(),
            app(PermissionRegistrar::class)->pivotPermission
        );

        return $this->onPermissionConnection($relation);
    }

    protected function onPermissionConnection(BelongsToMany $relation): BelongsToMany
    {
        $connection = PermissionConnection::name();

        $relation->getRelated()->setConnection($connection);
        $relation->getQuery()->getQuery()->connection = DB::connection($connection);
        $relation->getQuery()->getModel()->setConnection($connection);

        return $relation;
    }

    /**
     * @param  Builder<User>  $query
     * @return Builder<User>
     */
    public function scopePlatform(Builder $query): Builder
    {
        return $query->where('type', UserType::Platform);
    }

    /**
     * @param  Builder<User>  $query
     * @return Builder<User>
     */
    public function scopeTenantAccounts(Builder $query): Builder
    {
        return $query->where('type', UserType::Tenant);
    }

    /**
     * Roles only — direct permission assignment is intentionally unsupported.
     *
     * @param  string|int|Permission|\BackedEnum  $permission
     */
    public function givePermissionTo(...$permissions): self
    {
        throw new \LogicException('Direct permissions are disabled. Assign permissions to a role, then assign the role to the user.');
    }

    /**
     * @param  string|int|Permission|\BackedEnum  $permission
     */
    public function syncPermissions(...$permissions): self
    {
        throw new \LogicException('Direct permissions are disabled. Assign permissions to a role, then assign the role to the user.');
    }
}

<?php

namespace App\Services;

use App\Enums\TenantMembershipStatus;
use App\Enums\UserType;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Session;
use InvalidArgumentException;
use RuntimeException;
use Spatie\Permission\PermissionRegistrar;

class TenantContext
{
    public const SESSION_TENANT_ID = 'current_tenant_id';

    public const SESSION_IMPERSONATOR_ID = 'impersonator_id';

    /**
     * Active tenant memberships for account selection.
     *
     * @return Collection<int, TenantUser>
     */
    public function activeMembershipsFor(User $user): Collection
    {
        return $user->memberships()
            ->with('tenant')
            ->where('status', TenantMembershipStatus::Active)
            ->whereHas('tenant', fn ($query) => $query->where('status', 'ACTIVE'))
            ->get()
            ->sortBy(fn (TenantUser $membership) => mb_strtolower($membership->tenant?->name ?? ''))
            ->values();
    }

    public function enter(Tenant $tenant, ?User $user = null): void
    {
        $user ??= Auth::user();

        if (! $user instanceof User) {
            throw new RuntimeException('Cannot enter a tenant without an authenticated user.');
        }

        if ($user->isTenantUser() && ! $this->userBelongsToTenant($user, $tenant)) {
            throw new InvalidArgumentException('User does not have an active membership for this tenant.');
        }

        if (! $tenant->isActive()) {
            throw new InvalidArgumentException('Tenant is not active.');
        }

        Session::put(self::SESSION_TENANT_ID, $tenant->id);
        $tenant->makeCurrent();
        $this->refreshPermissionState($user);
    }

    public function leave(): void
    {
        Tenant::forgetCurrent();
        Session::forget(self::SESSION_TENANT_ID);

        /** @var User|null $user */
        $user = Auth::user();
        $this->refreshPermissionState($user);
    }

    public function currentTenantId(): ?int
    {
        $id = Session::get(self::SESSION_TENANT_ID);

        return $id !== null ? (int) $id : null;
    }

    /**
     * Clear Spatie cache + loaded relations after switching landlord/tenant permission DB.
     */
    public function refreshPermissionState(?User $user = null): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        $user?->unsetRelation('roles')->unsetRelation('permissions');
    }

    public function userBelongsToTenant(User $user, Tenant $tenant): bool
    {
        return $user->memberships()
            ->where('tenant_id', $tenant->id)
            ->where('status', TenantMembershipStatus::Active)
            ->exists();
    }

    /**
     * Landlord admin views the portal as a tenant user.
     */
    public function impersonate(User $admin, User $target, Tenant $tenant): void
    {
        if ($admin->type !== UserType::Platform) {
            throw new InvalidArgumentException('Only platform admins can impersonate tenant users.');
        }

        if ($target->type !== UserType::Tenant) {
            throw new InvalidArgumentException('Can only impersonate tenant users.');
        }

        if (! $this->userBelongsToTenant($target, $tenant)) {
            throw new InvalidArgumentException('Target user is not an active member of this tenant.');
        }

        Session::put(self::SESSION_IMPERSONATOR_ID, $admin->id);
        Auth::login($target);
        $this->enter($tenant, $target);
    }

    public function stopImpersonating(): void
    {
        $impersonatorId = Session::get(self::SESSION_IMPERSONATOR_ID);

        if (! $impersonatorId) {
            return;
        }

        $this->leave();
        Session::forget(self::SESSION_IMPERSONATOR_ID);
        Auth::loginUsingId($impersonatorId);

        /** @var User|null $admin */
        $admin = Auth::user();
        $this->refreshPermissionState($admin);
    }

    public function isImpersonating(): bool
    {
        return Session::has(self::SESSION_IMPERSONATOR_ID);
    }

    public function impersonator(): ?User
    {
        $id = Session::get(self::SESSION_IMPERSONATOR_ID);

        return $id ? User::query()->find($id) : null;
    }
}

<?php

namespace App\Services;

use App\Enums\TenantInvitationStatus;
use App\Enums\TenantMembershipStatus;
use App\Enums\UserStatus;
use App\Enums\UserType;
use App\Mail\WorkspaceInviteMail;
use App\Models\Tenant;
use App\Models\TenantInvitation;
use App\Models\TenantUser;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class InviteWorkspaceMember
{
    /**
     * Invite a member to the current tenant workspace.
     *
     * Always creates a pending invitation. Membership is created only after accept.
     * Existing Propflow accounts still must accept before they become active in this workspace.
     *
     * @param  array{
     *     email_address: string,
     *     phone_number?: string|null,
     *     title: string,
     *     department?: string|null,
     *     manager_id?: int|null,
     *     roles?: list<string>|null
     * }  $data
     * @return array{outcome: 'invited', user: ?User, invitation: TenantInvitation, membership: null}
     */
    public function invite(Tenant $tenant, array $data, ?User $inviter = null): array
    {
        $email = mb_strtolower(trim($data['email_address']));
        $roles = array_values(array_filter($data['roles'] ?? []));

        $existing = User::query()
            ->where('email_address', $email)
            ->first();

        if ($existing?->isPlatformUser()) {
            throw ValidationException::withMessages([
                'email_address' => 'This email belongs to a platform account and cannot join a workspace.',
            ]);
        }

        if ($existing !== null) {
            $alreadyMember = TenantUser::query()
                ->where('tenant_id', $tenant->id)
                ->where('user_id', $existing->id)
                ->exists();

            if ($alreadyMember) {
                throw ValidationException::withMessages([
                    'email_address' => 'This user is already a member of this workspace.',
                ]);
            }
        }

        $pendingExists = TenantInvitation::query()
            ->pending()
            ->where('tenant_id', $tenant->id)
            ->where('email', $email)
            ->exists();

        if ($pendingExists) {
            throw ValidationException::withMessages([
                'email_address' => 'An invitation is already pending for this email.',
            ]);
        }

        $invitation = TenantInvitation::query()->create([
            'tenant_id' => $tenant->id,
            'invited_by' => $inviter?->id,
            'email' => $email,
            'first_name' => null,
            'last_name' => null,
            'phone_number' => $data['phone_number'] ?? null,
            'title' => $data['title'],
            'department' => $data['department'] ?? null,
            'manager_id' => $data['manager_id'] ?? null,
            'roles' => $roles,
            'status' => TenantInvitationStatus::Pending,
        ]);

        Mail::to($email)->send(
            new WorkspaceInviteMail($invitation, $tenant, $inviter)
        );

        return [
            'outcome' => 'invited',
            'user' => $existing,
            'invitation' => $invitation,
            'membership' => null,
        ];
    }

    /**
     * Accept a pending invitation: create the user (if needed), attach membership, assign roles.
     *
     * This is the only web path that creates tenant user accounts or activates workspace membership.
     * There is no public signup.
     *
     * @param  array{password?: string, first_name?: string, last_name?: string, phone_number?: string|null}  $data
     */
    public function accept(TenantInvitation $invitation, array $data, ?User $actingUser = null): User
    {
        if (! $invitation->isPending()) {
            throw ValidationException::withMessages([
                'token' => 'This invitation is no longer valid.',
            ]);
        }

        $tenant = $invitation->tenant()->firstOrFail();
        $email = mb_strtolower($invitation->email);

        $user = User::query()->where('email_address', $email)->first();

        if ($user?->isPlatformUser()) {
            throw ValidationException::withMessages([
                'token' => 'This email belongs to a platform account and cannot join a workspace.',
            ]);
        }

        if ($user !== null) {
            $this->assertExistingUserMayAccept($user, $data, $actingUser);
        }

        $user = DB::connection('landlord')->transaction(function () use ($invitation, $tenant, $user, $data, $email): User {
            if ($user === null) {
                $user = User::query()->create([
                    'first_name' => $data['first_name'] ?? $invitation->first_name,
                    'last_name' => $data['last_name'] ?? $invitation->last_name,
                    'display_name' => trim(($data['first_name'] ?? $invitation->first_name).' '.($data['last_name'] ?? $invitation->last_name)),
                    'email_address' => $email,
                    'phone_number' => $data['phone_number'] ?? $invitation->phone_number,
                    'password' => $data['password'],
                    'type' => UserType::Tenant,
                    'status' => UserStatus::Active,
                ]);
            }

            $membership = TenantUser::query()
                ->where('tenant_id', $tenant->id)
                ->where('user_id', $user->id)
                ->first();

            if ($membership === null) {
                TenantUser::query()->create([
                    'user_id' => $user->id,
                    'tenant_id' => $tenant->id,
                    'title' => $invitation->title,
                    'department' => $invitation->department,
                    'manager_id' => $invitation->manager_id,
                    'status' => TenantMembershipStatus::Active,
                    'is_owner' => false,
                ]);
            }

            $invitation->markAccepted();

            return $user->fresh();
        });

        $tenant->makeCurrent();
        $user->syncRoles($invitation->roles ?? []);

        return $user;
    }

    /**
     * @param  array{password?: string}  $data
     */
    protected function assertExistingUserMayAccept(User $user, array $data, ?User $actingUser): void
    {
        if ($actingUser !== null && $actingUser->is($user)) {
            return;
        }

        $password = $data['password'] ?? null;

        if (! filled($password) || ! Hash::check($password, $user->getAuthPassword())) {
            throw ValidationException::withMessages([
                'password' => 'Enter the password for your existing Propflow account.',
            ]);
        }
    }
}

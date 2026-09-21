<?php

namespace App\Support\Notifications;

use App\Enums\TenantMembershipStatus;
use App\Models\Setting;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Notifications\WorkspaceNotification;
use Illuminate\Support\Collection;

class WorkspaceNotifier
{
    /**
     * @param  Collection<int, User>|list<User>  $users
     */
    public static function send(string $event, string $title, string $body, ?string $href, Collection|array $users): void
    {
        $tenant = Tenant::current();

        if ($tenant === null || ! self::enabled($event)) {
            return;
        }

        $actorId = auth()->id();
        $recipients = collect($users)
            ->filter(fn (User $user): bool => $actorId === null || $user->id !== $actorId)
            ->unique(fn (User $user): int => $user->id)
            ->values();

        if ($recipients->isEmpty()) {
            return;
        }

        $recipients->each->notify(new WorkspaceNotification([
            'tenant_id' => $tenant->id,
            'event' => $event,
            'title' => $title,
            'body' => $body,
            'href' => $href,
        ]));
    }

    public static function enabled(string $event): bool
    {
        $settings = Setting::group(Setting::GROUP_NOTIFICATIONS, NotificationSettings::defaults());

        return (bool) ($settings['in_app'] ?? false) && (bool) ($settings[$event] ?? false);
    }

    /**
     * @return Collection<int, User>
     */
    public static function members(): Collection
    {
        $tenant = Tenant::current();

        if ($tenant === null) {
            return collect();
        }

        $userIds = TenantUser::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', TenantMembershipStatus::Active)
            ->pluck('user_id');

        return User::query()->whereIn('id', $userIds)->get();
    }

    /**
     * @return Collection<int, User>
     */
    public static function userOrMembers(?int $userId): Collection
    {
        if ($userId !== null) {
            $user = User::query()->find($userId);

            return $user === null ? collect() : collect([$user]);
        }

        return self::members();
    }
}

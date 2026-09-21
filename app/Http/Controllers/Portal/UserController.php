<?php

namespace App\Http\Controllers\Portal;

use App\Enums\TenantMembershipStatus;
use App\Enums\UserStatus;
use App\Enums\UserType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\StoreUserRequest;
use App\Http\Requests\Portal\UpdateUserRequest;
use App\Http\Resources\Portal\UserDetailResource;
use App\Http\Resources\Portal\UserListResource;
use App\Models\Lead;
use App\Models\Order;
use App\Models\Role;
use App\Models\TeamUser;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Support\AssetManager;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function __construct(protected AssetManager $assets) {}

    public function index(Request $request): Response
    {
        $query = $request->string('q')->trim()->toString();
        $code = ltrim($request->string('user')->trim()->toString(), '#');

        $users = $this->tenantUsersList($query);

        if ($users->isEmpty()) {
            return Inertia::render('users/index', [
                'users' => [],
                'selectedUser' => null,
                'filters' => [
                    'q' => $query,
                ],
                'formOptions' => $this->formOptions(),
            ]);
        }

        $selected = $code !== ''
            ? $users->firstWhere('code', $code)
            : null;

        return Inertia::render('users/index', [
            'users' => $users->values(),
            'selectedUser' => $selected
                ? $this->userDetailByCode($selected['code'])
                : null,
            'filters' => [
                'q' => $query,
            ],
            'formOptions' => $this->formOptions(),
        ]);
    }

    public function store(StoreUserRequest $request): RedirectResponse
    {
        /** @var Tenant $tenant */
        $tenant = Tenant::current();
        $validated = $request->validated();

        $user = DB::connection('landlord')->transaction(function () use ($validated, $tenant): User {
            $user = User::query()->create([
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'],
                'display_name' => trim($validated['first_name'].' '.$validated['last_name']),
                'email_address' => $validated['email_address'],
                'phone_number' => $validated['phone_number'],
                'password' => $validated['password'],
                'type' => UserType::Tenant,
                'status' => UserStatus::Active,
            ]);

            TenantUser::query()->create([
                'user_id' => $user->id,
                'tenant_id' => $tenant->id,
                'title' => $validated['title'],
                'department' => $validated['department'] ?? null,
                'manager_id' => $validated['manager_id'] ?? null,
                'status' => TenantMembershipStatus::Active,
                'is_owner' => false,
            ]);

            return $user;
        });

        $tenant->makeCurrent();

        if ($request->hasFile('avatar')) {
            $this->assets->attach(
                $user,
                $request->file('avatar'),
                AssetManager::LINKAGE_AVATAR,
                'avatars',
            );
        }

        $user->syncRoles($validated['roles'] ?? []);

        return to_route('portal.users.index', [
            'user' => $user->tenantUsers()->where('tenant_id', $tenant->id)->value('code'),
        ]);
    }

    public function update(UpdateUserRequest $request, string $user): RedirectResponse
    {
        /** @var Tenant $tenant */
        $tenant = Tenant::current();
        $validated = $request->validated();

        $membership = TenantUser::query()
            ->where('tenant_id', $tenant->id)
            ->where('code', $user)
            ->firstOrFail();

        $userModel = $membership->user()->firstOrFail();

        DB::connection('landlord')->transaction(function () use ($validated, $userModel, $membership): void {
            $payload = [
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'],
                'display_name' => trim($validated['first_name'].' '.$validated['last_name']),
                'email_address' => $validated['email_address'],
                'phone_number' => $validated['phone_number'],
            ];

            if (! empty($validated['password'])) {
                $payload['password'] = $validated['password'];
            }

            $userModel->forceFill($payload)->save();

            $membership->forceFill([
                'title' => $validated['title'],
                'department' => $validated['department'] ?? null,
                'manager_id' => $validated['manager_id'] ?? null,
            ])->save();
        });

        $tenant->makeCurrent();

        if ($request->boolean('remove_avatar') && ! $request->hasFile('avatar')) {
            $this->assets->detach($userModel, AssetManager::LINKAGE_AVATAR, deleteOrphans: true);
        }

        if ($request->hasFile('avatar')) {
            $this->assets->attach(
                $userModel,
                $request->file('avatar'),
                AssetManager::LINKAGE_AVATAR,
                'avatars',
            );
        }

        $userModel->syncRoles($validated['roles'] ?? []);

        return to_route('portal.users.index', [
            'user' => $membership->code,
        ]);
    }

    public function destroy(string $user): RedirectResponse
    {
        /** @var Tenant $tenant */
        $tenant = Tenant::current();

        $membership = TenantUser::query()
            ->where('tenant_id', $tenant->id)
            ->where('code', $user)
            ->firstOrFail();

        $userModel = $membership->user()->firstOrFail();

        if ($membership->is_owner) {
            return back()->withErrors([
                'message' => 'Owner accounts cannot be deleted.',
            ]);
        }

        if ((int) $userModel->id === (int) auth()->id()) {
            return back()->withErrors([
                'message' => 'You cannot delete your own account.',
            ]);
        }

        TeamUser::query()->where('user_id', $userModel->id)->delete();
        $userModel->syncRoles([]);

        DB::connection('landlord')->transaction(function () use ($membership, $userModel): void {
            $membership->delete();
            $userModel->delete();
        });

        return to_route('portal.users.index');
    }

    /**
     * @return array{roles: list<string>, managers: list<array{id: int, display_name: string, title: ?string, avatar: ?string}>, departments: list<string>}
     */
    protected function formOptions(): array
    {
        /** @var Tenant $tenant */
        $tenant = Tenant::current();

        $managerMemberships = TenantUser::query()
            ->with(['user:id,display_name,first_name,last_name'])
            ->where('tenant_id', $tenant->id)
            ->orderBy('id')
            ->get()
            ->filter(fn (TenantUser $membership): bool => $membership->user !== null)
            ->values();

        $managerAvatarUrls = $this->assets->urlsFor(
            User::class,
            $managerMemberships->pluck('user_id')->all(),
            AssetManager::LINKAGE_AVATAR,
        );

        $managers = $managerMemberships
            ->map(fn (TenantUser $membership): array => [
                'id' => $membership->user->id,
                'display_name' => $membership->user->display_name,
                'title' => $membership->title,
                'avatar' => $managerAvatarUrls->get($membership->user_id),
            ])
            ->all();

        $departments = TenantUser::query()
            ->where('tenant_id', $tenant->id)
            ->whereNotNull('department')
            ->where('department', '!=', '')
            ->distinct()
            ->orderBy('department')
            ->pluck('department')
            ->merge(['Sales', 'Marketing', 'Operations', 'Finance', 'HR', 'Support'])
            ->unique()
            ->sort()
            ->values()
            ->all();

        return [
            'roles' => Role::query()->orderBy('name')->pluck('name')->all(),
            'managers' => $managers,
            'departments' => $departments,
        ];
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    protected function tenantUsersList(string $query = ''): Collection
    {
        /** @var Tenant $tenant */
        $tenant = Tenant::current();

        $memberships = TenantUser::query()
            ->with(['user:id,display_name,first_name,last_name,email_address,phone_number', 'user.roles:id,name'])
            ->where('tenant_id', $tenant->id)
            ->orderBy('id')
            ->get()
            ->filter(fn (TenantUser $membership): bool => $membership->user !== null);

        if ($query !== '') {
            $needle = mb_strtolower($query);

            $memberships = $memberships->filter(function (TenantUser $membership) use ($needle): bool {
                $haystack = mb_strtolower(implode(' ', array_filter([
                    $membership->user->display_name,
                    $membership->user->first_name,
                    $membership->user->last_name,
                    $membership->user->email_address,
                    $membership->user->phone_number,
                    $membership->title,
                    $membership->code,
                ])));

                return str_contains($haystack, $needle);
            });
        }

        $avatarUrls = $this->assets->urlsFor(
            User::class,
            $memberships->pluck('user_id')->all(),
            AssetManager::LINKAGE_AVATAR,
        );

        $memberships->each(function (TenantUser $membership) use ($avatarUrls): void {
            $membership->setAttribute(
                'avatar_url',
                $avatarUrls->get($membership->user_id),
            );
        });

        return collect(UserListResource::collection($memberships->values())->resolve());
    }

    /**
     * @return array<string, mixed>
     */
    protected function userDetailByCode(string $code): array
    {
        /** @var Tenant $tenant */
        $tenant = Tenant::current();

        $membership = TenantUser::query()
            ->with([
                'user:id,display_name,first_name,last_name,email_address,phone_number,status',
                'manager:id,display_name,first_name,last_name,email_address',
            ])
            ->where('tenant_id', $tenant->id)
            ->where('code', ltrim($code, '#'))
            ->firstOrFail();

        /** @var User $user */
        $user = $membership->user;
        $userId = $user->id;

        $managerMembership = null;
        if ($membership->manager_id) {
            $managerMembership = TenantUser::query()
                ->where('tenant_id', $tenant->id)
                ->where('user_id', $membership->manager_id)
                ->first();
        }

        $teamRows = TeamUser::query()
            ->with(['team:id,title,code,color'])
            ->where('user_id', $userId)
            ->get();

        $teamIds = $teamRows->pluck('team_id')->filter()->all();

        $teamMemberRows = $teamIds === []
            ? collect()
            : TeamUser::query()
                ->whereIn('team_id', $teamIds)
                ->get()
                ->groupBy('team_id');

        $memberUserIds = $teamMemberRows
            ->flatten(1)
            ->pluck('user_id')
            ->unique()
            ->values()
            ->all();

        $memberUsers = $memberUserIds === []
            ? collect()
            : User::query()
                ->whereIn('id', $memberUserIds)
                ->get(['id', 'display_name', 'first_name', 'last_name'])
                ->keyBy('id');

        $avatarUserIds = collect([$userId, $membership->manager_id])
            ->merge($memberUserIds)
            ->filter()
            ->unique()
            ->values()
            ->all();

        $avatarUrls = $this->assets->urlsFor(
            User::class,
            $avatarUserIds,
            AssetManager::LINKAGE_AVATAR,
        );

        $teams = $teamRows->map(function (TeamUser $row) use ($teamMemberRows, $memberUsers, $avatarUrls): ?array {
            if ($row->team === null) {
                return null;
            }

            $members = ($teamMemberRows->get($row->team_id) ?? collect())
                ->map(function (TeamUser $member) use ($memberUsers, $avatarUrls): ?array {
                    $memberUser = $memberUsers->get($member->user_id);

                    if ($memberUser === null) {
                        return null;
                    }

                    return [
                        'id' => $memberUser->id,
                        'display_name' => $memberUser->display_name,
                        'first_name' => $memberUser->first_name,
                        'last_name' => $memberUser->last_name,
                        'avatar' => $avatarUrls->get($memberUser->id),
                    ];
                })
                ->filter()
                ->values();

            return [
                'id' => $row->team->id,
                'title' => $row->team->title,
                'code' => $row->team->code,
                'color' => $row->team->color,
                'members' => $members,
            ];
        })->filter()->values();

        $leadsCount = Lead::query()
            ->where(function ($query) use ($userId): void {
                $query->where('assigned_to', $userId)
                    ->orWhere('user_id', $userId);
            })
            ->count();

        $membership->setAttribute('avatar_url', $avatarUrls->get($userId));
        $membership->setAttribute('role_names', $user->getRoleNames()->values()->all());
        $membership->setAttribute('teams_data', $teams);
        $membership->setAttribute('stats_data', [
            'leads' => $leadsCount,
            'teams' => $teams->count(),
            'tasks_due' => 0,
            'closed_deals' => Order::query()
                ->where('assigned_to', $userId)
                ->whereIn('status', [Order::STATUS_ALLOCATED, Order::STATUS_DELIVERED])
                ->count(),
        ]);
        $membership->setAttribute(
            'manager_data',
            $membership->manager ? [
                'id' => $membership->manager->id,
                'display_name' => $membership->manager->display_name,
                'first_name' => $membership->manager->first_name,
                'last_name' => $membership->manager->last_name,
                'title' => $managerMembership?->title,
                'avatar' => $avatarUrls->get($membership->manager->id),
            ] : null,
        );

        return (new UserDetailResource($membership))->resolve();
    }
}

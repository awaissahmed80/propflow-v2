<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\StoreTeamRequest;
use App\Http\Requests\Portal\UpdateTeamRequest;
use App\Http\Resources\Portal\TeamResource;
use App\Models\Team;
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

class TeamController extends Controller
{
    public function __construct(protected AssetManager $assets) {}

    public function index(Request $request): Response
    {
        $query = $request->string('q')->trim()->toString();

        $teams = $this->teamsPayload($query);

        return Inertia::render('teams/index', [
            'teams' => $teams->values(),
            'filters' => [
                'q' => $query,
            ],
            'formOptions' => $this->formOptions(),
        ]);
    }

    public function store(StoreTeamRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $leaderId = (int) $validated['leader_id'];
        $memberIds = $this->normalizedMemberIds(
            $validated['member_ids'] ?? [],
            $leaderId,
        );

        DB::connection('tenant')->transaction(function () use ($validated, $memberIds, $leaderId): void {
            $team = Team::query()->create([
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'color' => $validated['color'] ?? '#3847d0',
                'user_id' => $leaderId,
            ]);

            $this->syncMembers($team, $memberIds, $leaderId);
        });

        return to_route('portal.teams.index');
    }

    public function update(UpdateTeamRequest $request, int $team): RedirectResponse
    {
        $teamModel = Team::query()->findOrFail($team);
        $validated = $request->validated();
        $leaderId = (int) $validated['leader_id'];
        $memberIds = $this->normalizedMemberIds(
            $validated['member_ids'] ?? [],
            $leaderId,
        );

        DB::connection('tenant')->transaction(function () use ($teamModel, $validated, $memberIds, $leaderId): void {
            $teamModel->forceFill([
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'color' => $validated['color'] ?? '#3847d0',
                'user_id' => $leaderId,
            ])->save();

            $this->syncMembers($teamModel, $memberIds, $leaderId);
        });

        return to_route('portal.teams.index');
    }

    public function destroy(int $team): RedirectResponse
    {
        Team::query()->findOrFail($team)->delete();

        return to_route('portal.teams.index');
    }

    /**
     * @return array{members: list<array{id: int, display_name: string, title: ?string, avatar: ?string}>}
     */
    protected function formOptions(): array
    {
        /** @var Tenant $tenant */
        $tenant = Tenant::current();

        $memberships = TenantUser::query()
            ->with(['user:id,display_name,first_name,last_name,email_address'])
            ->where('tenant_id', $tenant->id)
            ->orderBy('id')
            ->get()
            ->filter(fn (TenantUser $membership): bool => $membership->user !== null)
            ->values();

        $avatarUrls = $this->assets->urlsFor(
            User::class,
            $memberships->pluck('user_id')->all(),
            AssetManager::LINKAGE_AVATAR,
        );

        return [
            'members' => $memberships
                ->map(fn (TenantUser $membership): array => [
                    'id' => $membership->user->id,
                    'display_name' => $membership->user->display_name,
                    'title' => $membership->title,
                    'email_address' => $membership->user->email_address,
                    'avatar' => $avatarUrls->get($membership->user_id),
                ])
                ->all(),
        ];
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    protected function teamsPayload(string $query = ''): Collection
    {
        $teams = Team::query()
            ->with(['teamUsers'])
            ->orderBy('title')
            ->get();

        $userIds = $teams
            ->flatMap(fn (Team $team): Collection => collect([$team->user_id])
                ->merge($team->teamUsers->pluck('user_id')))
            ->filter()
            ->unique()
            ->values()
            ->all();

        $users = $userIds === []
            ? collect()
            : User::query()
                ->whereIn('id', $userIds)
                ->get(['id', 'display_name', 'first_name', 'last_name', 'email_address'])
                ->keyBy('id');

        /** @var Tenant $tenant */
        $tenant = Tenant::current();

        $titles = $userIds === []
            ? collect()
            : TenantUser::query()
                ->where('tenant_id', $tenant->id)
                ->whereIn('user_id', $userIds)
                ->get(['user_id', 'title'])
                ->keyBy('user_id');

        $avatarUrls = $this->assets->urlsFor(
            User::class,
            $userIds,
            AssetManager::LINKAGE_AVATAR,
        );

        $mapped = $teams->map(function (Team $team) use ($users, $titles, $avatarUrls): array {
            $memberRows = $team->teamUsers
                ->map(function (TeamUser $row) use ($users, $titles, $avatarUrls, $team): ?array {
                    $user = $users->get($row->user_id);

                    if ($user === null) {
                        return null;
                    }

                    return [
                        'id' => $user->id,
                        'display_name' => $user->display_name,
                        'first_name' => $user->first_name,
                        'last_name' => $user->last_name,
                        'email_address' => $user->email_address,
                        'title' => $titles->get($user->id)?->title,
                        'avatar' => $avatarUrls->get($user->id),
                        'is_lead' => (bool) $row->is_lead || (int) $team->user_id === (int) $user->id,
                    ];
                })
                ->filter()
                ->sortBy(fn (array $member): string => mb_strtolower($member['display_name']))
                ->values();

            $leader = null;
            if ($team->user_id && $users->has($team->user_id)) {
                $leaderUser = $users->get($team->user_id);
                $leader = [
                    'id' => $leaderUser->id,
                    'display_name' => $leaderUser->display_name,
                    'first_name' => $leaderUser->first_name,
                    'last_name' => $leaderUser->last_name,
                    'title' => $titles->get($leaderUser->id)?->title,
                    'avatar' => $avatarUrls->get($leaderUser->id),
                ];
            }

            $team->setAttribute('leader_data', $leader);
            $team->setAttribute('members_data', $memberRows->all());
            $team->setAttribute('member_count', $memberRows->count());

            return (new TeamResource($team))->resolve();
        });

        if ($query === '') {
            return $mapped->values();
        }

        $needle = mb_strtolower($query);

        return $mapped
            ->filter(function (array $team) use ($needle): bool {
                $haystack = mb_strtolower(implode(' ', array_filter([
                    $team['title'],
                    $team['code'],
                    $team['description'],
                    $team['leader']['display_name'] ?? null,
                ])));

                return str_contains($haystack, $needle);
            })
            ->values();
    }

    /**
     * @param  list<int|string>  $memberIds
     * @return list<int>
     */
    protected function normalizedMemberIds(array $memberIds, int $leaderId): array
    {
        $ids = collect($memberIds)
            ->map(fn ($id): int => (int) $id)
            ->filter(fn (int $id): bool => $id > 0);

        $ids->push($leaderId);

        return $ids->unique()->values()->all();
    }

    /**
     * @param  list<int>  $memberIds
     */
    protected function syncMembers(Team $team, array $memberIds, int $leaderId): void
    {
        TeamUser::query()->where('team_id', $team->id)->delete();

        foreach ($memberIds as $userId) {
            TeamUser::query()->create([
                'team_id' => $team->id,
                'user_id' => $userId,
                'is_lead' => $userId === $leaderId,
            ]);
        }
    }
}

<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Resources\Portal\ActivityLogResource;
use App\Models\LogActivity;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Support\ActivityCatalog;
use App\Support\AssetManager;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class ActivityLogController extends Controller
{
    private const ACTIONS = ['created', 'updated', 'deleted', 'restored'];

    public function __construct(private AssetManager $assets) {}

    public function index(Request $request): Response
    {
        $query = $request->string('q')->trim()->toString();
        $sections = $this->listParam($request, 'section');
        $actions = collect($this->listParam($request, 'action'))
            ->filter(fn (string $action): bool => in_array($action, self::ACTIONS, true))
            ->values()
            ->all();
        $userIds = collect($this->listParam($request, 'user'))
            ->map(fn (string $id): int => (int) $id)
            ->filter(fn (int $id): bool => $id > 0)
            ->unique()
            ->values()
            ->all();

        $sections = collect($sections)
            ->filter(fn (string $section): bool => ActivityCatalog::has($section) && $section !== 'all')
            ->values()
            ->all();

        $types = collect($sections)
            ->flatMap(fn (string $section): array => ActivityCatalog::types($section))
            ->unique()
            ->values()
            ->all();

        $paginator = LogActivity::query()
            ->when($types !== [], fn ($builder) => $builder->whereIn('logable_type', $types))
            ->when($actions !== [], fn ($builder) => $builder->whereIn('action', $actions))
            ->when($userIds !== [], fn ($builder) => $builder->whereIn('user_id', $userIds))
            ->when($query !== '', function ($builder) use ($query): void {
                $like = '%'.$query.'%';

                $builder->where(function ($inner) use ($like): void {
                    $inner
                        ->where('action', 'like', $like)
                        ->orWhere('logable_type', 'like', $like)
                        ->orWhereRaw('CAST(changes AS CHAR) LIKE ?', [$like])
                        ->orWhereRaw('CAST(previous AS CHAR) LIKE ?', [$like]);
                });
            })
            ->latest('id')
            ->paginate(30)
            ->withQueryString();

        /** @var Collection<int, LogActivity> $logs */
        $logs = $paginator->getCollection();
        $this->hydrateSubjects($logs);
        $this->hydrateUsers($logs);

        $paginator->through(
            fn (LogActivity $log): array => (new ActivityLogResource($log))->resolve(),
        );

        return Inertia::render('activity/index', [
            'logs' => Inertia::scroll($paginator),
            'filters' => [
                'q' => $query,
                'section' => $sections,
                'action' => $actions,
                'user' => array_map(strval(...), $userIds),
            ],
            'formOptions' => $this->formOptions(),
        ]);
    }

    /**
     * @return array{
     *     sections: list<array{id: string, label: string}>,
     *     actions: list<array{value: string, label: string}>,
     *     users: list<array{id: int, display_name: string, title: ?string, avatar: ?string}>
     * }
     */
    private function formOptions(): array
    {
        $sections = collect(ActivityCatalog::sections())
            ->filter(fn (array $section): bool => $section['id'] !== 'all')
            ->values()
            ->all();

        $actions = collect(self::ACTIONS)
            ->map(fn (string $action): array => [
                'value' => $action,
                'label' => ucfirst($action),
            ])
            ->all();

        $tenant = Tenant::current();
        $users = [];

        if ($tenant) {
            $memberships = TenantUser::query()
                ->with(['user:id,display_name,first_name,last_name'])
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

            $users = $memberships
                ->map(fn (TenantUser $membership): array => [
                    'id' => $membership->user->id,
                    'display_name' => $membership->user->display_name
                        ?: trim($membership->user->first_name.' '.$membership->user->last_name),
                    'title' => $membership->title,
                    'avatar' => $avatarUrls->get($membership->user_id),
                ])
                ->all();
        }

        return [
            'sections' => $sections,
            'actions' => $actions,
            'users' => $users,
        ];
    }

    /**
     * @return list<string>
     */
    private function listParam(Request $request, string $key): array
    {
        $value = $request->input($key);

        if (is_array($value)) {
            return collect($value)
                ->map(fn ($item): string => trim((string) $item))
                ->filter()
                ->values()
                ->all();
        }

        $string = trim((string) ($value ?? ''));

        if ($string === '') {
            return [];
        }

        return collect(explode(',', $string))
            ->map(fn (string $item): string => trim($item))
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, LogActivity>  $logs
     */
    private function hydrateSubjects(Collection $logs): void
    {
        $logs->groupBy('logable_type')->each(function (Collection $rows, string $type): void {
            if (! class_exists($type) || ! is_a($type, Model::class, true)) {
                return;
            }

            $query = $type::query();

            if (in_array(SoftDeletes::class, class_uses_recursive($type), true)) {
                $query->withTrashed();
            }

            $models = $query
                ->whereIn('id', $rows->pluck('logable_id')->unique()->all())
                ->get()
                ->keyBy('id');

            $rows->each(function (LogActivity $log) use ($models): void {
                $log->setRelation('logable', $models->get($log->logable_id));
            });
        });
    }

    /**
     * @param  Collection<int, LogActivity>  $logs
     */
    private function hydrateUsers(Collection $logs): void
    {
        $userIds = $logs->pluck('user_id')->filter()->unique()->values()->all();
        $users = $userIds === []
            ? collect()
            : User::query()->whereIn('id', $userIds)->get(['id', 'display_name'])->keyBy('id');

        $logs->each(function (LogActivity $log) use ($users): void {
            $log->setRelation('user', $users->get($log->user_id));
        });
    }
}

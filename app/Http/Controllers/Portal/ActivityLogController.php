<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Resources\Portal\ActivityLogResource;
use App\Models\LogActivity;
use App\Models\User;
use App\Support\ActivityCatalog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class ActivityLogController extends Controller
{
    public function index(Request $request): Response
    {
        $section = $request->string('section')->trim()->toString();

        if (! ActivityCatalog::has($section)) {
            $section = 'all';
        }

        $types = ActivityCatalog::types($section);

        $paginator = LogActivity::query()
            ->when($types !== [], fn ($query) => $query->whereIn('logable_type', $types))
            ->latest('id')
            ->paginate(30)
            ->withQueryString();

        /** @var Collection<int, LogActivity> $logs */
        $logs = $paginator->getCollection();
        $this->hydrateSubjects($logs);
        $this->hydrateUsers($logs);

        return Inertia::render('activity/index', [
            'logs' => ActivityLogResource::collection($logs)->resolve(),
            'section' => $section,
            'sections' => ActivityCatalog::sections(),
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ]);
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

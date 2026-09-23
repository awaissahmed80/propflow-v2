<?php

namespace App\Services;

use App\Models\AssetLink;
use App\Models\Lead;
use App\Models\LogActivity;
use App\Models\Order;
use App\Models\Project;
use App\Models\ProjectBlock;
use App\Models\Task;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Removes polymorphic / orphan-prone linked rows before a hard delete.
 *
 * Runs during the Eloquent "deleting" / "forceDeleting" window so child rows
 * that MySQL will cascade-delete still exist and can be cleaned up first.
 */
class LinkedDataPurger
{
    /**
     * Relations that the database will cascade-delete when the parent row is
     * hard-deleted. Purge their linked data first so morph rows are not orphaned.
     *
     * @var array<class-string<Model>, list<string>>
     */
    private const CASCADE_RELATIONS = [
        Lead::class => ['orders'],
        Order::class => ['payments'],
        Project::class => ['units', 'blocks', 'phases'],
        ProjectBlock::class => ['units'],
    ];

    /**
     * @var array<string, true>
     */
    private array $purging = [];

    public function purge(Model $model): void
    {
        if ($model instanceof LogActivity || $model instanceof AssetLink) {
            return;
        }

        $key = $model::class.':'.(string) $model->getKey();

        if (isset($this->purging[$key])) {
            return;
        }

        $this->purging[$key] = true;

        try {
            foreach ($this->cascadeChildren($model) as $child) {
                $this->purge($child);
            }

            $this->deleteOwnedTasks($model);
            $this->deleteAssetLinks($model);
            $this->deleteActivityLogs($model);
        } finally {
            unset($this->purging[$key]);
        }
    }

    /**
     * @return list<Model>
     */
    private function cascadeChildren(Model $model): array
    {
        $relations = self::CASCADE_RELATIONS[$model::class] ?? [];

        if ($relations === []) {
            return [];
        }

        $children = [];

        foreach ($relations as $name) {
            if (! method_exists($model, $name)) {
                continue;
            }

            /** @var Relation<Model, Model, mixed> $relation */
            $relation = $model->{$name}();
            $related = $relation->getRelated();

            if (in_array(SoftDeletes::class, class_uses_recursive($related), true)) {
                $relation->withTrashed();
            }

            foreach ($relation->get() as $child) {
                $children[] = $child;
            }
        }

        return $children;
    }

    private function deleteOwnedTasks(Model $model): void
    {
        Task::withTrashed()
            ->where('taskable_type', $model::class)
            ->where('taskable_id', $model->getKey())
            ->orderBy('id')
            ->chunkById(100, function ($tasks): void {
                foreach ($tasks as $task) {
                    /** @var Task $task */
                    $this->purge($task);
                    $task->withoutEvents(fn () => $task->forceDelete());
                }
            });
    }

    private function deleteAssetLinks(Model $model): void
    {
        AssetLink::query()
            ->where('assetable_type', $model::class)
            ->where('assetable_id', $model->getKey())
            ->delete();
    }

    private function deleteActivityLogs(Model $model): void
    {
        LogActivity::query()
            ->where('logable_type', $model::class)
            ->where('logable_id', $model->getKey())
            ->delete();
    }
}

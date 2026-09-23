<?php

namespace App\Observers;

use App\Services\LinkedDataPurger;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Purges polymorphic linked data (activity logs, asset links, tasks, etc.)
 * whenever a model is permanently removed from the database.
 */
class HardDeleteCleanupObserver
{
    public function __construct(private LinkedDataPurger $purger) {}

    /**
     * SoftDeletes permanent removal — runs before the row (and FK cascades) are gone.
     */
    public function forceDeleting(Model $model): void
    {
        $this->purger->purge($model);
    }

    /**
     * Hard delete for models without SoftDeletes.
     */
    public function deleting(Model $model): void
    {
        if ($this->usesSoftDeletes($model)) {
            return;
        }

        $this->purger->purge($model);
    }

    private function usesSoftDeletes(Model $model): bool
    {
        return in_array(SoftDeletes::class, class_uses_recursive($model), true);
    }
}

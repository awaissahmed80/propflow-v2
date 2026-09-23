<?php

namespace App\Observers;

use App\Models\Lead;
use App\Models\Order;
use App\Models\Task;
use App\Support\Notifications\WorkspaceNotifier;

class TaskNotificationObserver
{
    public function created(Task $task): void
    {
        if ($task->type !== Task::TYPE_ACTION || $task->user_id === null) {
            return;
        }

        $task->loadMissing('taskable');
        $taskable = $task->taskable;

        if ($taskable instanceof Lead) {
            $href = '/leads#'.$taskable->code;
        } elseif ($taskable instanceof Order) {
            $href = '/bookings/'.$taskable->code;
        } else {
            $href = '/leads';
        }

        WorkspaceNotifier::send(
            'task_assigned',
            'Task assigned',
            filled($task->action) ? (string) $task->action : 'A task was assigned to you.',
            $href,
            WorkspaceNotifier::userOrMembers($task->user_id),
        );
    }
}

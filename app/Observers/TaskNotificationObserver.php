<?php

namespace App\Observers;

use App\Models\Task;
use App\Support\Notifications\WorkspaceNotifier;

class TaskNotificationObserver
{
    public function created(Task $task): void
    {
        if ($task->type !== Task::TYPE_ACTION || $task->user_id === null) {
            return;
        }

        $code = $task->lead()->value('code');

        WorkspaceNotifier::send(
            'task_assigned',
            'Task assigned',
            filled($task->action) ? (string) $task->action : 'A task was assigned to you.',
            filled($code) ? '/leads#'.$code : '/leads',
            WorkspaceNotifier::userOrMembers($task->user_id),
        );
    }
}

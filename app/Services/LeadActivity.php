<?php

namespace App\Services;

use App\Models\Lead;
use App\Models\LeadActionType;
use App\Models\Task;
use App\Models\User;
use App\Support\AssetManager;
use Illuminate\Support\Facades\DB;

class LeadActivity
{
    public function __construct(private AssetManager $assets) {}

    public function created(Lead $lead): void
    {
        $actor = $this->actorName($lead->user_id);
        $source = filled($lead->source) ? ' Source: '.$lead->source.'.' : '';

        $comments = $actor !== null
            ? $actor.' created this lead.'.$source
            : 'Created automatically.'.$source;

        $this->log(
            $lead,
            'Lead created',
            trim($comments),
            $lead->user_id,
        );
    }

    /**
     * System / lifecycle event on a lead (stage change, booking events, etc.).
     */
    public function log(
        Lead $lead,
        string $action,
        ?string $comments = null,
        ?int $userId = null,
    ): Task {
        return $this->write(
            $lead,
            $action,
            $comments,
            $userId,
            Task::TYPE_LOG,
            Task::STATUS_COMPLETED,
        );
    }

    /**
     * User-submitted activity (composer update or scheduled next action).
     */
    public function action(
        Lead $lead,
        string $action,
        ?string $comments = null,
        ?int $userId = null,
        string $status = Task::STATUS_COMPLETED,
    ): Task {
        return $this->write(
            $lead,
            $action,
            $comments,
            $userId,
            Task::TYPE_ACTION,
            $status,
        );
    }

    /**
     * @param  array{action: string, comments: string, next_action: string, due_date?: string|null, media_ids?: list<int>, document_ids?: list<int>}  $data
     */
    public function recordUpdate(Lead $lead, array $data, ?int $userId): void
    {
        $nextAction = $data['next_action'];
        $dueDate = LeadActionType::isDoNothing($nextAction)
            ? null
            : ($data['due_date'] ?? null);

        DB::transaction(function () use ($lead, $data, $userId, $nextAction, $dueDate): void {
            $lead->tasks()
                ->where('type', Task::TYPE_ACTION)
                ->where('status', Task::STATUS_PENDING)
                ->update(['status' => Task::STATUS_COMPLETED]);

            $update = $this->action(
                $lead,
                $data['action'],
                $data['comments'],
                $userId,
                Task::STATUS_COMPLETED,
            );

            $mediaIds = $data['media_ids'] ?? [];
            $documentIds = $data['document_ids'] ?? [];

            if ($mediaIds !== []) {
                $this->assets->syncLinks($update, AssetManager::LINKAGE_GALLERY, $mediaIds);
            }

            if ($documentIds !== []) {
                $this->assets->syncLinks($update, AssetManager::LINKAGE_DOCUMENT, $documentIds);
            }

            if (! LeadActionType::isDoNothing($nextAction)) {
                $this->action(
                    $lead,
                    $nextAction,
                    null,
                    $userId,
                    Task::STATUS_PENDING,
                );
            }

            $lead->forceFill([
                'next_action' => $nextAction,
                'due_date' => $dueDate,
                'contacted_at' => now(),
            ])->save();

            app(LeadScoreCalculator::class)->apply(
                $lead->loadMissing(['stage', 'unit', 'tasks']),
            );
        });
    }

    protected function write(
        Lead $lead,
        string $action,
        ?string $comments,
        ?int $userId,
        string $type,
        string $status,
    ): Task {
        return $lead->tasks()->create([
            'user_id' => $userId,
            'action' => $action,
            'comments' => filled($comments) ? $comments : null,
            'status' => $status,
            'type' => $type,
        ]);
    }

    protected function actorName(?int $userId): ?string
    {
        if ($userId === null) {
            return null;
        }

        $name = User::query()->whereKey($userId)->value('display_name');

        return is_string($name) && $name !== '' ? $name : null;
    }
}

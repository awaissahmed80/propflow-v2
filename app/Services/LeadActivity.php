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

    public function log(
        Lead $lead,
        string $action,
        ?string $comments = null,
        ?int $userId = null,
        string $type = Task::TYPE_LOG,
        string $status = Task::STATUS_COMPLETED,
    ): Task {
        return Task::query()->create([
            'user_id' => $userId,
            'lead_id' => $lead->id,
            'action' => $action,
            'comments' => filled($comments) ? $comments : null,
            'status' => $status,
            'type' => $type,
        ]);
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
            Task::query()
                ->where('lead_id', $lead->id)
                ->where('type', Task::TYPE_ACTION)
                ->where('status', Task::STATUS_PENDING)
                ->update(['status' => Task::STATUS_COMPLETED]);

            $update = $this->log(
                $lead,
                $data['action'],
                $data['comments'],
                $userId,
                Task::TYPE_ACTION,
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
                $this->log(
                    $lead,
                    $nextAction,
                    null,
                    $userId,
                    Task::TYPE_ACTION,
                    Task::STATUS_PENDING,
                );
            }

            $lead->forceFill([
                'next_action' => $nextAction,
                'due_date' => $dueDate,
                'contacted_at' => now(),
            ])->save();
        });
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

<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderStage;
use App\Models\Task;
use App\Models\User;
use App\Support\AssetManager;
use Illuminate\Support\Facades\DB;

class OrderActivity
{
    public function __construct(private AssetManager $assets) {}

    public function created(Order $order, ?int $userId = null): void
    {
        $actor = $this->actorName($userId ?? $order->assigned_to);
        $comments = $actor !== null
            ? $actor.' created this booking.'
            : 'Booking created.';

        $this->log($order, 'Booking created', $comments, $userId);
    }

    public function log(
        Order $order,
        string $action,
        ?string $comments = null,
        ?int $userId = null,
        string $type = Task::TYPE_LOG,
        string $status = Task::STATUS_COMPLETED,
    ): Task {
        $stage = $order->stage ?: Order::STAGE_TOKEN;

        return Task::query()->create([
            'user_id' => $userId,
            'lead_id' => $order->lead_id,
            'order_id' => $order->id,
            'stage' => $stage,
            'stage_label' => OrderStage::titleFor($stage),
            'action' => $action,
            'comments' => filled($comments) ? $comments : null,
            'status' => $status,
            'type' => $type,
        ]);
    }

    /**
     * @param  array{action: string, comments: string, media_ids?: list<int>, document_ids?: list<int>}  $data
     */
    public function recordUpdate(Order $order, array $data, ?int $userId): Task
    {
        return DB::connection('tenant')->transaction(function () use ($order, $data, $userId): Task {
            $update = $this->log(
                $order,
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

            return $update;
        });
    }

    /**
     * @return list<array{id: int, action: string, comments: ?string, type: string, status: string, stage: ?string, stage_label: ?string, user: ?array{id: int, display_name: string}, created_at: ?string, media: list<array<string, mixed>>, documents: list<array<string, mixed>>}>
     */
    public function timeline(Order $order): array
    {
        $order->loadMissing(['activities.user', 'activities.gallery.asset', 'activities.documents.asset']);

        return $order->activities
            ->map(function (Task $task): array {
                return [
                    'id' => $task->id,
                    'action' => (string) $task->action,
                    'comments' => $task->comments,
                    'type' => (string) $task->type,
                    'status' => (string) $task->status,
                    'stage' => $task->stage,
                    'stage_label' => $task->stage_label ?: OrderStage::titleFor($task->stage),
                    'user' => $task->user ? [
                        'id' => $task->user->id,
                        'display_name' => (string) $task->user->display_name,
                    ] : null,
                    'created_at' => $task->created_at?->toIso8601String(),
                    'media' => $task->gallery->map(fn ($link): array => [
                        'id' => $link->asset_id,
                        'url' => $this->assets->url($link->asset),
                        'name' => $link->asset?->original_name,
                    ])->values()->all(),
                    'documents' => $task->documents->map(fn ($link): array => [
                        'id' => $link->asset_id,
                        'url' => $this->assets->url($link->asset),
                        'name' => $link->asset?->original_name,
                    ])->values()->all(),
                ];
            })
            ->values()
            ->all();
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

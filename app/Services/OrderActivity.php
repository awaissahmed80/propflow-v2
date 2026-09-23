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

    /**
     * System / lifecycle event on a booking (payment, stage advance, transfer, etc.).
     */
    public function log(
        Order $order,
        string $action,
        ?string $comments = null,
        ?int $userId = null,
    ): Task {
        return $this->write(
            $order,
            $action,
            $comments,
            $userId,
            Task::TYPE_LOG,
            Task::STATUS_COMPLETED,
        );
    }

    /**
     * User-submitted booking activity from the composer.
     */
    public function action(
        Order $order,
        string $action,
        ?string $comments = null,
        ?int $userId = null,
        string $status = Task::STATUS_COMPLETED,
    ): Task {
        return $this->write(
            $order,
            $action,
            $comments,
            $userId,
            Task::TYPE_ACTION,
            $status,
        );
    }

    /**
     * @param  array{action: string, comments: string, media_ids?: list<int>, document_ids?: list<int>}  $data
     */
    public function recordUpdate(Order $order, array $data, ?int $userId): Task
    {
        return DB::connection('tenant')->transaction(function () use ($order, $data, $userId): Task {
            $update = $this->action(
                $order,
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

            return $update;
        });
    }

    /**
     * @return list<array{id: int, action: string, comments: ?string, type: string, status: string, stage: ?string, stage_label: ?string, user: ?array{id: int, display_name: string, avatar: ?string}, created_at: ?string, media: list<array<string, mixed>>, documents: list<array<string, mixed>>, attachments: list<array<string, mixed>>}>
     */
    public function timeline(Order $order): array
    {
        $order->loadMissing(['activities.user', 'activities.gallery.asset', 'activities.documents.asset']);

        $userIds = $order->activities
            ->pluck('user_id')
            ->filter()
            ->unique()
            ->values()
            ->all();

        $avatars = $userIds === []
            ? collect()
            : $this->assets->urlsFor(User::class, $userIds, AssetManager::LINKAGE_AVATAR);

        return $order->activities
            ->sortBy('id')
            ->values()
            ->map(function (Task $task) use ($avatars): array {
                $media = $task->gallery->map(fn ($link): array => [
                    'id' => $link->asset_id,
                    'url' => $this->assets->url($link->asset),
                    'name' => $link->asset?->name,
                    'type' => $link->asset?->type,
                    'kind' => 'media',
                    'thumbnail_url' => filled($link->asset?->thumbnail) && ! str_starts_with((string) $link->asset?->type, 'audio/')
                        ? url('assets/'.$link->asset->thumbnail)
                        : null,
                ])->values()->all();

                $documents = $task->documents->map(fn ($link): array => [
                    'id' => $link->asset_id,
                    'url' => $this->assets->url($link->asset),
                    'name' => $link->asset?->name,
                    'type' => $link->asset?->type,
                    'kind' => 'document',
                    'thumbnail_url' => filled($link->asset?->thumbnail) && ! str_starts_with((string) $link->asset?->type, 'audio/')
                        ? url('assets/'.$link->asset->thumbnail)
                        : null,
                ])->values()->all();

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
                        'avatar' => $avatars->get($task->user->id),
                    ] : null,
                    'created_at' => $task->created_at?->toIso8601String(),
                    'media' => $media,
                    'documents' => $documents,
                    'attachments' => [...$media, ...$documents],
                ];
            })
            ->all();
    }

    protected function write(
        Order $order,
        string $action,
        ?string $comments,
        ?int $userId,
        string $type,
        string $status,
    ): Task {
        $stage = $order->stage ?: Order::STAGE_TOKEN;

        return $order->activities()->create([
            'user_id' => $userId,
            'stage' => $stage,
            'stage_label' => OrderStage::titleFor($stage),
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

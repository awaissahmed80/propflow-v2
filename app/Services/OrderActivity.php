<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\Lead;
use App\Models\Order;
use App\Models\OrderPayment;
use App\Models\OrderStage;
use App\Models\PaymentInstallment;
use App\Models\Task;
use App\Models\User;
use App\Support\AssetManager;
use Illuminate\Support\Collection;
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
     *
     * @param  list<int>  $documentIds
     */
    public function log(
        Order $order,
        string $action,
        ?string $comments = null,
        ?int $userId = null,
        array $documentIds = [],
    ): Task {
        return DB::connection('tenant')->transaction(function () use ($order, $action, $comments, $userId, $documentIds): Task {
            $task = $this->write(
                $order,
                $action,
                $comments,
                $userId,
                Task::TYPE_LOG,
                Task::STATUS_COMPLETED,
            );

            $ids = collect($documentIds)
                ->map(fn ($id): int => (int) $id)
                ->filter(fn (int $id): bool => $id > 0)
                ->unique()
                ->values()
                ->all();

            if ($ids !== []) {
                $this->assets->syncLinks($task, AssetManager::LINKAGE_DOCUMENT, $ids);
            }

            return $task;
        });
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
     * @return list<array{id: int, action: string, comments: ?string, type: string, status: string, stage: ?string, stage_label: ?string, source: string, user: ?array{id: int, display_name: string, avatar: ?string}, created_at: ?string, media: list<array<string, mixed>>, documents: list<array<string, mixed>>, attachments: list<array<string, mixed>>}>
     */
    public function timeline(Order $order): array
    {
        $order->loadMissing([
            'activities.user',
            'activities.gallery.asset',
            'activities.documents.asset',
            'lead.tasks.user',
            'lead.tasks.gallery.asset',
            'lead.tasks.documents.asset',
            'payments.installment',
        ]);

        $bookingTasks = $order->activities ?? collect();
        $leadTasks = $this->historicalLeadTasks($order);

        /** @var Collection<int, Task> $tasks */
        $tasks = $bookingTasks
            ->concat($leadTasks)
            ->unique('id')
            ->values();

        $userIds = $tasks
            ->pluck('user_id')
            ->filter()
            ->unique()
            ->values()
            ->all();

        $avatars = $userIds === []
            ? collect()
            : $this->assets->urlsFor(User::class, $userIds, AssetManager::LINKAGE_AVATAR);

        $leadTaskIds = $leadTasks->pluck('id')->all();

        $entries = $tasks
            ->sortBy([
                fn (Task $task): int => $task->created_at?->getTimestamp() ?? 0,
                fn (Task $task): int => (int) $task->id,
            ])
            ->values()
            ->map(function (Task $task) use ($avatars, $leadTaskIds): array {
                $fromLead = in_array($task->id, $leadTaskIds, true);

                return $this->entryFromTask(
                    $task,
                    $avatars,
                    $fromLead ? 'lead' : 'booking',
                    $fromLead ? 'Lead' : ($task->stage_label ?: OrderStage::titleFor($task->stage)),
                );
            })
            ->all();

        return $this->attachPaymentReceiptFallbacks($order, $entries);
    }

    /**
     * For older payment logs that predate task-linked receipts, surface the payment proof.
     *
     * @param  list<array<string, mixed>>  $entries
     * @return list<array<string, mixed>>
     */
    protected function attachPaymentReceiptFallbacks(Order $order, array $entries): array
    {
        $payments = $order->payments ?? collect();

        if ($payments->isEmpty()) {
            return $entries;
        }

        $tokenPayment = $payments->first(
            fn (OrderPayment $payment): bool => $payment->receipt_asset_id !== null
                && $payment->installment?->kind === PaymentInstallment::KIND_TOKEN,
        );

        $otherPayments = $payments
            ->filter(
                fn (OrderPayment $payment): bool => $payment->receipt_asset_id !== null
                    && $payment->installment?->kind !== PaymentInstallment::KIND_TOKEN,
            )
            ->sortBy('id')
            ->values();

        $assetIds = collect([$tokenPayment?->receipt_asset_id])
            ->merge($otherPayments->pluck('receipt_asset_id'))
            ->filter()
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values()
            ->all();

        if ($assetIds === []) {
            return $entries;
        }

        $assets = Asset::query()->whereKey($assetIds)->get()->keyBy('id');
        $paymentIndex = 0;

        foreach ($entries as $index => $entry) {
            if (($entry['attachments'] ?? []) !== []) {
                continue;
            }

            $asset = null;

            if (($entry['action'] ?? null) === 'Token verified' && $tokenPayment !== null) {
                $asset = $assets->get($tokenPayment->receipt_asset_id);
            } elseif (($entry['action'] ?? null) === 'Payment recorded') {
                $payment = $otherPayments->get($paymentIndex);

                if ($payment !== null) {
                    $paymentIndex++;
                    $asset = $assets->get($payment->receipt_asset_id);
                }
            }

            if (! $asset instanceof Asset) {
                continue;
            }

            $document = $this->documentPayload($asset);
            $entries[$index]['documents'] = [$document];
            $entries[$index]['attachments'] = [$document];
        }

        return $entries;
    }

    /**
     * @return array{id: int, url: string|null, name: ?string, type: ?string, kind: string, thumbnail_url: ?string}
     */
    protected function documentPayload(Asset $asset): array
    {
        return [
            'id' => $asset->id,
            'url' => $this->assets->url($asset),
            'name' => $asset->name,
            'type' => $asset->type,
            'kind' => 'document',
            'thumbnail_url' => filled($asset->thumbnail) && ! str_starts_with((string) $asset->type, 'audio/')
                ? url('assets/'.$asset->thumbnail)
                : null,
        ];
    }

    /**
     * Completed lead history from before this booking was created.
     *
     * @return Collection<int, Task>
     */
    protected function historicalLeadTasks(Order $order): Collection
    {
        $lead = $order->lead;

        if (! $lead instanceof Lead) {
            return collect();
        }

        $bookingCreatedAt = $order->created_at;

        return $lead->tasks
            ->filter(function (Task $task) use ($bookingCreatedAt): bool {
                if ($task->status === Task::STATUS_PENDING) {
                    return false;
                }

                if ($bookingCreatedAt === null || $task->created_at === null) {
                    return true;
                }

                // Keep lead history up to booking creation; later booking mirrors stay on the order timeline.
                return $task->created_at->lessThanOrEqualTo($bookingCreatedAt);
            })
            ->values();
    }

    /**
     * @param  Collection<int, string|null>  $avatars
     * @return array{id: int, action: string, comments: ?string, type: string, status: string, stage: ?string, stage_label: ?string, source: string, user: ?array{id: int, display_name: string, avatar: ?string}, created_at: ?string, media: list<array<string, mixed>>, documents: list<array<string, mixed>>, attachments: list<array<string, mixed>>}
     */
    protected function entryFromTask(Task $task, Collection $avatars, string $source, ?string $stageLabel): array
    {
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
            'stage_label' => $stageLabel,
            'source' => $source,
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

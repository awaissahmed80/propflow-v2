<?php

namespace App\Http\Resources\Portal;

use App\Models\AssetLink;
use App\Models\Lead;
use App\Models\Order;
use App\Models\Task;
use App\Services\LeadScoreCalculator;
use App\Support\AssetManager;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Lead
 */
class LeadResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $contact = $this->whenLoaded('contact', fn () => $this->contact);

        return [
            'id' => $this->id,
            'code' => $this->code,
            'contact_id' => $this->contact_id,
            'user_id' => $this->user_id,
            'project_id' => $this->project_id,
            'unit_id' => $this->unit_id,
            'assigned_to' => $this->assigned_to,
            'source' => $this->source,
            'campaign_id' => $this->campaign_id,
            'score' => $this->score !== null ? (int) $this->score : null,
            'engagement' => app(LeadScoreCalculator::class)->engagement($this->resource),
            'next_action' => $this->next_action,
            'due_date' => $this->due_date?->toIso8601String(),
            'lead_stage_id' => $this->lead_stage_id,
            'tag' => $this->tag,
            'budget' => $this->budget !== null ? (float) $this->budget : null,
            'notes' => $this->notes,
            'contacted_at' => $this->contacted_at?->toIso8601String(),
            'archived_at' => $this->archived_at?->toIso8601String(),
            'last_activity_at' => ($this->contacted_at ?? $this->updated_at)?->toIso8601String(),
            'contact' => $contact ? [
                'id' => $contact->id,
                'uuid' => $contact->uuid,
                'first_name' => $contact->first_name,
                'last_name' => $contact->last_name,
                'email_address' => $contact->email_address,
                'phone_number' => $contact->phone_number,
                'reference' => $contact->reference,
                'type' => $contact->type,
                'tag' => $contact->tag,
                'display_name' => trim(implode(' ', array_filter([
                    $contact->first_name,
                    $contact->last_name,
                ]))) ?: 'Contact #'.$contact->id,
            ] : null,
            'project' => $this->whenLoaded('project', fn () => $this->project ? [
                'id' => $this->project->id,
                'title' => $this->project->title,
                'code' => $this->project->code,
                'thumbnail' => $this->project->getAttribute('thumbnail_url'),
            ] : null),
            'unit' => $this->whenLoaded('unit', fn () => $this->unit ? [
                'id' => $this->unit->id,
                'code' => $this->unit->code,
                'name' => $this->unit->name,
                'price' => $this->unit->price !== null ? (float) $this->unit->price : null,
                'status' => $this->unit->status,
            ] : null),
            'stage' => $this->whenLoaded('stage', fn () => $this->stage ? [
                'id' => $this->stage->id,
                'label' => $this->stage->label,
                'title' => $this->stage->title,
                'color' => $this->stage->color,
                'priority' => $this->stage->priority,
            ] : null),
            'campaign' => $this->whenLoaded('campaign', fn () => $this->campaign ? [
                'id' => $this->campaign->id,
                'title' => $this->campaign->title,
                'public_id' => $this->campaign->public_id,
            ] : null),
            'active_order' => $this->whenLoaded('activeOrder', fn () => $this->activeOrder ? [
                'id' => $this->activeOrder->id,
                'code' => $this->activeOrder->code,
                'status' => $this->activeOrder->status,
                'stage' => $this->activeOrder->stage ?: Order::STAGE_TOKEN,
                'booking_kind' => $this->activeOrder->booking_kind,
                'agreed_price' => $this->activeOrder->agreed_price !== null
                    ? (float) $this->activeOrder->agreed_price
                    : null,
                'booked_at' => $this->activeOrder->booked_at?->toIso8601String(),
                'liaison_active' => $this->activeOrder->isLiaisonActive(),
            ] : null),
            'deal_locked' => $this->relationLoaded('activeOrder')
                ? $this->activeOrder !== null
                : false,
            'assignee' => $this->when(
                $this->relationLoaded('assignee'),
                fn () => $this->assignee ? [
                    'id' => $this->assignee->id,
                    'code' => $this->assignee->getAttribute('code'),
                    'display_name' => $this->assignee->display_name,
                    'avatar' => $this->assignee->getAttribute('avatar'),
                ] : null,
            ),
            'creator' => $this->when(
                $this->relationLoaded('creator'),
                fn () => $this->creator ? [
                    'id' => $this->creator->id,
                    'code' => $this->creator->getAttribute('code'),
                    'display_name' => $this->creator->display_name,
                    'avatar' => $this->creator->getAttribute('avatar'),
                ] : null,
            ),
            'shared_users' => $this->when(
                $this->relationLoaded('sharedUsers'),
                fn () => $this->sharedUsers
                    ->filter()
                    ->map(fn ($user): array => [
                        'id' => $user->id,
                        'code' => $user->getAttribute('code'),
                        'display_name' => $user->display_name,
                        'avatar' => $user->getAttribute('avatar'),
                    ])
                    ->values()
                    ->all(),
            ),
            'tasks' => $this->whenLoaded('tasks', fn () => $this->tasks->map(fn (Task $task): array => [
                'id' => $task->id,
                'action' => $task->action,
                'comments' => $task->comments,
                'status' => $task->status,
                'type' => $task->type,
                'created_at' => $task->created_at?->toIso8601String(),
                'user' => $task->relationLoaded('user') && $task->user ? [
                    'id' => $task->user->id,
                    'display_name' => $task->user->display_name,
                    'avatar' => $task->user->getAttribute('avatar'),
                ] : null,
                'attachments' => $this->taskAttachments($task),
            ])->values()->all()),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    /**
     * @return list<array{id: int, name: string|null, url: string|null, thumbnail_url: string|null, type: string|null, kind: string}>
     */
    private function taskAttachments(Task $task): array
    {
        $assets = app(AssetManager::class);
        $rows = [];

        if ($task->relationLoaded('gallery')) {
            foreach ($task->gallery as $link) {
                $payload = $this->attachmentPayload($link, 'media', $assets);

                if ($payload !== null) {
                    $rows[] = $payload;
                }
            }
        }

        if ($task->relationLoaded('documents')) {
            foreach ($task->documents as $link) {
                $payload = $this->attachmentPayload($link, 'document', $assets);

                if ($payload !== null) {
                    $rows[] = $payload;
                }
            }
        }

        return $rows;
    }

    /**
     * @return array{id: int, name: string|null, url: string|null, thumbnail_url: string|null, type: string|null, kind: string}|null
     */
    private function attachmentPayload(AssetLink $link, string $kind, AssetManager $assets): ?array
    {
        $asset = $link->asset;

        if ($asset === null) {
            return null;
        }

        return [
            'id' => $asset->id,
            'name' => $asset->name,
            'url' => $assets->url($asset),
            'thumbnail_url' => filled($asset->thumbnail) ? url('assets/'.$asset->thumbnail) : null,
            'type' => $asset->type,
            'kind' => $kind,
        ];
    }
}

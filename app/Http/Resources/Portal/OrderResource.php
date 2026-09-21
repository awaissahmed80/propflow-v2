<?php

namespace App\Http\Resources\Portal;

use App\Models\Order;
use App\Models\PaymentInstallment;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Order
 */
class OrderResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $contact = $this->relationLoaded('contact') ? $this->contact : null;
        $plan = $this->relationLoaded('paymentPlan') ? $this->paymentPlan : null;
        $lead = $this->relationLoaded('lead') ? $this->lead : null;
        $assignee = $this->relationLoaded('assignee') ? $this->assignee : null;
        $soldBy = $this->resolveSoldBy($lead);

        return [
            'id' => $this->id,
            'code' => $this->code,
            'lead_id' => $this->lead_id,
            'booking_kind' => $this->booking_kind,
            'agreed_price' => $this->agreed_price !== null ? (float) $this->agreed_price : 0,
            'status' => $this->status,
            'stage' => $this->stage ?: Order::STAGE_TOKEN,
            'assigned_to' => $this->assigned_to,
            'booked_at' => $this->booked_at?->toIso8601String(),
            'allocated_at' => $this->allocated_at?->toIso8601String(),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'unpaid_count' => $this->unpaid_count ?? null,
            'contact' => $contact ? [
                'id' => $contact->id,
                'display_name' => trim(implode(' ', array_filter([
                    $contact->first_name,
                    $contact->last_name,
                ]))) ?: 'Contact #'.$contact->id,
                'phone_number' => $contact->phone_number,
                'email_address' => $contact->email_address,
                'type' => $contact->type ?? null,
            ] : null,
            'project' => $this->whenLoaded('project', fn () => $this->project ? [
                'id' => $this->project->id,
                'title' => $this->project->title,
                'code' => $this->project->code ?? null,
                'thumbnail' => $this->project->getAttribute('thumbnail_url'),
            ] : null),
            'unit' => $this->whenLoaded('unit', fn () => $this->unit ? [
                'id' => $this->unit->id,
                'code' => $this->unit->code,
                'name' => $this->unit->name,
                'status' => $this->unit->status,
            ] : null),
            'lead' => $lead ? [
                'id' => $lead->id,
                'code' => $lead->code,
                'tag' => $lead->tag,
                'source' => $lead->source ?? null,
                'budget' => $lead->budget !== null ? (float) $lead->budget : null,
                'stage' => $lead->relationLoaded('stage') && $lead->stage ? [
                    'id' => $lead->stage->id,
                    'label' => $lead->stage->label,
                    'title' => $lead->stage->title,
                    'color' => $lead->stage->color,
                ] : null,
                'project' => $lead->relationLoaded('project') && $lead->project ? [
                    'id' => $lead->project->id,
                    'title' => $lead->project->title,
                    'code' => $lead->project->code,
                ] : null,
            ] : null,
            'assignee' => $assignee ? [
                'id' => $assignee->id,
                'display_name' => $assignee->display_name
                    ?: trim($assignee->first_name.' '.$assignee->last_name),
                'email_address' => $assignee->email_address ?? null,
                'title' => null,
                'avatar' => $assignee->getAttribute('avatar'),
            ] : null,
            'sold_by' => $soldBy,
            'installments' => $plan && $plan->relationLoaded('installments')
                ? $plan->installments->map(fn (PaymentInstallment $row): array => [
                    'id' => $row->id,
                    'sequence' => $row->sequence,
                    'label' => $row->label,
                    'amount' => (float) $row->amount,
                    'due_on' => $row->due_on?->toDateString(),
                    'status' => $row->status,
                    'paid_at' => $row->paid_at?->toIso8601String(),
                ])->values()->all()
                : [],
        ];
    }

    /**
     * @return array{id: int, display_name: string, email_address: ?string, title: ?string, avatar: mixed}|null
     */
    protected function resolveSoldBy(mixed $lead): ?array
    {
        if ($lead === null) {
            return null;
        }

        $user = null;

        if ($lead->relationLoaded('assignee') && $lead->assignee) {
            $user = $lead->assignee;
        } elseif ($lead->relationLoaded('creator') && $lead->creator) {
            $user = $lead->creator;
        } elseif ($lead->assigned_to) {
            $user = User::query()->find($lead->assigned_to);
        } elseif ($lead->user_id) {
            $user = User::query()->find($lead->user_id);
        }

        if ($user === null) {
            return null;
        }

        return [
            'id' => $user->id,
            'display_name' => $user->display_name
                ?: trim($user->first_name.' '.$user->last_name),
            'email_address' => $user->email_address ?? null,
            'title' => null,
            'avatar' => $user->getAttribute('avatar'),
        ];
    }
}

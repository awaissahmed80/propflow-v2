<?php

namespace App\Http\Resources\Portal;

use App\Models\Order;
use App\Models\PaymentInstallment;
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

        return [
            'id' => $this->id,
            'code' => $this->code,
            'lead_id' => $this->lead_id,
            'booking_kind' => $this->booking_kind,
            'agreed_price' => $this->agreed_price !== null ? (float) $this->agreed_price : 0,
            'status' => $this->status,
            'stage' => $this->stage ?: Order::STAGE_BOOKING,
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
            ] : null,
            'project' => $this->whenLoaded('project', fn () => $this->project ? [
                'id' => $this->project->id,
                'title' => $this->project->title,
            ] : null),
            'unit' => $this->whenLoaded('unit', fn () => $this->unit ? [
                'id' => $this->unit->id,
                'code' => $this->unit->code,
                'name' => $this->unit->name,
                'status' => $this->unit->status,
            ] : null),
            'lead' => $this->whenLoaded('lead', fn () => $this->lead ? [
                'id' => $this->lead->id,
                'code' => $this->lead->code,
            ] : null),
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
}

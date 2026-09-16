<?php

namespace App\Http\Resources\Portal;

use App\Models\Lead;
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
            'score' => $this->score,
            'next_action' => $this->next_action,
            'due_date' => $this->due_date?->toIso8601String(),
            'lead_stage_id' => $this->lead_stage_id,
            'tag' => $this->tag,
            'budget' => $this->budget !== null ? (float) $this->budget : null,
            'notes' => $this->notes,
            'contacted_at' => $this->contacted_at?->toIso8601String(),
            'contact' => $contact ? [
                'id' => $contact->id,
                'first_name' => $contact->first_name,
                'last_name' => $contact->last_name,
                'email_address' => $contact->email_address,
                'phone_number' => $contact->phone_number,
                'display_name' => trim(implode(' ', array_filter([
                    $contact->first_name,
                    $contact->last_name,
                ]))) ?: 'Contact #'.$contact->id,
            ] : null,
            'project' => $this->whenLoaded('project', fn () => $this->project ? [
                'id' => $this->project->id,
                'title' => $this->project->title,
                'code' => $this->project->code,
            ] : null),
            'unit' => $this->whenLoaded('unit', fn () => $this->unit ? [
                'id' => $this->unit->id,
                'code' => $this->unit->code,
                'name' => $this->unit->name,
            ] : null),
            'stage' => $this->whenLoaded('stage', fn () => $this->stage ? [
                'id' => $this->stage->id,
                'label' => $this->stage->label,
                'title' => $this->stage->title,
                'color' => $this->stage->color,
                'priority' => $this->stage->priority,
            ] : null),
            'assignee' => $this->when(
                $this->relationLoaded('assignee'),
                fn () => $this->assignee ? [
                    'id' => $this->assignee->id,
                    'display_name' => $this->assignee->display_name,
                ] : null,
            ),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}

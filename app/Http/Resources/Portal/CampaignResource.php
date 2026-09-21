<?php

namespace App\Http\Resources\Portal;

use App\Models\Campaign;
use App\Models\Tenant;
use App\Support\Domain;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Campaign
 */
class CampaignResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $identifier = Tenant::current()?->identifier;
        $isExternalIntake = in_array($this->source_type, [
            Campaign::SOURCE_FACEBOOK,
            Campaign::SOURCE_WHATSAPP,
        ], true);
        $landingPath = ! $isExternalIntake && $identifier
            ? '/'.$identifier.'/c/'.($this->slug ?: $this->public_id)
            : null;

        return [
            'id' => $this->id,
            'public_id' => $this->public_id,
            'slug' => $this->slug,
            'title' => $this->title,
            'description' => $this->description,
            'purpose' => $this->purpose,
            'source_type' => $this->source_type,
            'source_config' => $this->source_config ?? [],
            'channel' => $this->channel,
            'owner_id' => $this->owner_id,
            'budget' => $this->budget !== null ? (float) $this->budget : null,
            'target_cpl' => $this->target_cpl !== null ? (float) $this->target_cpl : null,
            'tags' => $this->tags ?? [],
            'utm' => array_merge(Campaign::defaultUtm(), $this->utm ?? []),
            'default_assignee_id' => $this->default_assignee_id,
            'default_lead_stage_id' => $this->default_lead_stage_id,
            'status' => $this->status,
            'project_id' => $this->project_id,
            'campaign_form_id' => $this->campaign_form_id,
            'landing' => $this->landing ?? [],
            'goals' => $this->goals ?? Campaign::defaultGoals(),
            'starts_at' => $this->starts_at?->toIso8601String(),
            'ends_at' => $this->ends_at?->toIso8601String(),
            'project' => $this->whenLoaded('project', fn () => $this->project ? [
                'id' => $this->project->id,
                'title' => $this->project->title,
                'code' => $this->project->code,
            ] : null),
            'form' => $this->whenLoaded('form', fn () => $this->form ? [
                'id' => $this->form->id,
                'public_id' => $this->form->public_id,
                'name' => $this->form->name,
                'status' => $this->form->status,
            ] : null),
            'landing_url' => $landingPath ? Domain::campaign($landingPath) : null,
            'embed_snippet' => $this->when(
                ! $isExternalIntake && $this->relationLoaded('form') && $this->form && $identifier,
                fn () => $this->embedSnippet($identifier, $this->form->public_id),
            ),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    protected function embedSnippet(string $identifier, string $formPublicId): string
    {
        $src = Domain::campaign('/'.$identifier.'/form.js?id='.$formPublicId);

        return <<<HTML
<!-- PropFlow Lead Form Embed -->
<div id="propflow-form"></div>
<script>
    (function () {
        var script = document.createElement("script");
        script.src = "{$src}";
        script.async = true;
        document.getElementById("propflow-form").appendChild(script);
    })();
</script>
HTML;
    }
}

<?php

namespace App\Http\Resources\Portal;

use App\Models\CampaignForm;
use App\Models\Tenant;
use App\Support\Domain;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin CampaignForm
 */
class CampaignFormResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $identifier = Tenant::current()?->identifier;
        $scriptUrl = $identifier
            ? Domain::campaign('/'.$identifier.'/form.js?id='.$this->public_id)
            : null;

        return [
            'id' => $this->id,
            'public_id' => $this->public_id,
            'name' => $this->name,
            'status' => $this->status,
            'fields' => $this->fields ?? CampaignForm::defaultFields(),
            'settings' => array_merge(CampaignForm::defaultSettings(), $this->settings ?? []),
            'branding' => $this->branding ?? [],
            'embed_script_url' => $scriptUrl,
            'embed_snippet' => $scriptUrl ? $this->embedSnippet($scriptUrl) : null,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    protected function embedSnippet(string $src): string
    {
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

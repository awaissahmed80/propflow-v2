<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\UpdateLeadWebhookRequest;
use App\Models\LeadWebhook;
use Illuminate\Http\RedirectResponse;

class LeadWebhookController extends Controller
{
    public function update(UpdateLeadWebhookRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $webhook = LeadWebhook::ensure();

        $webhook->fill([
            'enabled' => $validated['enabled'],
            'default_source' => filled($validated['default_source'] ?? null)
                ? $validated['default_source']
                : null,
            'default_campaign_id' => $validated['default_campaign_id'] ?? null,
            'default_lead_stage_id' => $validated['default_lead_stage_id'] ?? null,
            'default_assignee_id' => $validated['default_assignee_id'] ?? null,
        ])->save();

        return back();
    }

    public function rotate(): RedirectResponse
    {
        $webhook = LeadWebhook::ensure();
        $webhook->signing_secret = LeadWebhook::generateSecret();
        $webhook->save();

        return back();
    }
}

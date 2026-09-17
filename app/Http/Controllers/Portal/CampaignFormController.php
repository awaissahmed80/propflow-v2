<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\StoreCampaignFormRequest;
use App\Http\Requests\Portal\UpdateCampaignFormRequest;
use App\Models\CampaignForm;
use Illuminate\Http\RedirectResponse;

class CampaignFormController extends Controller
{
    public function store(StoreCampaignFormRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        CampaignForm::query()->create([
            'name' => $validated['name'],
            'status' => $validated['status'] ?? CampaignForm::STATUS_DRAFT,
            'fields' => $validated['fields'] ?? CampaignForm::defaultFields(),
            'settings' => array_merge(
                CampaignForm::defaultSettings(),
                $validated['settings'] ?? [],
            ),
            'branding' => $validated['branding'] ?? ['button_label' => 'Submit'],
        ]);

        return back();
    }

    public function update(UpdateCampaignFormRequest $request, CampaignForm $form): RedirectResponse
    {
        $validated = $request->validated();

        if (array_key_exists('settings', $validated)) {
            $validated['settings'] = array_merge(
                CampaignForm::defaultSettings(),
                $form->settings ?? [],
                $validated['settings'] ?? [],
            );
        }

        $form->fill($validated);
        $form->save();

        return back();
    }

    public function destroy(CampaignForm $form): RedirectResponse
    {
        $form->delete();

        return back();
    }
}

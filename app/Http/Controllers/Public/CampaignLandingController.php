<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Public\PublicFormController as FormController;
use App\Models\Campaign;
use App\Support\AssetManager;
use App\Support\Domain;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CampaignLandingController extends Controller
{
    public function __construct(protected AssetManager $assets) {}

    public function show(Request $request, string $identifier, string $campaign): Response
    {
        $model = Campaign::query()
            ->with(['project', 'form'])
            ->where(function ($query) use ($campaign): void {
                $query->where('public_id', $campaign)
                    ->orWhere('slug', $campaign);
            })
            ->firstOrFail();

        if (! $model->isActive()) {
            abort(404);
        }

        $form = $model->form;

        if (! $form || ! $form->isActive()) {
            abort(404);
        }

        $project = $model->project;
        $thumbnail = null;

        if ($project) {
            $project->loadMissing('thumbnail.asset');
            $thumbnail = $this->assets->url($project->thumbnail?->asset);
        }

        $formController = app(FormController::class);
        $landing = $model->landing ?? [];

        return Inertia::render('campaigns/landing', [
            'tenantIdentifier' => $identifier,
            'campaign' => [
                'public_id' => $model->public_id,
                'slug' => $model->slug,
                'title' => $model->title,
                'landing' => [
                    'headline' => $landing['headline'] ?? $model->title,
                    'subheadline' => $landing['subheadline'] ?? null,
                    'body' => $landing['body'] ?? null,
                    'highlights' => $landing['highlights'] ?? [],
                    'cta_label' => $landing['cta_label'] ?? 'Register interest',
                    'hero_image' => $landing['hero_image'] ?? $thumbnail,
                    'thank_you_message' => $landing['thank_you_message'] ?? null,
                ],
            ],
            'project' => $project ? [
                'id' => $project->id,
                'title' => $project->title,
                'code' => $project->code,
                'city' => $project->city,
                'location' => $project->location,
                'description' => $project->description,
                'thumbnail' => $thumbnail,
            ] : null,
            'form' => $formController->formPayload($form),
            'submitUrl' => Domain::app('/'.$identifier.'/forms/'.$form->public_id.'/submit'),
            'embedScriptUrl' => Domain::app('/'.$identifier.'/form.js?id='.$form->public_id),
        ]);
    }
}

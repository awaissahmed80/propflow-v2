<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Public\PublicFormController as FormController;
use App\Models\Campaign;
use App\Models\CampaignForm;
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
            ->with(['project', 'form', 'thumbnail.asset', 'gallery.asset'])
            ->where(function ($query) use ($campaign): void {
                $query->where('public_id', $campaign)
                    ->orWhere('slug', $campaign);
            })
            ->firstOrFail();

        if ($model->status === Campaign::STATUS_ARCHIVED) {
            abort(404);
        }

        if (in_array($model->source_type, [Campaign::SOURCE_FACEBOOK, Campaign::SOURCE_WHATSAPP], true)) {
            abort(404);
        }

        $form = $model->form;

        if (! $form || $form->status === CampaignForm::STATUS_ARCHIVED) {
            abort(404);
        }

        if ($model->isActive() && ! $form->isActive()) {
            abort(404);
        }

        $project = $model->project;
        $landing = $model->landing ?? [];
        $heroImage = $this->assets->url($model->thumbnail?->asset)
            ?: ($landing['hero_image'] ?? null);
        $projectThumbnail = null;

        if ($project) {
            $project->loadMissing('thumbnail.asset');
            $projectThumbnail = $this->assets->url($project->thumbnail?->asset);
            $heroImage ??= $projectThumbnail;
        }

        $formController = app(FormController::class);
        $isPreview = ! $model->isActive() || ! $form->isActive();
        $gallery = $model->gallery
            ->map(fn ($link) => $this->assets->url($link->asset))
            ->filter()
            ->values()
            ->all();

        return Inertia::render('campaigns/landing', [
            'tenantIdentifier' => $identifier,
            'isPreview' => $isPreview,
            'campaign' => [
                'public_id' => $model->public_id,
                'slug' => $model->slug,
                'title' => $model->title,
                'status' => $model->status,
                'landing' => [
                    'headline' => $landing['headline'] ?? $model->title,
                    'subheadline' => $landing['subheadline'] ?? null,
                    'body' => $landing['body'] ?? null,
                    'highlights' => $landing['highlights'] ?? [],
                    'cta_label' => $landing['cta_label'] ?? 'Register interest',
                    'hero_image' => $heroImage,
                    'gallery' => $gallery,
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
                'thumbnail' => $projectThumbnail,
            ] : null,
            'form' => $formController->formPayload($form),
            'submitUrl' => Domain::campaign('/'.$identifier.'/forms/'.$form->public_id.'/submit'),
            'embedScriptUrl' => Domain::campaign('/'.$identifier.'/form.js?id='.$form->public_id),
        ]);
    }
}

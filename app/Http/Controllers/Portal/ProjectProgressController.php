<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\StoreProjectProgressRequest;
use App\Http\Requests\Portal\UpdateProjectProgressRequest;
use App\Models\Project;
use App\Models\ProjectProgress;
use Illuminate\Http\RedirectResponse;

class ProjectProgressController extends Controller
{
    public function store(StoreProjectProgressRequest $request, string $project): RedirectResponse
    {
        $projectModel = Project::query()->where('code', $project)->firstOrFail();
        $validated = $request->validated();

        $nextOrder = ((int) $projectModel->phases()->max('order')) + 1;

        $projectModel->phases()->create([
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'status' => $validated['status'] ?? 'planned',
            'progress' => (int) ($validated['progress'] ?? 0),
            'start_date' => $validated['start_date'] ?? null,
            'end_date' => $validated['end_date'] ?? null,
            'order' => $validated['order'] ?? $nextOrder,
        ]);

        return to_route('portal.projects.show', $projectModel);
    }

    public function update(
        UpdateProjectProgressRequest $request,
        string $project,
        int $progress,
    ): RedirectResponse {
        $projectModel = Project::query()->where('code', $project)->firstOrFail();
        $progressModel = $this->progressForProject($projectModel, $progress);
        $validated = $request->validated();

        $attributes = [];

        foreach (['title', 'description', 'status', 'start_date', 'end_date', 'order'] as $field) {
            if (array_key_exists($field, $validated)) {
                $attributes[$field] = $validated[$field];
            }
        }

        if (array_key_exists('progress', $validated)) {
            $attributes['progress'] = (int) $validated['progress'];
        }

        if ($attributes !== []) {
            $progressModel->forceFill($attributes)->save();
        }

        return to_route('portal.projects.show', $projectModel);
    }

    public function destroy(string $project, int $progress): RedirectResponse
    {
        $projectModel = Project::query()->where('code', $project)->firstOrFail();
        $this->progressForProject($projectModel, $progress)->forceDelete();

        return to_route('portal.projects.show', $projectModel);
    }

    protected function progressForProject(Project $project, int $progressId): ProjectProgress
    {
        return ProjectProgress::query()
            ->where('project_id', $project->id)
            ->whereKey($progressId)
            ->firstOrFail();
    }
}

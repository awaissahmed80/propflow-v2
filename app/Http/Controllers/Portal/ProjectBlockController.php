<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\StoreProjectBlockRequest;
use App\Http\Requests\Portal\UpdateProjectBlockRequest;
use App\Http\Resources\Portal\ProjectBlockResource;
use App\Models\ProjectBlock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectBlockController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $projectId = $request->integer('project_id') ?: null;

        $blocks = ProjectBlock::query()
            ->withCount('units')
            ->when($projectId, fn ($query) => $query->where('project_id', $projectId))
            ->orderBy('title')
            ->get();

        return response()->json([
            'data' => ProjectBlockResource::collection($blocks)->resolve(),
        ]);
    }

    public function store(StoreProjectBlockRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $block = ProjectBlock::query()->create([
            'project_id' => $validated['project_id'],
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
        ]);

        $block->loadCount('units');

        return response()->json([
            'data' => (new ProjectBlockResource($block))->resolve(),
        ], 201);
    }

    public function update(UpdateProjectBlockRequest $request, ProjectBlock $block): JsonResponse
    {
        $block->fill($request->validated())->save();
        $block->loadCount('units');

        return response()->json([
            'data' => (new ProjectBlockResource($block))->resolve(),
        ]);
    }

    public function destroy(ProjectBlock $block): JsonResponse
    {
        $block->delete();

        return response()->json(['ok' => true]);
    }
}

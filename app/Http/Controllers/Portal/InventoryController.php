<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Resources\Portal\ProjectBlockResource;
use App\Http\Resources\Portal\UnitResource;
use App\Models\MetaData;
use App\Models\Project;
use App\Models\ProjectBlock;
use App\Models\Unit;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class InventoryController extends Controller
{
    public function index(Request $request): Response
    {
        $query = $request->string('q')->trim()->toString();
        $projectCode = $request->string('project')->trim()->toString();
        $blockId = $request->integer('block_id') ?: null;
        $status = $request->string('status')->trim()->toString();
        $type = $request->string('type')->trim()->toString();

        $projectId = $projectCode !== ''
            ? Project::query()->where('code', $projectCode)->value('id')
            : null;

        $units = Unit::query()
            ->with(['project:id,title,code', 'block:id,title,project_id'])
            ->when($query !== '', function ($builder) use ($query): void {
                $builder->where(function ($inner) use ($query): void {
                    $inner->where('name', 'like', "%{$query}%")
                        ->orWhere('code', 'like', "%{$query}%")
                        ->orWhere('sector', 'like', "%{$query}%")
                        ->orWhere('type', 'like', "%{$query}%");
                });
            })
            ->when($projectId, fn ($builder) => $builder->where('project_id', $projectId))
            ->when($projectCode !== '' && ! $projectId, fn ($builder) => $builder->whereRaw('0 = 1'))
            ->when($blockId, fn ($builder) => $builder->where('project_block_id', $blockId))
            ->when($status !== '', fn ($builder) => $builder->where('status', strtoupper($status)))
            ->when($type !== '', fn ($builder) => $builder->where('type', $type))
            ->latest('id')
            ->get();

        return Inertia::render('inventory/index', [
            'units' => UnitResource::collection($units)->resolve(),
            'filters' => [
                'q' => $query,
                'project' => $projectCode !== '' ? $projectCode : null,
                'block_id' => $blockId,
                'status' => $status,
                'type' => $type,
            ],
            'formOptions' => $this->formOptions(),
        ]);
    }

    /**
     * @return array{
     *     projects: list<array{id: int, title: string, code: string}>,
     *     blocks: list<array{id: int, project_id: int, title: string}>,
     *     statuses: list<string>
     * }
     */
    protected function formOptions(): array
    {
        $projects = Project::query()
            ->orderBy('title')
            ->get(['id', 'title', 'code']);

        $blocks = ProjectBlock::query()
            ->withCount('units')
            ->orderBy('title')
            ->get();

        return [
            'projects' => $projects
                ->map(fn (Project $project): array => [
                    'id' => $project->id,
                    'title' => $project->title,
                    'code' => $project->code,
                ])
                ->values()
                ->all(),
            'blocks' => ProjectBlockResource::collection($blocks)->resolve(),
            'statuses' => Unit::statuses(),
            'types' => MetaData::valuesFor(MetaData::TYPE_UNIT)->values()->all(),
        ];
    }
}

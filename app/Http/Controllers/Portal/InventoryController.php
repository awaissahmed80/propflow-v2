<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Resources\Portal\ProjectBlockResource;
use App\Http\Resources\Portal\UnitResource;
use App\Models\MetaData;
use App\Models\Project;
use App\Models\ProjectBlock;
use App\Models\Unit;
use App\Support\AssetManager;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class InventoryController extends Controller
{
    public function __construct(protected AssetManager $assets) {}

    public function index(Request $request): Response
    {
        $query = $request->string('q')->trim()->toString();
        $projectCodes = $this->listParam($request, 'project');
        $statuses = collect($this->listParam($request, 'status'))
            ->map(fn (string $status): string => strtoupper($status))
            ->values()
            ->all();
        $types = $this->listParam($request, 'type');
        $blockId = $request->integer('block_id') ?: null;
        $priceBounds = $this->priceBounds();
        $priceMin = $request->has('price_min') ? $request->integer('price_min') : null;
        $priceMax = $request->has('price_max') ? $request->integer('price_max') : null;

        if ($priceMin !== null) {
            $priceMin = max($priceBounds['min'], $priceMin);
        }

        if ($priceMax !== null) {
            $priceMax = min($priceBounds['max'], $priceMax);
        }

        $projectIds = $projectCodes === []
            ? []
            : Project::query()
                ->whereIn('code', $projectCodes)
                ->pluck('id')
                ->all();

        $paginator = Unit::query()
            ->with(['project:id,title,code', 'block:id,title,project_id'])
            ->withCount([
                'orders as booked_count' => fn ($builder) => $builder->activeOccupancy(),
            ])
            ->when($query !== '', function ($builder) use ($query): void {
                $builder->where(function ($inner) use ($query): void {
                    $inner->where('name', 'like', "%{$query}%")
                        ->orWhere('code', 'like', "%{$query}%")
                        ->orWhere('sector', 'like', "%{$query}%")
                        ->orWhere('type', 'like', "%{$query}%");
                });
            })
            ->when($projectCodes !== [], function ($builder) use ($projectIds): void {
                if ($projectIds === []) {
                    $builder->whereRaw('0 = 1');

                    return;
                }

                $builder->whereIn('project_id', $projectIds);
            })
            ->when($blockId, fn ($builder) => $builder->where('project_block_id', $blockId))
            ->when($statuses !== [], fn ($builder) => $builder->whereIn('status', $statuses))
            ->when($types !== [], fn ($builder) => $builder->whereIn('type', $types))
            ->when($priceMin !== null, fn ($builder) => $builder->where('price', '>=', $priceMin))
            ->when($priceMax !== null, fn ($builder) => $builder->where('price', '<=', $priceMax))
            ->latest('id')
            ->paginate(20)
            ->withQueryString();

        $priceFilterActive = ($priceMin !== null && $priceMin > $priceBounds['min'])
            || ($priceMax !== null && $priceMax < $priceBounds['max']);

        return Inertia::render('inventory/index', [
            'units' => UnitResource::collection($paginator->getCollection())->resolve(),
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
            'filters' => [
                'q' => $query,
                'project' => $projectCodes,
                'block_id' => $blockId,
                'status' => $statuses,
                'type' => $types,
                'price' => $priceFilterActive
                    ? [
                        $priceMin ?? $priceBounds['min'],
                        $priceMax ?? $priceBounds['max'],
                    ]
                    : null,
            ],
            'formOptions' => $this->formOptions($priceBounds),
        ]);
    }

    /**
     * @return array{min: int, max: int}
     */
    protected function priceBounds(): array
    {
        $min = (int) floor((float) (Unit::query()->min('price') ?? 0));
        $max = (int) ceil((float) (Unit::query()->max('price') ?? 0));

        if ($max <= $min) {
            $max = max($min + 1_000_000, 10_000_000);
        }

        return [
            'min' => max(0, $min),
            'max' => $max,
        ];
    }

    /**
     * @return list<string>
     */
    protected function listParam(Request $request, string $key): array
    {
        $value = $request->input($key);

        if (is_array($value)) {
            return collect($value)
                ->map(fn ($item): string => trim((string) $item))
                ->filter()
                ->values()
                ->all();
        }

        $string = trim((string) ($value ?? ''));

        if ($string === '') {
            return [];
        }

        return collect(explode(',', $string))
            ->map(fn (string $item): string => trim($item))
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @param  array{min: int, max: int}|null  $priceBounds
     * @return array{
     *     projects: list<array{id: int, title: string, code: string, thumbnail: ?string}>,
     *     blocks: list<array{id: int, project_id: int, title: string}>,
     *     statuses: list<string>,
     *     price: array{min: int, max: int, step: int}
     * }
     */
    protected function formOptions(?array $priceBounds = null): array
    {
        $projects = Project::query()
            ->with(['thumbnail.asset'])
            ->orderBy('title')
            ->get(['id', 'title', 'code']);

        $blocks = ProjectBlock::query()
            ->withCount('units')
            ->orderBy('title')
            ->get();

        $bounds = $priceBounds ?? $this->priceBounds();
        $span = max(1, $bounds['max'] - $bounds['min']);
        $step = max(1, (int) round($span / 100));

        return [
            'projects' => $projects
                ->map(fn (Project $project): array => [
                    'id' => $project->id,
                    'title' => $project->title,
                    'code' => $project->code,
                    'thumbnail' => $this->assets->url($project->thumbnail?->asset),
                ])
                ->values()
                ->all(),
            'blocks' => ProjectBlockResource::collection($blocks)->resolve(),
            'statuses' => Unit::statuses(),
            'types' => MetaData::valuesFor(MetaData::TYPE_UNIT)->values()->all(),
            'price' => [
                'min' => $bounds['min'],
                'max' => $bounds['max'],
                'step' => $step,
            ],
        ];
    }
}

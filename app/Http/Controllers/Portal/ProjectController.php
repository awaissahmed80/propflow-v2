<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\StoreProjectRequest;
use App\Http\Requests\Portal\UpdateProjectRequest;
use App\Http\Resources\Portal\ProjectResource;
use App\Http\Resources\Portal\UnitResource;
use App\Models\MetaData;
use App\Models\Project;
use App\Support\AssetManager;
use App\Support\MapEmbed;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    public function __construct(protected AssetManager $assets) {}

    public function index(Request $request): Response
    {
        $query = $request->string('q')->trim()->toString();

        return Inertia::render('projects/index', [
            'projects' => $this->projectsPayload($query)->values(),
            'filters' => [
                'q' => $query,
            ],
        ]);
    }

    public function show(string $project): Response
    {
        $projectModel = Project::query()
            ->where('code', $project)
            ->with([
                'thumbnail.asset',
                'gallery.asset',
                'documents.asset',
                'phases',
            ])
            ->withCount([
                'units',
                'blocks',
                'leads',
                'units as sold_units_count' => fn ($query) => $query->where('status', 'SOLD'),
                'units as available_units_count' => fn ($query) => $query->where('status', 'AVAILABLE'),
                'units as reserved_units_count' => fn ($query) => $query->where('status', 'RESERVED'),
            ])
            ->withSum('units', 'size')
            ->firstOrFail();

        $recentUnits = $projectModel->units()
            ->with(['block:id,title,project_id'])
            ->latest('id')
            ->limit(5)
            ->get();

        $projectModel->setAttribute(
            'thumbnail_url',
            $this->assets->url($projectModel->thumbnail?->asset),
        );

        $payload = (new ProjectResource($projectModel))->resolve();

        $payload['thumbnail_id'] = $projectModel->thumbnail?->asset_id;
        $payload['features'] = collect($projectModel->features ?? [])
            ->filter(fn ($feature) => filled($feature))
            ->values()
            ->all();

        $payload['description'] = $projectModel->description;
        $payload['gallery'] = $projectModel->gallery->map(fn ($link) => [
            'id' => $link->asset_id,
            'src' => $this->assets->url($link->asset),
            'name' => $link->asset?->name,
        ])->values()->all();

        $payload['documents'] = $projectModel->documents->map(fn ($link) => [
            'id' => $link->asset_id,
            'src' => $this->assets->url($link->asset),
            'title' => $link->asset?->name ?? 'Document',
            'type' => $link->asset?->type,
            'created_at' => $link->created_at?->toIso8601String(),
        ])->values()->all();

        $payload['phases'] = $projectModel->phases->map(fn ($phase) => [
            'id' => $phase->id,
            'title' => $phase->title,
            'description' => $phase->description,
            'status' => $phase->status,
            'progress' => (int) ($phase->progress ?? 0),
            'order' => (int) ($phase->order ?? 0),
            'start_date' => $phase->start_date?->toDateString(),
            'end_date' => $phase->end_date?->toDateString(),
        ])->values()->all();

        $payload['stats'] = [
            'total_area' => (float) (
                data_get($projectModel->details, 'total_area')
                ?? $projectModel->units_sum_size
                ?? 0
            ),
            'leads_count' => (int) ($projectModel->leads_count ?? 0),
            'units_count' => (int) ($projectModel->units_count ?? 0),
            'sold_count' => (int) ($projectModel->sold_units_count ?? 0),
            'available_count' => (int) ($projectModel->available_units_count ?? 0),
            'reserved_count' => (int) ($projectModel->reserved_units_count ?? 0),
            'blocks_count' => (int) ($projectModel->blocks_count ?? 0),
        ];

        $payload['inventory'] = [
            'units' => UnitResource::collection($recentUnits)->resolve(),
        ];

        $payload['pin_location'] = $projectModel->pin_location;
        $payload['map_embed_src'] = MapEmbed::src($projectModel->pin_location);
        $payload['area_unit'] = data_get($projectModel->details, 'area_unit');
        $payload['total_area'] = data_get($projectModel->details, 'total_area');

        return Inertia::render('projects/details', [
            'project' => $payload,
        ]);
    }

    public function store(StoreProjectRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $project = Project::query()->create([
            'title' => $validated['title'],
            'type' => $validated['type'] ?? null,
            'status' => $validated['status'] ?? 'draft',
            'progress' => 0,
        ]);

        if (filled($validated['type'] ?? null)) {
            MetaData::remember(MetaData::TYPE_PROJECT, $validated['type']);
        }

        return to_route('portal.projects.show', $project);
    }

    public function update(UpdateProjectRequest $request, string $project): RedirectResponse
    {
        $projectModel = Project::query()->where('code', $project)->firstOrFail();
        $validated = $request->validated();

        $details = is_object($projectModel->details)
            ? (array) $projectModel->details
            : (is_array($projectModel->details) ? $projectModel->details : []);

        $detailsChanged = false;

        if (array_key_exists('area_unit', $validated)) {
            $details['area_unit'] = $validated['area_unit'] ?: null;
            $detailsChanged = true;
        }

        if (array_key_exists('total_area', $validated)) {
            $details['total_area'] = $validated['total_area'] === null
                ? null
                : (float) $validated['total_area'];
            $detailsChanged = true;
        }

        $attributes = [];

        foreach ([
            'title',
            'description',
            'type',
            'purpose',
            'country',
            'city',
            'location',
            'status',
            'start_date',
            'end_date',
            'progress',
            'pin_location',
        ] as $field) {
            if (array_key_exists($field, $validated)) {
                $attributes[$field] = $validated[$field];
            }
        }

        if (array_key_exists('features', $validated)) {
            $features = collect($validated['features'] ?? [])
                ->map(fn ($feature): string => trim((string) $feature))
                ->filter(fn (string $feature): bool => $feature !== '')
                ->values()
                ->all();

            $attributes['features'] = $features === [] ? null : $features;
        }

        if ($detailsChanged) {
            $attributes['details'] = $details === [] ? null : (object) $details;
        }

        if ($attributes !== []) {
            $projectModel->forceFill($attributes)->save();
        }

        if (array_key_exists('country', $validated) && filled($validated['country'])) {
            MetaData::remember(MetaData::TYPE_COUNTRY, $validated['country']);
        }

        if (array_key_exists('city', $validated) && filled($validated['city'])) {
            MetaData::remember(MetaData::TYPE_CITY, $validated['city']);
        }

        if (array_key_exists('type', $validated) && filled($validated['type'])) {
            MetaData::remember(MetaData::TYPE_PROJECT, $validated['type']);
        }

        if (array_key_exists('area_unit', $validated) && filled($validated['area_unit'])) {
            MetaData::remember(MetaData::TYPE_AREA, $validated['area_unit']);
        }

        return to_route('portal.projects.show', $projectModel);
    }

    public function destroy(string $project): RedirectResponse
    {
        Project::query()->where('code', $project)->firstOrFail()->delete();

        return to_route('portal.projects.index');
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    protected function projectsPayload(string $query = ''): Collection
    {
        $projects = Project::query()
            ->with(['thumbnail.asset'])
            ->withCount(['units', 'blocks'])
            ->orderByDesc('id')
            ->get();

        $mapped = $projects->map(function (Project $project): array {
            $project->setAttribute(
                'thumbnail_url',
                $this->assets->url($project->thumbnail?->asset),
            );

            return (new ProjectResource($project))->resolve();
        });

        if ($query === '') {
            return $mapped->values();
        }

        $needle = mb_strtolower($query);

        return $mapped
            ->filter(function (array $project) use ($needle): bool {
                $haystack = mb_strtolower(implode(' ', array_filter([
                    $project['title'],
                    $project['code'],
                    $project['city'],
                    $project['location'],
                    $project['status'],
                    $project['type'],
                    $project['country'],
                ])));

                return str_contains($haystack, $needle);
            })
            ->values();
    }
}

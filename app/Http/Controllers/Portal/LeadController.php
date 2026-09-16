<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\StoreLeadRequest;
use App\Http\Requests\Portal\UpdateLeadRequest;
use App\Http\Resources\Portal\LeadResource;
use App\Models\Contact;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Project;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class LeadController extends Controller
{
    public function index(Request $request): Response
    {
        $query = $request->string('q')->trim()->toString();
        $projectCode = $request->string('project')->trim()->toString();
        $stageLabel = $request->string('stage')->trim()->toString();
        $tag = $request->string('tag')->trim()->toString();
        $assignedTo = $request->integer('assigned_to') ?: null;

        $projectId = $projectCode !== ''
            ? Project::query()->where('code', $projectCode)->value('id')
            : null;

        $stageId = $stageLabel !== ''
            ? LeadStage::query()->where('label', $stageLabel)->value('id')
            : null;

        $leads = Lead::query()
            ->with([
                'contact:id,first_name,last_name,email_address,phone_number',
                'project:id,title,code',
                'unit:id,code,name,project_id',
                'stage:id,label,title,color,priority',
            ])
            ->when($query !== '', function ($builder) use ($query): void {
                $builder->where(function ($inner) use ($query): void {
                    $inner->where('code', 'like', "%{$query}%")
                        ->orWhere('source', 'like', "%{$query}%")
                        ->orWhere('notes', 'like', "%{$query}%")
                        ->orWhere('next_action', 'like', "%{$query}%")
                        ->orWhereHas('contact', function ($contactQuery) use ($query): void {
                            $contactQuery->where('first_name', 'like', "%{$query}%")
                                ->orWhere('last_name', 'like', "%{$query}%")
                                ->orWhere('phone_number', 'like', "%{$query}%")
                                ->orWhere('email_address', 'like', "%{$query}%");
                        });
                });
            })
            ->when($projectId, fn ($builder) => $builder->where('project_id', $projectId))
            ->when($projectCode !== '' && ! $projectId, fn ($builder) => $builder->whereRaw('0 = 1'))
            ->when($stageId, fn ($builder) => $builder->where('lead_stage_id', $stageId))
            ->when($stageLabel !== '' && ! $stageId, fn ($builder) => $builder->whereRaw('0 = 1'))
            ->when($tag !== '', fn ($builder) => $builder->where('tag', $tag))
            ->when($assignedTo, fn ($builder) => $builder->where('assigned_to', $assignedTo))
            ->latest('id')
            ->get();

        $this->hydrateAssignees($leads);

        return Inertia::render('leads/index', [
            'leads' => LeadResource::collection($leads)->resolve(),
            'filters' => [
                'q' => $query,
                'project' => $projectCode !== '' ? $projectCode : null,
                'stage' => $stageLabel !== '' ? $stageLabel : null,
                'tag' => $tag !== '' ? $tag : null,
                'assigned_to' => $assignedTo,
            ],
            'formOptions' => $this->formOptions(),
        ]);
    }

    public function store(StoreLeadRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $contact = $this->resolveContact($validated);

        $stageId = $validated['lead_stage_id']
            ?? LeadStage::query()->where('label', 'new')->value('id')
            ?? LeadStage::query()->orderBy('priority')->value('id');

        Lead::query()->create([
            'contact_id' => $contact->id,
            'user_id' => $request->user()?->id,
            'project_id' => $validated['project_id'] ?? null,
            'unit_id' => $validated['unit_id'] ?? null,
            'assigned_to' => $validated['assigned_to'] ?? $request->user()?->id,
            'source' => $validated['source'] ?? null,
            'lead_stage_id' => $stageId,
            'tag' => $validated['tag'] ?? Lead::TAG_MODERATE,
            'budget' => $validated['budget'] ?? 0,
            'next_action' => $validated['next_action'] ?? null,
            'due_date' => $validated['due_date'] ?? null,
            'notes' => $validated['notes'] ?? null,
        ]);

        return to_route('portal.leads.index');
    }

    public function update(UpdateLeadRequest $request, Lead $lead): RedirectResponse
    {
        $validated = $request->validated();

        if (array_key_exists('contact', $validated) || array_key_exists('contact_id', $validated)) {
            $contact = $this->resolveContact($validated, $lead);
            $lead->contact_id = $contact->id;
        }

        foreach ([
            'project_id',
            'unit_id',
            'assigned_to',
            'source',
            'lead_stage_id',
            'tag',
            'budget',
            'next_action',
            'due_date',
            'notes',
        ] as $field) {
            if (array_key_exists($field, $validated)) {
                $lead->{$field} = $validated[$field];
            }
        }

        $lead->save();

        return to_route('portal.leads.index');
    }

    public function destroy(Lead $lead): RedirectResponse
    {
        $lead->delete();

        return to_route('portal.leads.index');
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    protected function resolveContact(array $validated, ?Lead $lead = null): Contact
    {
        $contactData = $validated['contact'] ?? [];

        if (! empty($validated['contact_id'])) {
            $contact = Contact::query()->findOrFail($validated['contact_id']);

            if ($contactData !== []) {
                $contact->fill([
                    'first_name' => $contactData['first_name'] ?? $contact->first_name,
                    'last_name' => $contactData['last_name'] ?? $contact->last_name,
                    'phone_number' => $contactData['phone_number'] ?? $contact->phone_number,
                    'email_address' => $contactData['email_address'] ?? $contact->email_address,
                ])->save();
            }

            return $contact;
        }

        if ($lead?->contact) {
            $lead->contact->fill([
                'first_name' => $contactData['first_name'] ?? $lead->contact->first_name,
                'last_name' => $contactData['last_name'] ?? $lead->contact->last_name,
                'phone_number' => $contactData['phone_number'] ?? $lead->contact->phone_number,
                'email_address' => $contactData['email_address'] ?? $lead->contact->email_address,
            ])->save();

            return $lead->contact;
        }

        return Contact::query()->create([
            'first_name' => $contactData['first_name'] ?? null,
            'last_name' => $contactData['last_name'] ?? null,
            'phone_number' => $contactData['phone_number'] ?? null,
            'email_address' => $contactData['email_address'] ?? null,
            'type' => 'LEAD',
            'tag' => 'GENERAL',
        ]);
    }

    /**
     * @param  Collection<int, Lead>  $leads
     */
    protected function hydrateAssignees(Collection $leads): void
    {
        $userIds = $leads->pluck('assigned_to')
            ->filter()
            ->unique()
            ->values()
            ->all();

        if ($userIds === []) {
            $leads->each(fn (Lead $lead) => $lead->setRelation('assignee', null));

            return;
        }

        $users = User::query()
            ->whereIn('id', $userIds)
            ->get(['id', 'display_name', 'first_name', 'last_name'])
            ->keyBy('id');

        $leads->each(function (Lead $lead) use ($users): void {
            $lead->setRelation('assignee', $users->get($lead->assigned_to));
        });
    }

    /**
     * @return array{
     *     projects: list<array{id: int, title: string, code: string}>,
     *     units: list<array{id: int, project_id: int, code: string, name: ?string}>,
     *     stages: list<array{id: int, label: string, title: string, color: ?string}>,
     *     tags: list<string>,
     *     assignees: list<array{id: int, display_name: string}>,
     *     sources: list<string>
     * }
     */
    protected function formOptions(): array
    {
        $projects = Project::query()
            ->orderBy('title')
            ->get(['id', 'title', 'code']);

        $units = Unit::query()
            ->orderBy('code')
            ->get(['id', 'project_id', 'code', 'name']);

        $stages = LeadStage::query()
            ->orderBy('priority')
            ->get(['id', 'label', 'title', 'color']);

        $sources = Lead::query()
            ->whereNotNull('source')
            ->where('source', '!=', '')
            ->distinct()
            ->orderBy('source')
            ->pluck('source')
            ->values()
            ->all();

        $tenant = Tenant::current();
        $assignees = [];

        if ($tenant) {
            $assignees = TenantUser::query()
                ->with(['user:id,display_name,first_name,last_name'])
                ->where('tenant_id', $tenant->id)
                ->orderBy('id')
                ->get()
                ->filter(fn (TenantUser $membership): bool => $membership->user !== null)
                ->map(fn (TenantUser $membership): array => [
                    'id' => $membership->user->id,
                    'display_name' => $membership->user->display_name
                        ?: trim($membership->user->first_name.' '.$membership->user->last_name),
                ])
                ->values()
                ->all();
        }

        return [
            'projects' => $projects
                ->map(fn (Project $project): array => [
                    'id' => $project->id,
                    'title' => $project->title,
                    'code' => $project->code,
                ])
                ->values()
                ->all(),
            'units' => $units
                ->map(fn (Unit $unit): array => [
                    'id' => $unit->id,
                    'project_id' => $unit->project_id,
                    'code' => $unit->code,
                    'name' => $unit->name,
                ])
                ->values()
                ->all(),
            'stages' => $stages
                ->map(fn (LeadStage $stage): array => [
                    'id' => $stage->id,
                    'label' => $stage->label,
                    'title' => $stage->title,
                    'color' => $stage->color,
                ])
                ->values()
                ->all(),
            'tags' => Lead::tags(),
            'assignees' => $assignees,
            'sources' => $sources,
        ];
    }
}

<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\StoreCampaignRequest;
use App\Http\Requests\Portal\UpdateCampaignRequest;
use App\Http\Resources\Portal\CampaignFormResource;
use App\Http\Resources\Portal\CampaignResource;
use App\Models\Campaign;
use App\Models\CampaignForm;
use App\Models\CampaignGoalType;
use App\Models\Integration;
use App\Models\LeadStage;
use App\Models\Project;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Support\AssetManager;
use App\Support\Integrations\Meta\MetaOAuthClient;
use App\Support\Integrations\WhatsApp\WhatsAppOAuthClient;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class CampaignController extends Controller
{
    public function __construct(protected AssetManager $assets) {}

    public function index(Request $request): Response
    {
        $query = $request->string('q')->trim()->toString();

        $campaigns = Campaign::query()
            ->with(['project:id,title,code', 'form:id,public_id,name,status'])
            ->when($query !== '', function ($builder) use ($query): void {
                $builder->where(function ($inner) use ($query): void {
                    $inner->where('title', 'like', "%{$query}%")
                        ->orWhere('slug', 'like', "%{$query}%");
                });
            })
            ->latest('id')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('campaigns/index', [
            'campaigns' => CampaignResource::collection($campaigns->getCollection())->resolve(),
            'pagination' => [
                'current_page' => $campaigns->currentPage(),
                'last_page' => $campaigns->lastPage(),
                'per_page' => $campaigns->perPage(),
                'total' => $campaigns->total(),
                'from' => $campaigns->firstItem(),
                'to' => $campaigns->lastItem(),
            ],
            'filters' => [
                'q' => $query,
            ],
            'formOptions' => $this->formOptions(),
        ]);
    }

    public function store(StoreCampaignRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $formId = $validated['campaign_form_id'] ?? null;
        $sourceType = $validated['source_type'] ?? Campaign::SOURCE_CUSTOM_FORM;
        $shouldCreateForm = $sourceType === Campaign::SOURCE_CUSTOM_FORM
            && (($validated['create_form'] ?? true) || blank($formId));

        if ($shouldCreateForm) {
            $form = CampaignForm::query()->create([
                'name' => $validated['form_name'] ?? ($validated['title'].' form'),
                'status' => CampaignForm::STATUS_ACTIVE,
                'fields' => CampaignForm::defaultFields(),
                'settings' => array_merge(CampaignForm::defaultSettings(), [
                    'project_id' => $validated['project_id'] ?? null,
                    'assigned_to' => $validated['default_assignee_id'] ?? null,
                    'lead_stage_id' => $validated['default_lead_stage_id'] ?? null,
                    'source' => $validated['lead_source_label'] ?? 'Campaign landing',
                    'landing_source' => $validated['lead_source_label'] ?? 'Campaign landing',
                    'thank_you_message' => data_get($validated, 'landing.thank_you_message')
                        ?? CampaignForm::defaultSettings()['thank_you_message'],
                    'redirect_url' => data_get($validated, 'landing.redirect_url'),
                ]),
            ]);
            $formId = $form->id;
        }

        $goals = array_replace_recursive(
            Campaign::defaultGoals(),
            collect($validated['goals'] ?? [])
                ->only(array_keys(Campaign::defaultGoals()))
                ->all(),
        );

        $utm = array_merge(
            Campaign::defaultUtm(),
            array_filter($validated['utm'] ?? [], fn ($value) => filled($value)),
        );

        $tags = collect($validated['tags'] ?? [])
            ->map(fn ($tag) => trim((string) $tag))
            ->filter()
            ->unique()
            ->values()
            ->all();

        $landing = null;

        if (! in_array($sourceType, [Campaign::SOURCE_FACEBOOK, Campaign::SOURCE_WHATSAPP], true)) {
            $landing = array_merge([
                'headline' => $validated['title'],
                'subheadline' => null,
                'body' => $validated['description'] ?? null,
                'highlights' => [],
                'cta_label' => 'Register interest',
                'thank_you_message' => 'Thanks — we will be in touch shortly.',
                'redirect_url' => null,
                'hero_image' => null,
            ], $validated['landing'] ?? []);

            if (blank($landing['headline'] ?? null)) {
                $landing['headline'] = $validated['title'];
            }
        }

        $sourceConfig = null;

        if ($sourceType === Campaign::SOURCE_FACEBOOK) {
            $sourceConfig = array_filter([
                'page_id' => data_get($validated, 'source_config.page_id'),
                'page_name' => data_get($validated, 'source_config.page_name'),
                'form_id' => data_get($validated, 'source_config.form_id'),
                'form_name' => data_get($validated, 'source_config.form_name'),
            ], fn ($value) => filled($value));
        } elseif ($sourceType === Campaign::SOURCE_WHATSAPP) {
            $sourceConfig = array_filter([
                'phone_number_id' => data_get($validated, 'source_config.phone_number_id'),
                'phone_number' => data_get($validated, 'source_config.phone_number'),
                'phone_name' => data_get($validated, 'source_config.phone_name'),
                'waba_id' => data_get($validated, 'source_config.waba_id'),
            ], fn ($value) => filled($value));
        }

        $campaign = Campaign::query()->create([
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'purpose' => $validated['purpose'] ?? Campaign::PURPOSE_LEAD_GENERATION,
            'source_type' => $sourceType,
            'source_config' => $sourceConfig,
            'channel' => $validated['channel'] ?? (in_array($sourceType, [Campaign::SOURCE_FACEBOOK, Campaign::SOURCE_WHATSAPP], true)
                ? Campaign::CHANNEL_SOCIAL
                : Campaign::CHANNEL_WEBSITE),
            'owner_id' => $validated['owner_id'] ?? $request->user()?->id,
            'budget' => $validated['budget'] ?? null,
            'target_cpl' => $validated['target_cpl'] ?? null,
            'tags' => $tags,
            'utm' => $utm,
            'default_assignee_id' => $validated['default_assignee_id'] ?? null,
            'default_lead_stage_id' => $validated['default_lead_stage_id'] ?? null,
            'status' => $validated['status'] ?? Campaign::STATUS_DRAFT,
            'project_id' => $validated['project_id'] ?? null,
            'campaign_form_id' => $formId,
            'slug' => $validated['slug'] ?? null,
            'goals' => $goals,
            'landing' => $landing,
            'starts_at' => $validated['starts_at'] ?? null,
            'ends_at' => $validated['ends_at'] ?? null,
        ]);

        return to_route('portal.campaigns.show', $campaign);
    }

    public function show(Campaign $campaign): Response
    {
        $campaign->load([
            'project:id,title,code',
            'form',
            'thumbnail.asset',
            'gallery.asset',
        ]);

        $leadsCount = $campaign->leads()->count();
        $activeLeadsCount = $campaign->leads()->whereNull('archived_at')->count();
        $submissionsCount = $campaign->submissions()->count();
        $goalDefinitions = collect(CampaignGoalType::catalog())
            ->keyBy('label');
        $storedGoals = $campaign->goals ?? Campaign::defaultGoals();

        $goalInsights = collect($storedGoals)
            ->map(function (array $goal, string $key) use ($goalDefinitions, $leadsCount): array {
                $definition = $goalDefinitions->get($key);
                $target = (int) ($goal['target'] ?? 0);
                $current = $key === 'total_leads' ? $leadsCount : 0;

                return [
                    'key' => $key,
                    'title' => $definition['title'] ?? str_replace('_', ' ', $key),
                    'color' => $definition['color'] ?? null,
                    'enabled' => (bool) ($goal['enabled'] ?? false),
                    'target' => $target,
                    'current' => $current,
                    'progress' => $target > 0
                        ? min(100, (int) round(($current / $target) * 100))
                        : 0,
                ];
            })
            ->values()
            ->all();

        $heroUrl = $this->assets->url($campaign->thumbnail?->asset)
            ?: data_get($campaign->landing, 'hero_image');

        $payload = (new CampaignResource($campaign))->resolve();
        $payload['hero_image'] = $heroUrl;
        $payload['hero_image_id'] = $campaign->thumbnail?->asset_id;
        $payload['gallery'] = $campaign->gallery
            ->map(fn ($link) => [
                'id' => $link->asset_id,
                'src' => $this->assets->url($link->asset),
                'name' => $link->asset?->name,
            ])
            ->values()
            ->all();

        return Inertia::render('campaigns/details', [
            'campaign' => $payload,
            'form' => $campaign->form
                ? (new CampaignFormResource($campaign->form))->resolve()
                : null,
            'formOptions' => $this->formOptions(),
            'defaultFields' => CampaignForm::defaultFields(),
            'insights' => [
                'leads_count' => $leadsCount,
                'active_leads_count' => $activeLeadsCount,
                'submissions_count' => $submissionsCount,
                'goals' => $goalInsights,
            ],
        ]);
    }

    public function update(UpdateCampaignRequest $request, Campaign $campaign): RedirectResponse
    {
        $validated = $request->validated();

        if (array_key_exists('slug', $validated) && filled($validated['slug'])) {
            $base = Str::slug((string) $validated['slug']) ?: 'campaign';
            $slug = $base;
            $suffix = 1;

            while (
                Campaign::query()
                    ->where('slug', $slug)
                    ->whereKeyNot($campaign->id)
                    ->exists()
            ) {
                $slug = $base.'-'.$suffix;
                $suffix++;
            }

            $validated['slug'] = $slug;
        }

        $campaign->fill($validated);
        $campaign->save();

        return back();
    }

    public function destroy(Campaign $campaign): RedirectResponse
    {
        $campaign->delete();

        return to_route('portal.campaigns.index');
    }

    /**
     * @return array{
     *     projects: list<array{id: int, title: string, code: string}>,
     *     forms: list<array{id: int, name: string, status: string}>,
     *     stages: list<array{id: int, label: string, title: string}>,
     *     assignees: list<array{id: int, display_name: string}>,
     *     statuses: list<string>,
     *     form_statuses: list<string>,
     *     tenant_identifier: ?string
     * }
     */
    protected function formOptions(): array
    {
        $tenant = Tenant::current();
        $assignees = [];

        if ($tenant) {
            $userIds = TenantUser::query()
                ->where('tenant_id', $tenant->id)
                ->pluck('user_id')
                ->all();

            $assignees = User::query()
                ->whereIn('id', $userIds)
                ->orderBy('display_name')
                ->get(['id', 'display_name'])
                ->map(fn (User $user): array => [
                    'id' => $user->id,
                    'display_name' => $user->display_name,
                ])
                ->all();
        }

        $meta = Integration::query()
            ->where('provider', Integration::PROVIDER_META)
            ->where('status', Integration::STATUS_CONNECTED)
            ->first();

        $metaPages = [];

        if ($meta) {
            /** @var list<array{id: string, name: string, access_token?: string, tasks?: list<string>, instagram?: mixed}> $storedPages */
            $storedPages = data_get($meta->settings, 'pages', []);
            $metaPages = app(MetaOAuthClient::class)->pagesForPublic($storedPages);
        }

        $whatsapp = Integration::query()
            ->where('provider', Integration::PROVIDER_WHATSAPP)
            ->where('status', Integration::STATUS_CONNECTED)
            ->first();

        $whatsappPhones = [];

        if ($whatsapp) {
            /** @var list<array{id: string, name: ?string, phone_numbers: list<array<string, mixed>>}> $storedWabas */
            $storedWabas = data_get($whatsapp->settings, 'wabas', []);
            $whatsappPhones = app(WhatsAppOAuthClient::class)->phonesForPublic(
                is_array($storedWabas) ? $storedWabas : []
            );
        }

        return [
            'projects' => Project::query()
                ->orderBy('title')
                ->get(['id', 'title', 'code'])
                ->map(fn (Project $project): array => [
                    'id' => $project->id,
                    'title' => $project->title,
                    'code' => $project->code,
                ])
                ->all(),
            'forms' => CampaignForm::query()
                ->orderBy('name')
                ->get(['id', 'name', 'status'])
                ->map(fn (CampaignForm $form): array => [
                    'id' => $form->id,
                    'name' => $form->name,
                    'status' => $form->status,
                ])
                ->all(),
            'stages' => LeadStage::query()
                ->orderBy('priority')
                ->get(['id', 'label', 'title'])
                ->map(fn (LeadStage $stage): array => [
                    'id' => $stage->id,
                    'label' => $stage->label,
                    'title' => $stage->title,
                ])
                ->all(),
            'assignees' => $assignees,
            'statuses' => Campaign::statuses(),
            'purposes' => Campaign::purposes(),
            'source_types' => Campaign::sourceTypes(),
            'channels' => Campaign::channels(),
            'goal_types' => CampaignGoalType::catalog(),
            'form_statuses' => CampaignForm::statuses(),
            'tenant_identifier' => $tenant?->identifier,
            'meta' => [
                'connected' => $meta !== null,
                'pages' => $metaPages,
                'external_name' => $meta?->external_name,
            ],
            'whatsapp' => [
                'connected' => $whatsapp !== null,
                'phones' => $whatsappPhones,
                'external_name' => $whatsapp?->external_name,
            ],
        ];
    }
}

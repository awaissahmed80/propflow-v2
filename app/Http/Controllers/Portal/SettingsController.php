<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\UpdateConfigurationSettingsRequest;
use App\Http\Requests\Portal\UpdateGeneralSettingsRequest;
use App\Http\Requests\Portal\UpdateNotificationSettingsRequest;
use App\Http\Requests\Portal\UpdatePipelineRulesRequest;
use App\Models\CampaignGoalType;
use App\Models\CustomField;
use App\Models\LeadActionType;
use App\Models\LeadStage;
use App\Models\MetaData;
use App\Models\Order;
use App\Models\OrderStage;
use App\Models\Role;
use App\Models\Setting;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use App\Support\AssetManager;
use App\Support\Integrations\IntegrationCatalog;
use App\Support\LeadWebhooks\LeadWebhookSettings;
use App\Support\Notifications\NotificationSettings;
use App\Support\TenantPermissions;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    /**
     * @var list<string>
     */
    public const SECTIONS = [
        'general',
        'meta-data',
        'pipeline',
        'bookings',
        'campaigns',
        'roles',
        'integrations',
        'notifications',
        'import-export',
        'developer',
    ];

    public function __construct(protected AssetManager $assets) {}

    public function index(Request $request, ?string $section = null): Response|RedirectResponse
    {
        $section = $section ?: 'general';

        if ($section === 'custom-fields') {
            return redirect()->route('portal.settings.index', ['section' => 'campaigns']);
        }

        if ($section === 'pipeline-rules') {
            return redirect()->route('portal.settings.index', ['section' => 'pipeline']);
        }

        if ($section === 'configuration') {
            return redirect()->route('portal.settings.index', ['section' => 'general']);
        }

        if (! in_array($section, self::SECTIONS, true)) {
            abort(404);
        }

        return Inertia::render('settings/index', [
            'section' => $section,
            'sections' => $this->sectionNav(),
            'general' => $this->generalSettings(),
            'configuration' => $this->configurationSettings(),
            'pipelineRules' => $this->pipelineRules(),
            'metaTypes' => $this->metaTypesPayload(),
            'stages' => LeadStage::query()
                ->withCount('activeLeads as leads_count')
                ->orderBy('priority')
                ->get(['id', 'label', 'title', 'priority', 'color', 'is_system', 'is_enabled'])
                ->map(fn (LeadStage $stage): array => [
                    'id' => $stage->id,
                    'label' => $stage->label,
                    'title' => $stage->title,
                    'priority' => $stage->priority,
                    'color' => $stage->color,
                    'is_system' => (bool) $stage->is_system,
                    'is_enabled' => (bool) $stage->is_enabled,
                    'leads_count' => (int) $stage->leads_count,
                ])
                ->values()
                ->all(),
            'orderStages' => $this->orderStagesPayload(),
            'activityActionTypes' => LeadActionType::catalog(LeadActionType::KIND_ACTIVITY),
            'nextActionTypes' => LeadActionType::catalog(LeadActionType::KIND_NEXT_ACTION),
            'campaignGoalTypes' => CampaignGoalType::catalog(),
            'campaignFormFields' => CustomField::campaignFormCatalog(),
            'integrations' => IntegrationCatalog::forTenant(),
            'notifications' => $this->notificationSettings(),
            'notificationCatalog' => NotificationSettings::catalog(),
            'assignees' => $this->assigneesPayload(),
            'roles' => $this->rolesPayload(),
            'permissionGroups' => TenantPermissions::groupedForForm(),
            'leadWebhook' => $section === 'developer' ? LeadWebhookSettings::forCurrent() : null,
        ]);
    }

    public function updateGeneral(UpdateGeneralSettingsRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $current = $this->generalSettings();

        if ($request->boolean('remove_logo') && filled($current['logo_path'] ?? null)) {
            $this->deleteLogoFile((string) $current['logo_path']);
            $current['logo_path'] = null;
            $current['logo_url'] = null;
        }

        if ($request->hasFile('logo')) {
            if (filled($current['logo_path'] ?? null)) {
                $this->deleteLogoFile((string) $current['logo_path']);
            }

            $asset = $this->assets->storeOnly($request->file('logo'), AssetManager::KIND_MEDIA, 'logos');
            $current['logo_path'] = $asset->path;
        }

        $data = [
            'business_name' => $validated['business_name'],
            'tagline' => $validated['tagline'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'whatsapp' => $validated['whatsapp'] ?? null,
            'email' => $validated['email'] ?? null,
            'website' => $validated['website'] ?? null,
            'address' => $validated['address'] ?? null,
            'city' => $validated['city'] ?? null,
            'state' => $validated['state'] ?? null,
            'tax_id' => $validated['tax_id'] ?? null,
            'logo_path' => $current['logo_path'] ?? null,
        ];

        Setting::putGroup(Setting::GROUP_GENERAL, 'General', $data);

        $tenant = Tenant::current();
        if ($tenant && filled($data['business_name'])) {
            $tenant->forceFill(['name' => $data['business_name']])->save();
        }

        return back();
    }

    public function updateConfiguration(UpdateConfigurationSettingsRequest $request): RedirectResponse
    {
        Setting::putGroup(Setting::GROUP_CONFIGURATION, 'Configuration', $request->validated());

        return back();
    }

    public function updatePipelineRules(UpdatePipelineRulesRequest $request): RedirectResponse
    {
        Setting::putGroup(Setting::GROUP_PIPELINE_RULES, 'Pipeline rules', $request->validated());

        return back();
    }

    public function updateNotifications(UpdateNotificationSettingsRequest $request): RedirectResponse
    {
        $data = [];

        foreach ($request->validated() as $key => $value) {
            $data[$key] = (bool) $value;
        }

        Setting::putGroup(Setting::GROUP_NOTIFICATIONS, 'Notifications', $data);

        return back();
    }

    /**
     * @return list<array{id: string, label: string, icon: string, coming_soon?: bool}>
     */
    protected function sectionNav(): array
    {
        return [
            ['id' => 'general', 'label' => 'General', 'icon' => 'building-line'],
            ['id' => 'meta-data', 'label' => 'Meta Data', 'icon' => 'database-2-line'],
            ['id' => 'pipeline', 'label' => 'Lead Pipeline', 'icon' => 'flow-chart'],
            ['id' => 'bookings', 'label' => 'Orders / Bookings', 'icon' => 'book-2-line'],
            ['id' => 'campaigns', 'label' => 'Campaigns', 'icon' => 'megaphone-line'],
            ['id' => 'roles', 'label' => 'Roles', 'icon' => 'checkbox-multiple-line'],
            ['id' => 'integrations', 'label' => 'Integrations', 'icon' => 'plug-line'],
            ['id' => 'notifications', 'label' => 'Notifications', 'icon' => 'notification-3-line'],
            ['id' => 'import-export', 'label' => 'Import / Export', 'icon' => 'swap-line', 'coming_soon' => true],
            ['id' => 'developer', 'label' => 'Developer', 'icon' => 'code-s-slash-line'],
        ];
    }

    /**
     * @return list<array{type: string, label: string, items: list<array{id: int, type: string, value: string}>}>
     */
    protected function metaTypesPayload(): array
    {
        $grouped = MetaData::query()
            ->orderBy('value')
            ->get(['id', 'type', 'value'])
            ->groupBy(fn (MetaData $meta): string => strtoupper((string) $meta->type));

        return collect(MetaData::types())
            ->map(fn (string $type): array => [
                'type' => $type,
                'label' => ucwords(strtolower(str_replace('_', ' ', $type))),
                'items' => ($grouped->get($type) ?? collect())
                    ->map(fn (MetaData $meta): array => [
                        'id' => $meta->id,
                        'type' => $meta->type,
                        'value' => $meta->value,
                    ])
                    ->values()
                    ->all(),
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    protected function generalSettings(): array
    {
        $data = Setting::group(Setting::GROUP_GENERAL, [
            'business_name' => Tenant::current()?->name,
            'tagline' => null,
            'phone' => null,
            'whatsapp' => null,
            'email' => null,
            'website' => null,
            'address' => null,
            'city' => null,
            'state' => null,
            'tax_id' => null,
            'logo_path' => null,
        ]);

        $data['logo_url'] = filled($data['logo_path'] ?? null)
            ? url('assets/'.$data['logo_path'])
            : null;

        return $data;
    }

    /**
     * @return array<string, mixed>
     */
    protected function configurationSettings(): array
    {
        return Setting::group(Setting::GROUP_CONFIGURATION, [
            'currency_code' => 'USD',
            'currency_symbol' => '$',
            'country' => null,
            'timezone' => config('app.timezone', 'UTC'),
            'date_format' => 'DD MMM YYYY',
            'time_format' => 'HH:mm',
        ]);
    }

    /**
     * @return list<array{id: int, label: string, title: string, priority: int, color: ?string, is_system: bool, is_enabled: bool, orders_count: int}>
     */
    protected function orderStagesPayload(): array
    {
        OrderStage::ensureDefaults();

        $counts = Order::query()
            ->selectRaw('stage, count(*) as aggregate')
            ->where('status', '!=', Order::STATUS_CANCELLED)
            ->groupBy('stage')
            ->pluck('aggregate', 'stage');

        return OrderStage::query()
            ->orderBy('priority')
            ->get(['id', 'label', 'title', 'priority', 'color', 'is_system', 'is_enabled'])
            ->map(fn (OrderStage $stage): array => [
                'id' => $stage->id,
                'label' => $stage->label,
                'title' => $stage->title,
                'priority' => $stage->priority,
                'color' => $stage->color,
                'is_system' => (bool) $stage->is_system,
                'is_enabled' => (bool) $stage->is_enabled,
                'orders_count' => (int) ($counts->get($stage->label) ?? 0),
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    protected function pipelineRules(): array
    {
        return Setting::group(Setting::GROUP_PIPELINE_RULES, [
            'auto_assign' => false,
            'require_notes_on_stage_change' => false,
            'flag_stale_leads' => false,
            'stale_after_days' => 14,
        ]);
    }

    /**
     * @return array<string, bool>
     */
    protected function notificationSettings(): array
    {
        $stored = Setting::group(Setting::GROUP_NOTIFICATIONS, NotificationSettings::defaults());
        $settings = [];

        foreach (NotificationSettings::defaults() as $key => $default) {
            $settings[$key] = (bool) ($stored[$key] ?? $default);
        }

        return $settings;
    }

    /**
     * @return list<array{id: int, name: string, description: ?string, is_system: bool, is_enabled: bool, permissions: list<array{id: int, name: string, label: ?string, group: ?string}>}>
     */
    protected function rolesPayload(): array
    {
        return Role::query()
            ->with(['permissions:id,name,label,group'])
            ->orderBy('name')
            ->get()
            ->map(fn (Role $role): array => [
                'id' => $role->id,
                'name' => $role->name,
                'description' => $role->description,
                'is_system' => (bool) $role->is_system,
                'is_enabled' => (bool) $role->is_enabled,
                'permissions' => $role->permissions
                    ->sortBy('name')
                    ->values()
                    ->map(fn ($permission): array => [
                        'id' => $permission->id,
                        'name' => $permission->name,
                        'label' => $permission->label,
                        'group' => $permission->group,
                    ])
                    ->all(),
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<array{id: int, display_name: string}>
     */
    protected function assigneesPayload(): array
    {
        $tenant = Tenant::current();

        if (! $tenant) {
            return [];
        }

        $userIds = TenantUser::query()
            ->where('tenant_id', $tenant->id)
            ->pluck('user_id')
            ->all();

        return User::query()
            ->whereIn('id', $userIds)
            ->orderBy('display_name')
            ->get(['id', 'display_name'])
            ->map(fn (User $user): array => [
                'id' => $user->id,
                'display_name' => $user->display_name,
            ])
            ->all();
    }

    protected function deleteLogoFile(string $path): void
    {
        $fullPath = public_path('assets/'.$path);

        if (File::exists($fullPath)) {
            File::delete($fullPath);
        }
    }
}

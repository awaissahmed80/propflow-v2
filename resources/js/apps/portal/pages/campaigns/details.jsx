import { useEffect, useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { toast } from 'sonner';
import {
    index as campaignsIndex,
    update as updateCampaign,
} from '@/routes/portal/campaigns';
import { update as updateForm } from '@/routes/portal/campaign-forms';
import PortalLayout from '../../layouts/portal.layout';
import { Layout } from '../../components/layout';
import { Accordion } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { MediaManager } from '@/components/media-manager';
import { useCurrency } from '@/hooks/use-currency';
import { cn } from '@/lib/utils';
import {
    buildGoalsState,
    InsightCard,
    mapOptions,
    statusTone,
    titleCase,
} from './campaign-details-shared';
import { CampaignEmbedPanel } from './campaign-embed-panel';
import { CampaignFormPanel } from './campaign-form-panel';
import { CampaignGalleryPanel } from './campaign-gallery-panel';
import { CampaignGoalsPanel } from './campaign-goals-panel';
import { CampaignLandingPanel } from './campaign-landing-panel';
import { CampaignMetaIntakePanel } from './campaign-meta-intake-panel';
import { CampaignSettingsPanel } from './campaign-settings-panel';
import { CampaignWhatsAppIntakePanel } from './campaign-whatsapp-intake-panel';

const PURPOSE_OPTIONS = [
    { value: 'lead_generation', label: 'Lead Generation' },
    { value: 'brand_awareness', label: 'Brand Awareness' },
    { value: 'sales', label: 'Sales' },
    { value: 'event', label: 'Event' },
];

const CHANNEL_OPTIONS = [
    { value: 'website', label: 'Website' },
    { value: 'social', label: 'Social' },
    { value: 'search', label: 'Search' },
    { value: 'email', label: 'Email' },
    { value: 'referral', label: 'Referral' },
    { value: 'offline', label: 'Offline' },
    { value: 'partner', label: 'Partner' },
    { value: 'other', label: 'Other' },
];

export default function CampaignShow({
    campaign,
    form = null,
    formOptions = {},
    defaultFields = [],
    insights = {},
}) {
    const { formatMoney: money, symbol: currencySymbol } = useCurrency();
    const [processing, setProcessing] = useState(false);
    const [openTool, setOpenTool] = useState(['settings']);
    const isMetaCampaign = campaign.source_type === 'facebook';
    const isWhatsAppCampaign = campaign.source_type === 'whatsapp';
    const isExternalIntake = isMetaCampaign || isWhatsAppCampaign;

    const [landing, setLanding] = useState({
        headline: campaign.landing?.headline || campaign.title || '',
        subheadline: campaign.landing?.subheadline || '',
        body: campaign.landing?.body || '',
        highlights: (campaign.landing?.highlights || []).join('\n'),
        cta_label: campaign.landing?.cta_label || 'Register interest',
        thank_you_message:
            campaign.landing?.thank_you_message ||
            'Thanks — we will be in touch shortly.',
        redirect_url: campaign.landing?.redirect_url || '',
    });
    const [mediaManager, setMediaManager] = useState(null);
    const [galleryPreviewIndex, setGalleryPreviewIndex] = useState(null);

    const [campaignMeta, setCampaignMeta] = useState({
        title: campaign.title || '',
        status: campaign.status || 'draft',
        project_id: campaign.project_id ? String(campaign.project_id) : '',
        purpose: campaign.purpose || 'lead_generation',
        channel: campaign.channel || 'website',
        description: campaign.description || '',
        budget: campaign.budget ?? null,
        target_cpl: campaign.target_cpl ?? null,
    });

    const [goalsState, setGoalsState] = useState(() =>
        buildGoalsState(campaign, formOptions),
    );

    const [formState, setFormState] = useState(() => ({
        name: form?.name || 'Lead form',
        status: form?.status || 'draft',
        fields: form?.fields || defaultFields,
        settings: {
            source: form?.settings?.source || 'Campaign landing',
            thank_you_message:
                form?.settings?.thank_you_message ||
                'Thanks — we will be in touch shortly.',
            lead_stage_id: form?.settings?.lead_stage_id
                ? String(form.settings.lead_stage_id)
                : '',
            assigned_to: form?.settings?.assigned_to
                ? String(form.settings.assigned_to)
                : '',
            button_label: form?.branding?.button_label || 'Submit',
        },
    }));

    useEffect(() => {
        setGoalsState(buildGoalsState(campaign, formOptions));
    }, [campaign, formOptions]);

    const snippet = form?.embed_snippet || campaign.embed_snippet || '';
    const landingUrl = campaign.landing_url || '';
    const gallery = campaign.gallery ?? [];
    const galleryIds = gallery.map((image) => image.id);
    const heroImage = campaign.hero_image || null;
    const heroImageIds = campaign.hero_image_id ? [campaign.hero_image_id] : [];
    const leadsCount = insights.leads_count ?? 0;
    const activeLeadsCount = insights.active_leads_count ?? 0;
    const submissionsCount = insights.submissions_count ?? 0;
    const goalInsights = insights.goals || [];
    const enabledGoals = useMemo(
        () => goalInsights.filter((goal) => goal.enabled),
        [goalInsights],
    );

    const statusOptions = useMemo(
        () =>
            mapOptions(formOptions.statuses, [
                { value: 'draft', label: 'Draft' },
                { value: 'active', label: 'Active' },
                { value: 'archived', label: 'Archived' },
            ]),
        [formOptions.statuses],
    );

    const purposeOptions = useMemo(
        () => mapOptions(formOptions.purposes, PURPOSE_OPTIONS),
        [formOptions.purposes],
    );

    const channelOptions = useMemo(
        () => mapOptions(formOptions.channels, CHANNEL_OPTIONS),
        [formOptions.channels],
    );

    const projectOptions = useMemo(
        () =>
            (formOptions.projects || []).map((project) => ({
                value: String(project.id),
                label: project.title,
            })),
        [formOptions.projects],
    );

    const formStatusOptions = useMemo(
        () =>
            mapOptions(formOptions.form_statuses, [
                { value: 'draft', label: 'Draft' },
                { value: 'active', label: 'Active' },
                { value: 'archived', label: 'Archived' },
            ]),
        [formOptions.form_statuses],
    );

    const stageOptions = useMemo(
        () =>
            (formOptions.stages || []).map((stage) => ({
                value: String(stage.id),
                label: stage.title || stage.label,
            })),
        [formOptions.stages],
    );

    const assigneeOptions = useMemo(
        () =>
            (formOptions.assignees || []).map((user) => ({
                value: String(user.id),
                label: user.display_name,
            })),
        [formOptions.assignees],
    );

    const goalRows = useMemo(
        () =>
            Object.entries(goalsState).map(([key, goal]) => ({
                key,
                label: goal.title || titleCase(key),
                color: goal.color || '#64748B',
                enabled: Boolean(goal.enabled),
                target: Number(goal.target) || 0,
            })),
        [goalsState],
    );

    const saveCampaign = (extra = {}) => {
        setProcessing(true);
        router.put(
            updateCampaign.url(campaign.slug),
            {
                title: campaignMeta.title,
                status: campaignMeta.status,
                purpose: campaignMeta.purpose || null,
                channel: campaignMeta.channel || null,
                description: campaignMeta.description || null,
                project_id: campaignMeta.project_id
                    ? Number(campaignMeta.project_id)
                    : null,
                budget:
                    campaignMeta.budget === '' || campaignMeta.budget == null
                        ? null
                        : Number(campaignMeta.budget),
                target_cpl:
                    campaignMeta.target_cpl === '' ||
                    campaignMeta.target_cpl == null
                        ? null
                        : Number(campaignMeta.target_cpl),
                goals: Object.fromEntries(
                    Object.entries(goalsState).map(([key, goal]) => [
                        key,
                        {
                            enabled: Boolean(goal.enabled),
                            target: Number(goal.target) || 0,
                        },
                    ]),
                ),
                landing: isExternalIntake
                    ? null
                    : {
                          headline: landing.headline,
                          subheadline: landing.subheadline || null,
                          body: landing.body || null,
                          highlights: landing.highlights
                              .split('\n')
                              .map((item) => item.trim())
                              .filter(Boolean),
                          cta_label: landing.cta_label || 'Register interest',
                          thank_you_message: landing.thank_you_message || null,
                          redirect_url: landing.redirect_url || null,
                          hero_image: campaign.landing?.hero_image || null,
                      },
                ...extra,
            },
            {
                preserveScroll: true,
                onSuccess: () => toast.success('Campaign saved'),
                onError: (errors) =>
                    toast.error(
                        errors.title ||
                            errors.message ||
                            'Could not save campaign',
                    ),
                onFinish: () => setProcessing(false),
            },
        );
    };

    const saveForm = () => {
        if (!form?.public_id) {
            toast.error('No form attached to this campaign');
            return;
        }

        setProcessing(true);
        router.put(
            updateForm.url(form.public_id),
            {
                name: formState.name,
                status: formState.status,
                fields: formState.fields,
                settings: {
                    source: formState.settings.source,
                    thank_you_message: formState.settings.thank_you_message,
                    lead_stage_id: formState.settings.lead_stage_id
                        ? Number(formState.settings.lead_stage_id)
                        : null,
                    assigned_to: formState.settings.assigned_to
                        ? Number(formState.settings.assigned_to)
                        : null,
                },
                branding: {
                    button_label: formState.settings.button_label || 'Submit',
                },
            },
            {
                preserveScroll: true,
                onSuccess: () => toast.success('Form saved'),
                onError: (errors) =>
                    toast.error(
                        errors.name || errors.message || 'Could not save form',
                    ),
                onFinish: () => setProcessing(false),
            },
        );
    };

    const toggleField = (key, enabled) => {
        setFormState((current) => ({
            ...current,
            fields: current.fields.map((field) =>
                field.key === key
                    ? { ...field, enabled: Boolean(enabled) }
                    : field,
            ),
        }));
    };

    const updateGoal = (key, patch) => {
        setGoalsState((current) => ({
            ...current,
            [key]: {
                ...current[key],
                ...patch,
            },
        }));
    };

    const handlePrimarySave = () => {
        if (openTool.includes('form')) {
            saveForm();
            return;
        }

        saveCampaign();
    };

    return (
        <Layout>
            <Layout.Header
                metaTitle={campaign.title}
                breadcrumbs={[
                    { label: 'Campaigns', href: campaignsIndex.url() },
                    { label: campaign.title },
                ]}
            />
            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar className="flex-wrap">
                    <div className="mr-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">
                                {campaign.title}
                            </h1>
                            <span
                                className={cn(
                                    'inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize',
                                    statusTone(campaign.status),
                                )}
                            >
                                {campaign.status}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Insights on the left · campaign tools on the right
                        </p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        {!isExternalIntake && landingUrl ? (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    window.open(
                                        landingUrl,
                                        '_blank',
                                        'noopener',
                                    )
                                }
                            >
                                <Icon
                                    name="external-link-line"
                                    className="text-base"
                                />
                                Open landing
                            </Button>
                        ) : null}
                        <Button
                            type="button"
                            size="sm"
                            loading={processing}
                            onClick={handlePrimarySave}
                        >
                            Save
                        </Button>
                    </div>
                </Layout.Toolbar>

                <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[minmax(0,1.35fr)_minmax(26rem,0.95fr)]">
                    <ScrollArea className="min-h-0 border-b border-border xl:border-r xl:border-b-0">
                        <div className="space-y-6 px-6 py-6">
                            <section className="space-y-3">
                                <div>
                                    <h2 className="text-base font-semibold tracking-tight text-foreground">
                                        Insights
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        Performance snapshot for this campaign
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                    <InsightCard
                                        label="Total Leads"
                                        value={leadsCount}
                                        hint={`${activeLeadsCount} active`}
                                    />
                                    <InsightCard
                                        label={
                                            isWhatsAppCampaign
                                                ? 'Synced messages'
                                                : isMetaCampaign
                                                  ? 'Synced leads'
                                                  : 'Form submissions'
                                        }
                                        value={submissionsCount}
                                    />
                                    <InsightCard
                                        label="Budget"
                                        value={money(campaign.budget)}
                                    />
                                    <InsightCard
                                        label="Target CPL"
                                        value={money(campaign.target_cpl)}
                                    />
                                </div>
                            </section>

                            <section className="space-y-3 rounded-xl border border-border/70 bg-background p-4 shadow-xs">
                                <div>
                                    <h3 className="text-base font-bold tracking-tight text-foreground">
                                        Goal Progress
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Enabled targets from campaign goals
                                    </p>
                                </div>
                                {enabledGoals.length === 0 ? (
                                    <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
                                        No goals enabled yet. Open Goals in
                                        Campaign Tools to set targets.
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {enabledGoals.map((goal) => (
                                            <div
                                                key={goal.key}
                                                className="space-y-1.5"
                                            >
                                                <div className="flex items-center justify-between gap-3 text-sm">
                                                    <span className="font-medium text-foreground">
                                                        {goal.title}
                                                    </span>
                                                    <span className="text-muted-foreground tabular-nums">
                                                        {goal.current}/
                                                        {goal.target || '—'}
                                                    </span>
                                                </div>
                                                <div className="h-2 overflow-hidden rounded-full bg-muted">
                                                    <div
                                                        className="h-full rounded-full bg-primary transition-[width]"
                                                        style={{
                                                            width: `${goal.progress || 0}%`,
                                                            backgroundColor:
                                                                goal.color ||
                                                                undefined,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            <section className="space-y-3 rounded-xl border border-border/70 bg-background p-4 shadow-xs">
                                <h3 className="text-base font-bold tracking-tight text-foreground">
                                    Overview
                                </h3>
                                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div>
                                        <dt className="text-xs text-muted-foreground">
                                            Project
                                        </dt>
                                        <dd className="text-sm font-medium text-foreground">
                                            {campaign.project?.title || '—'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-muted-foreground">
                                            Purpose
                                        </dt>
                                        <dd className="text-sm font-medium text-foreground">
                                            {titleCase(campaign.purpose) || '—'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-muted-foreground">
                                            Channel
                                        </dt>
                                        <dd className="text-sm font-medium text-foreground capitalize">
                                            {campaign.channel || '—'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-muted-foreground">
                                            Intake
                                        </dt>
                                        <dd className="text-sm font-medium text-foreground">
                                            {campaign.source_type === 'facebook'
                                                ? [
                                                      'Meta',
                                                      campaign.source_config
                                                          ?.page_name ||
                                                          campaign.source_config
                                                              ?.page_id,
                                                      campaign.source_config
                                                          ?.form_name ||
                                                          campaign.source_config
                                                              ?.form_id,
                                                  ]
                                                      .filter(Boolean)
                                                      .join(' · ') ||
                                                  'Meta Lead Ads'
                                                : campaign.source_type ===
                                                    'whatsapp'
                                                  ? [
                                                        'WhatsApp',
                                                        campaign.source_config
                                                            ?.phone_name ||
                                                            campaign
                                                                .source_config
                                                                ?.phone_number ||
                                                            campaign
                                                                .source_config
                                                                ?.phone_number_id,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' · ') ||
                                                    'WhatsApp Business'
                                                  : campaign.form?.name ||
                                                    form?.name ||
                                                    'Custom form'}
                                        </dd>
                                    </div>
                                </dl>
                                {campaign.description ? (
                                    <p className="border-t border-border/60 pt-3 text-sm text-muted-foreground">
                                        {campaign.description}
                                    </p>
                                ) : null}
                            </section>

                            <section className="rounded-xl border border-dashed border-border/80 bg-muted/15 px-4 py-8 text-center">
                                <Icon
                                    name="bar-chart-2-line"
                                    className="mx-auto text-2xl text-muted-foreground"
                                />
                                <h3 className="mt-3 text-base font-bold tracking-tight text-foreground">
                                    Analytics Coming Soon
                                </h3>
                                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                                    Charts for conversion, channel mix, and
                                    daily lead volume will appear here.
                                </p>
                            </section>
                        </div>
                    </ScrollArea>

                    <aside className="flex min-h-0 flex-col border-t border-border bg-background xl:border-t-0">
                        <div className="shrink-0 border-b border-border px-4 py-3.5">
                            <h2 className="text-base font-bold tracking-tight text-foreground">
                                Campaign Tools
                            </h2>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                {isMetaCampaign
                                    ? 'Configure Meta intake, goals, and assets'
                                    : isWhatsAppCampaign
                                      ? 'Configure WhatsApp intake, goals, and assets'
                                      : 'Configure capture, landing, and targets'}
                            </p>
                        </div>
                        <ScrollArea className="min-h-0 flex-1">
                            <Accordion
                                value={openTool}
                                onValueChange={(value) => setOpenTool(value)}
                                className="px-2 py-1"
                            >
                                <CampaignSettingsPanel
                                    campaignMeta={campaignMeta}
                                    setCampaignMeta={setCampaignMeta}
                                    statusOptions={statusOptions}
                                    projectOptions={projectOptions}
                                    purposeOptions={purposeOptions}
                                    channelOptions={channelOptions}
                                    currencySymbol={currencySymbol}
                                    processing={processing}
                                    onSave={() => saveCampaign()}
                                />

                                <CampaignGoalsPanel
                                    goalRows={goalRows}
                                    updateGoal={updateGoal}
                                    processing={processing}
                                    onSave={() => saveCampaign()}
                                />

                                {isMetaCampaign ? (
                                    <CampaignMetaIntakePanel
                                        campaign={campaign}
                                    />
                                ) : isWhatsAppCampaign ? (
                                    <CampaignWhatsAppIntakePanel
                                        campaign={campaign}
                                    />
                                ) : (
                                    <>
                                        <CampaignFormPanel
                                            form={form}
                                            formState={formState}
                                            setFormState={setFormState}
                                            formStatusOptions={
                                                formStatusOptions
                                            }
                                            stageOptions={stageOptions}
                                            assigneeOptions={assigneeOptions}
                                            toggleField={toggleField}
                                            processing={processing}
                                            onSave={saveForm}
                                        />
                                        <CampaignEmbedPanel snippet={snippet} />
                                        <CampaignLandingPanel
                                            landing={landing}
                                            setLanding={setLanding}
                                            landingUrl={landingUrl}
                                            processing={processing}
                                            onSave={() => saveCampaign()}
                                        />
                                    </>
                                )}

                                <CampaignGalleryPanel
                                    heroImage={heroImage}
                                    heroImageIds={heroImageIds}
                                    gallery={gallery}
                                    galleryIds={galleryIds}
                                    setMediaManager={setMediaManager}
                                    setGalleryPreviewIndex={
                                        setGalleryPreviewIndex
                                    }
                                />
                            </Accordion>
                        </ScrollArea>
                    </aside>
                </div>
            </Layout.Content>

            <MediaManager
                open={Boolean(mediaManager)}
                onOpenChange={(open) => {
                    if (!open) {
                        setMediaManager(null);
                    }
                }}
                multiple={mediaManager?.multiple ?? true}
                assetableType="campaign"
                assetableId={campaign.id}
                linkage={mediaManager?.linkage || 'GALLERY'}
                selectedIds={mediaManager?.selectedIds || []}
                title={mediaManager?.title}
                description={mediaManager?.description}
                onApplied={() =>
                    router.reload({ only: ['campaign'], preserveScroll: true })
                }
            />

            <ImageLightbox
                open={galleryPreviewIndex !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setGalleryPreviewIndex(null);
                    }
                }}
                images={gallery}
                index={galleryPreviewIndex ?? 0}
                onIndexChange={setGalleryPreviewIndex}
            />
        </Layout>
    );
}

CampaignShow.layout = (page) => <PortalLayout children={page} />;

import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { forms as metaForms } from '@/actions/App/Http/Controllers/Portal/MetaIntegrationController';
import { store } from '@/routes/portal/campaigns';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useCurrency } from '@/hooks/use-currency';
import {
    CHANNEL_OPTIONS,
    csrfHeaders,
    emptyValuesForGoals,
    EXTERNAL_STEPS,
    FALLBACK_GOAL_FIELDS,
    mapSelectOptions,
    PURPOSE_OPTIONS,
    STATUS_OPTIONS,
    STEPS,
    WizardSteps,
} from './campaign-form-shared';
import { DetailsStep, EssentialsStep, GoalsStep } from './campaign-form-steps';

export default function CampaignForm({ isOpen, onClose, formOptions = {} }) {
    const { symbol: currencySymbol } = useCurrency();
    const [processing, setProcessing] = useState(false);
    const [serverErrors, setServerErrors] = useState({});
    const [stepIndex, setStepIndex] = useState(0);
    const stepIndexRef = useRef(0);
    const ignoreSubmitUntilRef = useRef(0);
    const [metaLeadForms, setMetaLeadForms] = useState([]);
    const [loadingMetaForms, setLoadingMetaForms] = useState(false);

    const goalFields = useMemo(() => {
        const types = formOptions.goal_types || [];

        if (types.length === 0) {
            return FALLBACK_GOAL_FIELDS;
        }

        return types.map((type) => ({
            key: type.label,
            label: type.title || type.label,
            color: type.color,
        }));
    }, [formOptions.goal_types]);

    const emptyValues = useMemo(
        () => emptyValuesForGoals(goalFields),
        [goalFields],
    );

    const projectOptions = useMemo(
        () =>
            (formOptions.projects || []).map((project) => ({
                value: String(project.id),
                label: project.title,
            })),
        [formOptions.projects],
    );

    const assigneeOptions = useMemo(
        () =>
            (formOptions.assignees || []).map((user) => ({
                value: String(user.id),
                label: user.display_name,
            })),
        [formOptions.assignees],
    );

    const stageOptions = useMemo(
        () =>
            (formOptions.stages || []).map((stage) => ({
                value: String(stage.id),
                label: stage.title || stage.label,
            })),
        [formOptions.stages],
    );

    const purposeOptions = useMemo(
        () => mapSelectOptions(formOptions.purposes, PURPOSE_OPTIONS),
        [formOptions.purposes],
    );

    const statusOptions = useMemo(
        () => mapSelectOptions(formOptions.statuses, STATUS_OPTIONS),
        [formOptions.statuses],
    );

    const channelOptions = useMemo(
        () => mapSelectOptions(formOptions.channels, CHANNEL_OPTIONS),
        [formOptions.channels],
    );

    const {
        handleSubmit,
        register,
        reset,
        control,
        trigger,
        getValues,
        setValue,
        formState: { errors },
    } = useForm({
        defaultValues: emptyValuesForGoals(FALLBACK_GOAL_FIELDS),
        mode: 'onSubmit',
        reValidateMode: 'onChange',
    });

    const sourceType = useWatch({ control, name: 'source_type' });
    const metaConnected = Boolean(formOptions.meta?.connected);
    const whatsappConnected = Boolean(formOptions.whatsapp?.connected);
    const metaPages = formOptions.meta?.pages || [];
    const whatsappPhones = formOptions.whatsapp?.phones || [];
    const facebookSelected = sourceType === 'facebook';
    const whatsappSelected = sourceType === 'whatsapp';
    const externalIntake = facebookSelected || whatsappSelected;
    const wizardSteps = externalIntake ? EXTERNAL_STEPS : STEPS;
    const wizardLengthRef = useRef(wizardSteps.length);
    stepIndexRef.current = stepIndex;
    wizardLengthRef.current = wizardSteps.length;
    const metaPageOptions = useMemo(
        () =>
            metaPages.map((page) => ({
                value: String(page.id),
                label: page.instagram?.username
                    ? `${page.name} · @${page.instagram.username}`
                    : page.name,
            })),
        [metaPages],
    );
    const whatsappPhoneOptions = useMemo(
        () =>
            whatsappPhones.map((phone) => ({
                value: String(phone.id),
                label: phone.verified_name
                    ? `${phone.display_phone_number} · ${phone.verified_name}`
                    : phone.display_phone_number,
            })),
        [whatsappPhones],
    );
    const currentStep = wizardSteps[stepIndex] || wizardSteps[0];
    const isLastStep = stepIndex === wizardSteps.length - 1;

    const fieldError = (name) => {
        if (serverErrors[name]) {
            return Array.isArray(serverErrors[name])
                ? serverErrors[name][0]
                : serverErrors[name];
        }

        const parts = name.split('.');
        let current = errors;

        for (const part of parts) {
            current = current?.[part];
        }

        return current?.message;
    };

    const handleClose = () => {
        if (processing) {
            return;
        }

        reset(emptyValues);
        setServerErrors({});
        setStepIndex(0);
        setMetaLeadForms([]);
        setLoadingMetaForms(false);
        onClose(false);
    };

    const selectedMetaPageId = useWatch({
        control,
        name: 'source_config.page_id',
    });

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setServerErrors({});
        setStepIndex(0);
        setMetaLeadForms([]);
        setLoadingMetaForms(false);
        reset(emptyValues);
    }, [isOpen, reset, emptyValues]);

    useEffect(() => {
        if (!isOpen || !facebookSelected || !selectedMetaPageId) {
            setMetaLeadForms([]);
            setLoadingMetaForms(false);
            return;
        }

        const controller = new AbortController();
        let cancelled = false;

        const loadForms = async () => {
            setLoadingMetaForms(true);

            try {
                const response = await fetch(
                    metaForms.url({ query: { page_id: selectedMetaPageId } }),
                    {
                        method: 'GET',
                        headers: csrfHeaders(),
                        credentials: 'same-origin',
                        signal: controller.signal,
                    },
                );
                const body = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(
                        body?.message || 'Unable to load Meta lead forms.',
                    );
                }

                if (cancelled) {
                    return;
                }

                setMetaLeadForms(Array.isArray(body.forms) ? body.forms : []);
            } catch (error) {
                if (cancelled || error?.name === 'AbortError') {
                    return;
                }

                setMetaLeadForms([]);
                toast.error(
                    error instanceof Error
                        ? error.message
                        : 'Unable to load Meta lead forms.',
                );
            } finally {
                if (!cancelled) {
                    setLoadingMetaForms(false);
                }
            }
        };

        loadForms();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [isOpen, facebookSelected, selectedMetaPageId]);

    const metaFormOptions = useMemo(
        () =>
            metaLeadForms.map((form) => ({
                value: String(form.id),
                label:
                    form.status && form.status !== 'ACTIVE'
                        ? `${form.name} (${form.status})`
                        : form.name,
            })),
        [metaLeadForms],
    );

    const submitCampaign = (formData) => {
        if (formData.source_type === 'facebook' && !metaConnected) {
            toast.error('Connect Meta in Settings → Integrations first.');
            return;
        }

        if (
            formData.source_type === 'facebook' &&
            !formData.source_config?.page_id
        ) {
            toast.error('Select a Meta Page for this campaign.');
            return;
        }

        if (formData.source_type === 'whatsapp' && !whatsappConnected) {
            toast.error('Connect WhatsApp in Settings → Integrations first.');
            return;
        }

        if (
            formData.source_type === 'whatsapp' &&
            !formData.source_config?.phone_number_id
        ) {
            toast.error('Select a WhatsApp number for this campaign.');
            return;
        }

        setProcessing(true);
        setServerErrors({});

        const campaignTitle = formData.title.trim();
        const tags = String(formData.tags || '')
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean);

        const selectedPage = metaPages.find(
            (page) =>
                String(page.id) ===
                String(formData.source_config?.page_id || ''),
        );
        const selectedPhone = whatsappPhones.find(
            (phone) =>
                String(phone.id) ===
                String(formData.source_config?.phone_number_id || ''),
        );

        let sourceConfig = null;

        if (formData.source_type === 'facebook') {
            sourceConfig = {
                page_id: formData.source_config?.page_id || null,
                page_name:
                    formData.source_config?.page_name ||
                    selectedPage?.name ||
                    null,
                form_id: formData.source_config?.form_id || null,
                form_name: formData.source_config?.form_name || null,
            };
        } else if (formData.source_type === 'whatsapp') {
            sourceConfig = {
                phone_number_id:
                    formData.source_config?.phone_number_id || null,
                phone_number:
                    formData.source_config?.phone_number ||
                    selectedPhone?.display_phone_number ||
                    null,
                phone_name:
                    formData.source_config?.phone_name ||
                    selectedPhone?.verified_name ||
                    null,
                waba_id:
                    formData.source_config?.waba_id ||
                    selectedPhone?.waba_id ||
                    null,
            };
        }

        const payload = {
            title: campaignTitle,
            description: formData.description?.trim() || null,
            purpose: formData.purpose || 'lead_generation',
            source_type: formData.source_type || 'custom_form',
            source_config: sourceConfig,
            channel:
                formData.channel ||
                (formData.source_type === 'facebook' ||
                formData.source_type === 'whatsapp'
                    ? 'social'
                    : null),
            status: formData.status || 'draft',
            project_id: formData.project_id
                ? Number(formData.project_id)
                : null,
            owner_id: formData.owner_id ? Number(formData.owner_id) : null,
            default_assignee_id: formData.default_assignee_id
                ? Number(formData.default_assignee_id)
                : null,
            default_lead_stage_id: formData.default_lead_stage_id
                ? Number(formData.default_lead_stage_id)
                : null,
            lead_source_label:
                formData.lead_source_label?.trim() ||
                (formData.source_type === 'facebook'
                    ? 'Meta Lead Ads'
                    : formData.source_type === 'whatsapp'
                      ? 'WhatsApp'
                      : 'Campaign landing'),
            starts_at: formData.starts_at || null,
            ends_at: formData.ends_at || null,
            budget:
                formData.budget === '' || formData.budget == null
                    ? null
                    : Number(formData.budget),
            target_cpl:
                formData.target_cpl === '' || formData.target_cpl == null
                    ? null
                    : Number(formData.target_cpl),
            tags,
            create_form:
                (formData.source_type || 'custom_form') === 'custom_form',
            utm: {
                source:
                    formData.utm?.source?.trim() ||
                    (formData.source_type === 'facebook'
                        ? 'facebook'
                        : formData.source_type === 'whatsapp'
                          ? 'whatsapp'
                          : null),
                medium:
                    formData.utm?.medium?.trim() ||
                    (formData.source_type === 'facebook' ||
                    formData.source_type === 'whatsapp'
                        ? 'paid'
                        : null),
                campaign: formData.utm?.campaign?.trim() || null,
                content: formData.utm?.content?.trim() || null,
                term: formData.utm?.term?.trim() || null,
            },
            goals: Object.fromEntries(
                goalFields.map(({ key }) => {
                    const goal = formData.goals?.[key] || {
                        enabled: false,
                        target: 0,
                    };

                    return [
                        key,
                        {
                            enabled: Boolean(goal.enabled),
                            target: Number(goal.target) || 0,
                        },
                    ];
                }),
            ),
            landing:
                formData.source_type === 'facebook' ||
                formData.source_type === 'whatsapp'
                    ? null
                    : {
                          headline:
                              formData.landing?.headline?.trim() ||
                              campaignTitle,
                          subheadline:
                              formData.landing?.subheadline?.trim() || null,
                          body: formData.description?.trim() || null,
                          cta_label:
                              formData.landing?.cta_label?.trim() ||
                              'Register interest',
                          thank_you_message:
                              formData.landing?.thank_you_message?.trim() ||
                              'Thanks — we will be in touch shortly.',
                          redirect_url:
                              formData.landing?.redirect_url?.trim() || null,
                          highlights: [],
                      },
        };

        router.post(store.url(), payload, {
            onSuccess: () => {
                toast.success(
                    formData.source_type === 'facebook'
                        ? 'Meta campaign created — lead ads will route here'
                        : formData.source_type === 'whatsapp'
                          ? 'WhatsApp campaign created — messages will route here'
                          : 'Campaign created — customize the form anytime',
                );
                handleClose();
            },
            onError: (submitErrors) => {
                setServerErrors(submitErrors);
                toast.error(
                    submitErrors.title ||
                        submitErrors['source_config.page_id'] ||
                        submitErrors.source_type ||
                        submitErrors.project_id ||
                        submitErrors.message ||
                        'Could not create campaign',
                );
            },
            onFinish: () => setProcessing(false),
        });
    };

    const validateEssentials = async () => {
        const valid = await trigger(['title']);

        if (!valid) {
            toast.error('Campaign title is required.');
            return false;
        }

        if (getValues('source_type') === 'facebook') {
            if (!metaConnected) {
                toast.error('Connect Meta in Settings → Integrations first.');
                return false;
            }

            if (!getValues('source_config.page_id')) {
                toast.error('Select a Meta Page for this campaign.');
                return false;
            }
        }

        if (getValues('source_type') === 'whatsapp') {
            if (!whatsappConnected) {
                toast.error(
                    'Connect WhatsApp in Settings → Integrations first.',
                );
                return false;
            }

            if (!getValues('source_config.phone_number_id')) {
                toast.error('Select a WhatsApp number for this campaign.');
                return false;
            }
        }

        return true;
    };

    const goNext = async (event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();

        if (stepIndexRef.current === 0) {
            const ok = await validateEssentials();
            if (!ok) {
                return;
            }
        }

        if (stepIndexRef.current >= wizardLengthRef.current - 1) {
            return;
        }

        // A double-click would land on the create button that replaces Continue.
        ignoreSubmitUntilRef.current = Date.now() + 600;
        setStepIndex((current) =>
            Math.min(current + 1, wizardLengthRef.current - 1),
        );
    };

    const submitFromLastStep = (event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();

        if (Date.now() < ignoreSubmitUntilRef.current) {
            return;
        }

        if (stepIndexRef.current < wizardLengthRef.current - 1) {
            return;
        }

        handleSubmit(submitCampaign)();
    };

    const goBack = () => {
        setStepIndex((current) => Math.max(current - 1, 0));
    };

    const createNow = async () => {
        const ok = await validateEssentials();
        if (!ok) {
            return;
        }

        submitCampaign(getValues());
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) {
                    handleClose();
                }
            }}
        >
            <DialogContent className="grid max-h-[min(92vh,40rem)] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl">
                <DialogHeader className="border-b border-border px-6 py-4">
                    <DialogTitle>Add Campaign</DialogTitle>
                    <DialogDescription>
                        {currentStep.description}
                    </DialogDescription>
                </DialogHeader>

                <div className="border-b border-border px-6 py-3">
                    <WizardSteps steps={wizardSteps} current={stepIndex} />
                </div>

                <form
                    id="campaign-create-form"
                    className="min-h-0 overflow-y-auto px-6 py-5"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const intent =
                            event.nativeEvent?.submitter?.getAttribute(
                                'data-intent',
                            );

                        if (intent === 'create') {
                            submitFromLastStep(event);
                            return;
                        }

                        if (
                            stepIndexRef.current <
                            wizardLengthRef.current - 1
                        ) {
                            goNext(event);
                        }
                    }}
                >
                    {stepIndex === 0 ? (
                        <EssentialsStep
                            control={control}
                            register={register}
                            setValue={setValue}
                            setStepIndex={setStepIndex}
                            fieldError={fieldError}
                            facebookSelected={facebookSelected}
                            whatsappSelected={whatsappSelected}
                            externalIntake={externalIntake}
                            metaConnected={metaConnected}
                            whatsappConnected={whatsappConnected}
                            metaPages={metaPages}
                            metaPageOptions={metaPageOptions}
                            metaLeadForms={metaLeadForms}
                            metaFormOptions={metaFormOptions}
                            loadingMetaForms={loadingMetaForms}
                            selectedMetaPageId={selectedMetaPageId}
                            setMetaLeadForms={setMetaLeadForms}
                            whatsappPhones={whatsappPhones}
                            whatsappPhoneOptions={whatsappPhoneOptions}
                            projectOptions={projectOptions}
                            statusOptions={statusOptions}
                            purposeOptions={purposeOptions}
                            externalStepsLength={EXTERNAL_STEPS.length}
                        />
                    ) : null}

                    {stepIndex === 1 ? (
                        <DetailsStep
                            control={control}
                            register={register}
                            fieldError={fieldError}
                            externalIntake={externalIntake}
                            facebookSelected={facebookSelected}
                            whatsappSelected={whatsappSelected}
                            channelOptions={channelOptions}
                            assigneeOptions={assigneeOptions}
                            stageOptions={stageOptions}
                            currencySymbol={currencySymbol}
                        />
                    ) : null}

                    {stepIndex === 2 ? (
                        <GoalsStep
                            control={control}
                            register={register}
                            fieldError={fieldError}
                            goalFields={goalFields}
                            externalIntake={externalIntake}
                            whatsappSelected={whatsappSelected}
                        />
                    ) : null}
                </form>

                <DialogFooter className="border-t border-border bg-popover px-6 py-4 sm:justify-between">
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={stepIndex === 0 ? handleClose : goBack}
                            disabled={processing}
                        >
                            {stepIndex === 0 ? 'Cancel' : 'Back'}
                        </Button>

                        <div className="flex flex-wrap items-center gap-2">
                            {!isLastStep ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    loading={processing}
                                    onClick={createNow}
                                >
                                    Create campaign
                                </Button>
                            ) : null}
                            {isLastStep ? (
                                <Button
                                    key="create-campaign"
                                    type="button"
                                    data-intent="create"
                                    loading={processing}
                                    onClick={submitFromLastStep}
                                >
                                    Create campaign
                                </Button>
                            ) : (
                                <Button
                                    key="continue-step"
                                    type="button"
                                    onClick={goNext}
                                    disabled={processing}
                                >
                                    Continue
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

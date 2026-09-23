import { Controller } from 'react-hook-form';
import { DatePicker } from '@/components/ui/date-picker';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SelectBox } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { GoalRow, MoneyField } from './campaign-form-shared';

export function EssentialsStep({
    control,
    register,
    setValue,
    setStepIndex,
    fieldError,
    facebookSelected,
    whatsappSelected,
    externalIntake,
    metaConnected,
    whatsappConnected,
    metaPages,
    metaPageOptions,
    metaLeadForms,
    metaFormOptions,
    loadingMetaForms,
    selectedMetaPageId,
    setMetaLeadForms,
    whatsappPhones,
    whatsappPhoneOptions,
    projectOptions,
    statusOptions,
    purposeOptions,
    externalStepsLength,
}) {
    return (
        <div className="space-y-4">
            <Controller
                name="source_type"
                control={control}
                render={({ field }) => (
                    <div className="space-y-2">
                        <Label className="text-label font-medium text-muted-foreground">
                            Intake type
                        </Label>
                        <RadioGroup
                            value={field.value}
                            onValueChange={(value) => {
                                field.onChange(value);
                                if (value === 'facebook') {
                                    setValue('channel', 'social');
                                    setValue('utm.source', 'facebook');
                                    setValue('utm.medium', 'paid');
                                    setValue(
                                        'lead_source_label',
                                        'Meta Lead Ads',
                                    );
                                } else if (value === 'whatsapp') {
                                    setValue('channel', 'social');
                                    setValue('utm.source', 'whatsapp');
                                    setValue('utm.medium', 'paid');
                                    setValue('lead_source_label', 'WhatsApp');
                                } else {
                                    setValue('channel', 'website');
                                    setValue(
                                        'lead_source_label',
                                        'Campaign landing',
                                    );
                                }
                                setStepIndex((current) =>
                                    Math.min(current, externalStepsLength - 1),
                                );
                            }}
                            className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
                        >
                            <label
                                className={cn(
                                    'relative flex h-full cursor-pointer flex-col gap-3 rounded-xl border p-3.5 transition-all',
                                    field.value === 'custom_form'
                                        ? 'border-teal-500/50 bg-teal-500/8 ring-1 ring-teal-500/25'
                                        : 'border-border/80 bg-background hover:border-teal-500/35 hover:bg-teal-500/[0.04]',
                                )}
                            >
                                <RadioGroupItem
                                    value="custom_form"
                                    className="sr-only"
                                />
                                <span
                                    className={cn(
                                        'flex size-9 shrink-0 items-center justify-center rounded-lg',
                                        field.value === 'custom_form'
                                            ? 'bg-teal-500 text-white'
                                            : 'bg-teal-500/12 text-teal-700 dark:text-teal-300',
                                    )}
                                >
                                    <Icon
                                        name="file-list-3-line"
                                        className="text-lg"
                                    />
                                </span>
                                <span className="min-w-0 space-y-1">
                                    <span className="block text-sm leading-snug font-semibold text-foreground">
                                        Custom form
                                    </span>
                                    <span className="block text-xs leading-relaxed text-muted-foreground">
                                        Landing page, embed snippet, and form
                                        fields
                                    </span>
                                </span>
                            </label>
                            <label
                                className={cn(
                                    'relative flex h-full flex-col gap-3 rounded-xl border p-3.5 transition-all',
                                    !metaConnected
                                        ? 'cursor-not-allowed opacity-55'
                                        : 'cursor-pointer',
                                    field.value === 'facebook'
                                        ? 'border-[#1877F2]/55 bg-[#1877F2]/8 ring-1 ring-[#1877F2]/25'
                                        : metaConnected
                                          ? 'border-border/80 bg-background hover:border-[#1877F2]/40 hover:bg-[#1877F2]/[0.04]'
                                          : 'border-border/60 bg-muted/20',
                                )}
                                title={
                                    metaConnected
                                        ? 'Route Meta Lead Ads into this campaign'
                                        : 'Connect Meta in Settings → Integrations'
                                }
                            >
                                <RadioGroupItem
                                    value="facebook"
                                    disabled={!metaConnected}
                                    className="sr-only"
                                />
                                <span
                                    className={cn(
                                        'flex size-9 shrink-0 items-center justify-center rounded-lg',
                                        field.value === 'facebook'
                                            ? 'bg-[#1877F2] text-white'
                                            : 'bg-[#1877F2]/12 text-[#1877F2]',
                                    )}
                                >
                                    <Icon
                                        name="meta-fill"
                                        className="text-lg"
                                    />
                                </span>
                                <span className="min-w-0 space-y-1">
                                    <span className="block text-sm leading-snug font-semibold text-foreground">
                                        Meta Lead Ads
                                    </span>
                                    <span className="block text-xs leading-relaxed text-muted-foreground">
                                        {metaConnected
                                            ? 'Facebook & Instagram lead forms'
                                            : 'Connect Meta in Settings to enable'}
                                    </span>
                                </span>
                            </label>
                            <label
                                className={cn(
                                    'relative flex h-full flex-col gap-3 rounded-xl border p-3.5 transition-all',
                                    !whatsappConnected
                                        ? 'cursor-not-allowed opacity-55'
                                        : 'cursor-pointer',
                                    field.value === 'whatsapp'
                                        ? 'border-[#25D366]/55 bg-[#25D366]/8 ring-1 ring-[#25D366]/25'
                                        : whatsappConnected
                                          ? 'border-border/80 bg-background hover:border-[#25D366]/40 hover:bg-[#25D366]/[0.04]'
                                          : 'border-border/60 bg-muted/20',
                                )}
                                title={
                                    whatsappConnected
                                        ? 'Route WhatsApp messages into this campaign'
                                        : 'Connect WhatsApp in Settings → Integrations'
                                }
                            >
                                <RadioGroupItem
                                    value="whatsapp"
                                    disabled={!whatsappConnected}
                                    className="sr-only"
                                />
                                <span
                                    className={cn(
                                        'flex size-9 shrink-0 items-center justify-center rounded-lg',
                                        field.value === 'whatsapp'
                                            ? 'bg-[#25D366] text-white'
                                            : 'bg-[#25D366]/12 text-[#25D366]',
                                    )}
                                >
                                    <Icon
                                        name="whatsapp-fill"
                                        className="text-lg"
                                    />
                                </span>
                                <span className="min-w-0 space-y-1">
                                    <span className="block text-sm leading-snug font-semibold text-foreground">
                                        WhatsApp
                                    </span>
                                    <span className="block text-xs leading-relaxed text-muted-foreground">
                                        {whatsappConnected
                                            ? 'Inbound messages as campaign leads'
                                            : 'Connect WhatsApp in Settings to enable'}
                                    </span>
                                </span>
                            </label>
                        </RadioGroup>
                    </div>
                )}
            />

            {facebookSelected ? (
                <div className="space-y-4">
                    <Controller
                        name="source_config.page_id"
                        control={control}
                        rules={{
                            required: facebookSelected
                                ? 'Select a Meta Page.'
                                : false,
                        }}
                        render={({ field }) => (
                            <SelectBox
                                label="Meta Page"
                                required
                                value={field.value}
                                onValueChange={(value) => {
                                    field.onChange(value);
                                    const page = metaPages.find(
                                        (item) =>
                                            String(item.id) === String(value),
                                    );
                                    setValue(
                                        'source_config.page_name',
                                        page?.name || '',
                                    );
                                    setValue('source_config.form_id', '');
                                    setValue('source_config.form_name', '');
                                    setMetaLeadForms([]);
                                }}
                                options={metaPageOptions}
                                placeholder="Select page"
                                error={fieldError('source_config.page_id')}
                            />
                        )}
                    />
                    <Controller
                        name="source_config.form_id"
                        control={control}
                        render={({ field }) => (
                            <SelectBox
                                label="Lead form"
                                value={field.value}
                                onValueChange={(value) => {
                                    field.onChange(value);
                                    const form = metaLeadForms.find(
                                        (item) =>
                                            String(item.id) === String(value),
                                    );
                                    setValue(
                                        'source_config.form_name',
                                        form?.name || '',
                                    );
                                }}
                                options={metaFormOptions}
                                placeholder={
                                    loadingMetaForms
                                        ? 'Loading forms…'
                                        : selectedMetaPageId
                                          ? 'All forms on this Page'
                                          : 'Select a Page first'
                                }
                                clearable
                                disabled={
                                    !selectedMetaPageId || loadingMetaForms
                                }
                                error={fieldError('source_config.form_id')}
                            />
                        )}
                    />
                    <p className="text-xs text-muted-foreground">
                        {loadingMetaForms
                            ? 'Fetching lead forms from Facebook…'
                            : metaLeadForms.length === 0 && selectedMetaPageId
                              ? 'No lead forms found on this Page. Leave blank to accept all forms.'
                              : 'Optional — leave blank to accept all Lead Ads forms on this Page.'}
                    </p>
                </div>
            ) : null}

            {whatsappSelected ? (
                <div className="space-y-4">
                    <Controller
                        name="source_config.phone_number_id"
                        control={control}
                        rules={{
                            required: whatsappSelected
                                ? 'Select a WhatsApp number.'
                                : false,
                        }}
                        render={({ field }) => (
                            <SelectBox
                                label="WhatsApp number"
                                required
                                value={field.value}
                                onValueChange={(value) => {
                                    field.onChange(value);
                                    const phone = whatsappPhones.find(
                                        (item) =>
                                            String(item.id) === String(value),
                                    );
                                    setValue(
                                        'source_config.phone_number',
                                        phone?.display_phone_number || '',
                                    );
                                    setValue(
                                        'source_config.phone_name',
                                        phone?.verified_name || '',
                                    );
                                    setValue(
                                        'source_config.waba_id',
                                        phone?.waba_id || '',
                                    );
                                }}
                                options={whatsappPhoneOptions}
                                placeholder="Select number"
                                error={fieldError(
                                    'source_config.phone_number_id',
                                )}
                            />
                        )}
                    />
                    <p className="text-xs text-muted-foreground">
                        Inbound messages to this number create leads on this
                        campaign. Messaging charges are billed by Meta to your
                        WhatsApp Business account.
                    </p>
                </div>
            ) : null}

            <Input
                label="Campaign Title"
                required
                placeholder="Spring launch"
                error={fieldError('title')}
                {...register('title', {
                    required: 'Campaign title is required.',
                })}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Controller
                    name="project_id"
                    control={control}
                    render={({ field }) => (
                        <SelectBox
                            label="Project"
                            value={field.value}
                            onValueChange={field.onChange}
                            options={projectOptions}
                            placeholder="Optional"
                            clearable
                            error={fieldError('project_id')}
                        />
                    )}
                />
                <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                        <SelectBox
                            label="Status"
                            value={field.value}
                            onValueChange={field.onChange}
                            options={statusOptions}
                            placeholder="Select"
                            error={fieldError('status')}
                        />
                    )}
                />
                <Controller
                    name="purpose"
                    control={control}
                    render={({ field }) => (
                        <SelectBox
                            label="Purpose"
                            value={field.value}
                            onValueChange={field.onChange}
                            options={purposeOptions}
                            placeholder="Select"
                            error={fieldError('purpose')}
                        />
                    )}
                />
            </div>

            <div className="space-y-0.5">
                <Label className="mb-1 flex text-label font-medium text-muted-foreground">
                    Description
                </Label>
                <Textarea
                    rows={3}
                    placeholder="Optional short brief"
                    {...register('description')}
                />
            </div>

            {externalIntake ? (
                <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    {whatsappSelected
                        ? 'Leads sync from WhatsApp messages — no Propflow form, landing page, or embed snippet is needed.'
                        : 'Leads sync from Meta Lead Ads — no Propflow form, landing page, or embed snippet is needed.'}
                </p>
            ) : (
                <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    A lead form is created automatically. You can customize
                    fields after creating the campaign.
                </p>
            )}
        </div>
    );
}

export function DetailsStep({
    control,
    register,
    fieldError,
    externalIntake,
    facebookSelected,
    whatsappSelected,
    channelOptions,
    assigneeOptions,
    stageOptions,
    currencySymbol,
}) {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {!externalIntake ? (
                    <Controller
                        name="channel"
                        control={control}
                        render={({ field }) => (
                            <SelectBox
                                label="Channel"
                                value={field.value}
                                onValueChange={field.onChange}
                                options={channelOptions}
                                placeholder="Select"
                                error={fieldError('channel')}
                            />
                        )}
                    />
                ) : null}
                <Controller
                    name="owner_id"
                    control={control}
                    render={({ field }) => (
                        <SelectBox
                            label="Owner"
                            value={field.value}
                            onValueChange={field.onChange}
                            options={assigneeOptions}
                            placeholder="Select"
                            clearable
                            error={fieldError('owner_id')}
                        />
                    )}
                />
                <Controller
                    name="starts_at"
                    control={control}
                    render={({ field }) => (
                        <DatePicker
                            label="Start Date"
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select date..."
                            error={fieldError('starts_at')}
                        />
                    )}
                />
                <Controller
                    name="ends_at"
                    control={control}
                    render={({ field }) => (
                        <DatePicker
                            label="End Date"
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select date..."
                            error={fieldError('ends_at')}
                        />
                    )}
                />
            </div>

            <Input
                label="Tags"
                placeholder="launch, q2, whatsapp"
                error={fieldError('tags')}
                {...register('tags')}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Controller
                    name="budget"
                    control={control}
                    render={({ field }) => (
                        <MoneyField
                            label="Total budget"
                            value={field.value}
                            onChange={field.onChange}
                            error={fieldError('budget')}
                            currencySymbol={currencySymbol}
                        />
                    )}
                />
                <Controller
                    name="target_cpl"
                    control={control}
                    render={({ field }) => (
                        <MoneyField
                            label="Target CPL"
                            value={field.value}
                            onChange={field.onChange}
                            error={fieldError('target_cpl')}
                            currencySymbol={currencySymbol}
                        />
                    )}
                />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Controller
                    name="default_assignee_id"
                    control={control}
                    render={({ field }) => (
                        <SelectBox
                            label="Default assignee"
                            value={field.value}
                            onValueChange={field.onChange}
                            options={assigneeOptions}
                            placeholder="Select"
                            clearable
                            error={fieldError('default_assignee_id')}
                        />
                    )}
                />
                <Controller
                    name="default_lead_stage_id"
                    control={control}
                    render={({ field }) => (
                        <SelectBox
                            label="Default stage"
                            value={field.value}
                            onValueChange={field.onChange}
                            options={stageOptions}
                            placeholder="Select"
                            clearable
                            error={fieldError('default_lead_stage_id')}
                        />
                    )}
                />
            </div>

            <Input
                label="Lead source label"
                placeholder={
                    facebookSelected
                        ? 'Meta Lead Ads'
                        : whatsappSelected
                          ? 'WhatsApp'
                          : 'Campaign landing'
                }
                error={fieldError('lead_source_label')}
                {...register('lead_source_label')}
            />
        </div>
    );
}

export function GoalsStep({
    control,
    register,
    fieldError,
    goalFields,
    externalIntake,
    whatsappSelected,
}) {
    return (
        <div className="space-y-5">
            <div className="space-y-3">
                <div>
                    <h3 className="text-base font-bold tracking-tight">
                        Set Goals
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        Enable a metric and set its target.
                    </p>
                </div>
                <div className="space-y-2">
                    {goalFields.map(({ key, label, color }) => (
                        <Controller
                            key={key}
                            name={`goals.${key}`}
                            control={control}
                            render={({ field }) => (
                                <GoalRow
                                    label={label}
                                    color={color}
                                    enabled={Boolean(field.value?.enabled)}
                                    target={field.value?.target ?? 0}
                                    onEnabledChange={(enabled) =>
                                        field.onChange({
                                            ...field.value,
                                            enabled,
                                            target: field.value?.target ?? 0,
                                        })
                                    }
                                    onTargetChange={(target) =>
                                        field.onChange({
                                            ...field.value,
                                            enabled: Boolean(
                                                field.value?.enabled,
                                            ),
                                            target,
                                        })
                                    }
                                />
                            )}
                        />
                    ))}
                </div>
            </div>

            {!externalIntake ? (
                <>
                    <div className="space-y-3 border-t border-border pt-5">
                        <div>
                            <h3 className="text-base font-bold tracking-tight">
                                Landing page
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                Optional — you can refine this later.
                            </p>
                        </div>
                        <Input
                            label="Headline"
                            placeholder="Find your next home"
                            {...register('landing.headline')}
                        />
                        <Input
                            label="Subheadline"
                            placeholder="Register interest in a few seconds"
                            {...register('landing.subheadline')}
                        />
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Input
                                label="CTA label"
                                placeholder="Register interest"
                                {...register('landing.cta_label')}
                            />
                            <Input
                                label="Redirect URL"
                                placeholder="https://example.com/thanks"
                                error={fieldError('landing.redirect_url')}
                                {...register('landing.redirect_url')}
                            />
                        </div>
                        <div className="space-y-0.5">
                            <Label className="mb-1 flex text-label font-medium text-muted-foreground">
                                Thank-you message
                            </Label>
                            <Textarea
                                rows={2}
                                placeholder="Thanks — we will be in touch shortly."
                                {...register('landing.thank_you_message')}
                            />
                        </div>
                    </div>

                    <div className="space-y-3 border-t border-border pt-5">
                        <div>
                            <h3 className="text-base font-bold tracking-tight">
                                Attribution
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                Optional UTM defaults.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Input
                                label="utm_source"
                                placeholder="facebook"
                                {...register('utm.source')}
                            />
                            <Input
                                label="utm_medium"
                                placeholder="cpc"
                                {...register('utm.medium')}
                            />
                            <Input
                                label="utm_campaign"
                                placeholder="spring-launch"
                                {...register('utm.campaign')}
                            />
                            <Input
                                label="utm_content"
                                placeholder="hero-cta"
                                {...register('utm.content')}
                            />
                        </div>
                    </div>
                </>
            ) : (
                <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    Landing pages, UTM defaults, and embed snippets are skipped
                    —
                    {whatsappSelected
                        ? ' WhatsApp messages deliver leads directly into this campaign.'
                        : ' Meta Lead Ads deliver leads directly into this campaign.'}
                </p>
            )}
        </div>
    );
}

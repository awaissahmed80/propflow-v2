import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupNumberInput,
} from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import { cn } from '@/lib/utils';

export function csrfHeaders() {
    const token = document
        .querySelector('meta[name="csrf-token"]')
        ?.getAttribute('content');
    const xsrf = document.cookie
        .split('; ')
        .find((row) => row.startsWith('XSRF-TOKEN='))
        ?.split('=')[1];

    const headers = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };

    if (token) {
        headers['X-CSRF-TOKEN'] = token;
    }

    if (xsrf) {
        headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrf);
    }

    return headers;
}

export function mapSelectOptions(items, fallbacks) {
    return (items || fallbacks).map((item) => {
        if (typeof item !== 'string') {
            return item;
        }

        return (
            fallbacks.find((option) => option.value === item) || {
                value: item,
                label: item
                    .split('_')
                    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                    .join(' '),
            }
        );
    });
}

export function WizardSteps({ steps, current }) {
    return (
        <ol className="flex items-center gap-2">
            {steps.map((step, index) => {
                const active = index === current;
                const done = index < current;

                return (
                    <li
                        key={step.id}
                        className="flex min-w-0 flex-1 items-center gap-2"
                    >
                        <div
                            className={cn(
                                'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                                active && 'bg-primary text-primary-foreground',
                                done && 'bg-primary/15 text-primary',
                                !active &&
                                    !done &&
                                    'bg-muted text-muted-foreground',
                            )}
                        >
                            {done ? (
                                <Icon name="check-line" className="text-sm" />
                            ) : (
                                index + 1
                            )}
                        </div>
                        <div className="hidden min-w-0 sm:block">
                            <p
                                className={cn(
                                    'truncate text-xs font-medium',
                                    active
                                        ? 'text-foreground'
                                        : 'text-muted-foreground',
                                )}
                            >
                                {step.title}
                            </p>
                        </div>
                        {index < steps.length - 1 ? (
                            <div
                                className={cn(
                                    'mx-1 hidden h-px flex-1 sm:block',
                                    done ? 'bg-primary/40' : 'bg-border',
                                )}
                            />
                        ) : null}
                    </li>
                );
            })}
        </ol>
    );
}

export function MoneyField({ label, value, onChange, error, currencySymbol }) {
    return (
        <div className="space-y-0.5">
            <Label className="mb-1 text-label font-medium text-muted-foreground">
                {label}
            </Label>
            <InputGroup className={cn(error && 'border-destructive')}>
                <InputGroupAddon>{currencySymbol}</InputGroupAddon>
                <InputGroupNumberInput
                    value={value}
                    onChange={onChange}
                    allowDecimal
                    min={0}
                    placeholder="0"
                />
            </InputGroup>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
    );
}

export function GoalRow({
    label,
    color,
    enabled,
    target,
    onEnabledChange,
    onTargetChange,
}) {
    return (
        <div
            className={cn(
                'flex items-center gap-3 rounded-xl border px-3 py-3 shadow-xs transition-colors',
                enabled
                    ? 'border-border bg-background'
                    : 'border-border/60 bg-muted/20',
            )}
        >
            <Checkbox
                checked={enabled}
                onCheckedChange={(checked) => onEnabledChange(Boolean(checked))}
                className="shrink-0"
            >
                <span className="flex min-w-0 items-center gap-2.5">
                    <span
                        className="size-3 shrink-0 rounded-full ring-2 ring-background"
                        style={{ backgroundColor: color || '#64748B' }}
                        aria-hidden
                    />
                    <span
                        className={cn(
                            'truncate text-sm font-medium',
                            enabled
                                ? 'text-foreground'
                                : 'text-muted-foreground',
                        )}
                    >
                        {label}
                    </span>
                </span>
            </Checkbox>
            <div
                className={cn(
                    'ml-auto w-[6.25rem] shrink-0 space-y-0.5 transition-opacity',
                    !enabled && 'pointer-events-none opacity-40',
                )}
            >
                <span className="block text-sm font-bold tracking-tight text-muted-foreground">
                    Target
                </span>
                <NumberInput
                    value={target}
                    onChange={(value) => onTargetChange(value ?? 0)}
                    min={0}
                    showSteppers={false}
                    disabled={!enabled}
                    placeholder="0"
                    aria-label={`${label} target`}
                />
            </div>
        </div>
    );
}

export const PURPOSE_OPTIONS = [
    { value: 'lead_generation', label: 'Lead Generation' },
    { value: 'brand_awareness', label: 'Brand Awareness' },
    { value: 'sales', label: 'Sales' },
    { value: 'event', label: 'Event' },
];

export const STATUS_OPTIONS = [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
];

export const CHANNEL_OPTIONS = [
    { value: 'website', label: 'Website' },
    { value: 'social', label: 'Social' },
    { value: 'search', label: 'Search' },
    { value: 'email', label: 'Email' },
    { value: 'referral', label: 'Referral' },
    { value: 'offline', label: 'Offline' },
    { value: 'partner', label: 'Partner' },
    { value: 'other', label: 'Other' },
];

export const FALLBACK_GOAL_FIELDS = [
    { key: 'total_leads', label: 'Total Leads' },
    { key: 'qualified_leads', label: 'Qualified Leads' },
    { key: 'engagement', label: 'Engagement' },
    { key: 'closed_deals', label: 'Closed Deals' },
];

export const STEPS = [
    {
        id: 'essentials',
        title: 'Essentials',
        description: 'Name the campaign. Everything else can wait.',
        fields: [
            'title',
            'project_id',
            'purpose',
            'status',
            'source_type',
            'source_config.page_id',
            'description',
        ],
    },
    {
        id: 'details',
        title: 'Details',
        description: 'Optional schedule, budget, and lead routing.',
        fields: [
            'channel',
            'owner_id',
            'starts_at',
            'ends_at',
            'tags',
            'budget',
            'target_cpl',
            'default_assignee_id',
            'default_lead_stage_id',
            'lead_source_label',
        ],
    },
    {
        id: 'targets',
        title: 'Goals & page',
        description:
            'Optional targets and landing copy. Form fields can be edited later.',
        fields: [
            'goals',
            'landing.headline',
            'landing.subheadline',
            'landing.cta_label',
            'landing.redirect_url',
            'landing.thank_you_message',
            'utm.source',
            'utm.medium',
            'utm.campaign',
            'utm.content',
            'utm.term',
        ],
    },
];

export const EXTERNAL_STEPS = [
    STEPS[0],
    {
        ...STEPS[1],
        description: 'Optional schedule, budget, and how leads are routed.',
        fields: STEPS[1].fields.filter((field) => field !== 'channel'),
    },
    {
        id: 'targets',
        title: 'Goals',
        description: 'Optional targets for this campaign.',
        fields: ['goals'],
    },
];

export const emptyGoalsFromFields = (fields) =>
    Object.fromEntries(
        fields.map(({ key }) => [key, { enabled: false, target: 0 }]),
    );

export const emptyValuesForGoals = (goalFields) => ({
    source_type: 'custom_form',
    source_config: {
        page_id: '',
        page_name: '',
        form_id: '',
        form_name: '',
        phone_number_id: '',
        phone_number: '',
        phone_name: '',
        waba_id: '',
    },
    title: '',
    status: 'draft',
    description: '',
    purpose: 'lead_generation',
    channel: 'website',
    project_id: '',
    owner_id: '',
    starts_at: '',
    ends_at: '',
    budget: null,
    target_cpl: null,
    tags: '',
    default_assignee_id: '',
    default_lead_stage_id: '',
    lead_source_label: 'Campaign landing',
    landing: {
        headline: '',
        subheadline: '',
        cta_label: 'Register interest',
        thank_you_message: 'Thanks — we will be in touch shortly.',
        redirect_url: '',
    },
    utm: {
        source: '',
        medium: '',
        campaign: '',
        content: '',
        term: '',
    },
    goals: emptyGoalsFromFields(goalFields),
});

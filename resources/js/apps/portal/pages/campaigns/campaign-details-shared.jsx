import { AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
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
import { toast } from 'sonner';

export function copyText(value, successMessage) {
    if (!value) {
        toast.error('Nothing to copy');
        return;
    }

    navigator.clipboard.writeText(value).then(
        () => toast.success(successMessage),
        () => toast.error('Could not copy'),
    );
}

export function statusTone(status) {
    if (status === 'active') {
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
    }

    if (status === 'archived') {
        return 'bg-muted text-muted-foreground';
    }

    return 'bg-amber-500/10 text-amber-800 dark:text-amber-400';
}

export function titleCase(value) {
    return String(value || '')
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export function mapOptions(items, fallbacks = []) {
    return (items?.length ? items : fallbacks).map((item) => {
        if (typeof item !== 'string') {
            return item;
        }

        const match = fallbacks.find((option) => option.value === item);

        return match || { value: item, label: titleCase(item) };
    });
}

export function InsightCard({ label, value, hint }) {
    return (
        <div className="rounded-xl border border-border/70 bg-background px-4 py-3 shadow-xs">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                {value}
            </p>
            {hint ? (
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            ) : null}
        </div>
    );
}

export function FieldLabel({ children }) {
    return (
        <Label className="mb-1 flex text-label font-medium text-muted-foreground">
            {children}
        </Label>
    );
}

export function MoneyField({ label, value, onChange, currencySymbol }) {
    return (
        <div className="space-y-0.5">
            <FieldLabel>{label}</FieldLabel>
            <InputGroup>
                <InputGroupAddon>{currencySymbol}</InputGroupAddon>
                <InputGroupNumberInput
                    value={value}
                    onChange={onChange}
                    allowDecimal
                    min={0}
                    placeholder="0"
                />
            </InputGroup>
        </div>
    );
}

export function FieldGrid({ children }) {
    return <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">{children}</div>;
}

export function ToolPanel({ children, className }) {
    return (
        <div className={cn('space-y-3.5 px-3 pt-3.5 pb-5', className)}>
            {children}
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

export function ToolTrigger({ icon, label }) {
    return (
        <AccordionTrigger className="rounded-lg px-3 py-3.5 hover:bg-muted/40 hover:no-underline data-panel-open:bg-muted/30">
            <span className="flex items-center gap-2.5">
                <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon name={icon} className="text-base" />
                </span>
                <span className="text-sm font-medium text-foreground">
                    {label}
                </span>
            </span>
        </AccordionTrigger>
    );
}

export function PanelActions({ processing, onSave, label = 'Save' }) {
    return (
        <div className="flex justify-end border-t border-border/60 pt-3.5">
            <Button
                type="button"
                size="sm"
                loading={processing}
                onClick={onSave}
            >
                {label}
            </Button>
        </div>
    );
}

export function buildGoalsState(campaign, formOptions) {
    const catalog = formOptions.goal_types || [];
    const stored = campaign.goals || {};

    if (catalog.length > 0) {
        return Object.fromEntries(
            catalog.map((type) => [
                type.label,
                {
                    enabled: Boolean(stored[type.label]?.enabled),
                    target: Number(stored[type.label]?.target) || 0,
                    title: type.title || titleCase(type.label),
                    color: type.color || '#64748B',
                },
            ]),
        );
    }

    return Object.fromEntries(
        Object.entries(stored).map(([key, goal]) => [
            key,
            {
                enabled: Boolean(goal?.enabled),
                target: Number(goal?.target) || 0,
                title: titleCase(key),
                color: '#64748B',
            },
        ]),
    );
}

import { useEffect, useMemo, useRef, useState } from "react";
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { ComboBox } from "@/components/ui/combo-box";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { SelectBox } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { formatDateTime } from "@/lib/datetime";
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { LeadMetricBar } from "../../components/lead-card";
import { UserAvatar, UserCardPopover } from "../../components/user-card";
import { RelativeTimeTooltip } from "./lead-activity-timeline";
import { patchLead } from "./lead-assignment-menus";

const DEAL_VALUE_DEFAULT_MAX = 50_000_000;

const DEFAULT_SOURCES = [
    "Website",
    "Referral",
    "Walk-in",
    "Facebook",
    "Google",
    "Call",
    "WhatsApp",
];

function titleCaseLabel(value) {
    return String(value || "")
        .toLowerCase()
        .split(" ")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function dealValueBounds(budget) {
    const current = Math.max(0, Number(budget) || 0);
    const max = Math.max(
        DEAL_VALUE_DEFAULT_MAX,
        Math.ceil((current * 1.5) / 100_000) * 100_000
    );
    const step = Math.max(10_000, Math.round(max / 100));

    return { min: 0, max, step };
}

function DetailField({ label, children, className }) {
    return (
        <div className={className || "space-y-1"}>
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
            </div>
            <div className="text-sm text-foreground">{children ?? "—"}</div>
        </div>
    );
}

function DetailCard({ title, icon, onEdit, editDisabled = false, editLabel, children }) {
    return (
        <Card
            size="sm"
            className="gap-0 rounded-md py-0 shadow-none bg-transparent border-0 ring-0"
        >
            <CardHeader className="px-4 py-3 [.border-b]:pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <Icon name={icon} className="text-base text-muted-foreground" />
                    {title}
                </CardTitle>
                
            </CardHeader>
            <CardContent className="grid gap-4 px-4 py-4 sm:grid-cols-2 border-0">
                {children}
            </CardContent>
        </Card>
    );
}

function EditableValueButton({ label, displayValue, disabled = false, onEdit }) {
    const empty = !displayValue || displayValue === "—";

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onEdit}
            aria-label={`Edit ${label}`}
            title={`Click to edit ${label}`}
            className={cn(
                "-mx-1.5 inline-flex max-w-full items-center rounded-md px-1.5 py-0.5 text-left text-sm transition-colors",
                "border border-transparent border-b-border/70 border-b-dashed",
                "hover:bg-muted/60 hover:border-b-primary/40",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                "disabled:cursor-default disabled:border-transparent disabled:hover:bg-transparent disabled:hover:border-transparent",
                empty ? "text-muted-foreground" : "text-foreground"
            )}
        >
            <span className="truncate">{displayValue || "—"}</span>
        </button>
    );
}

/**
 * @param {object} props
 * @param {object} props.lead
 * @param {string[]} [props.sources]
 * @param {boolean} props.disabled
 */
function SourceField({ lead, sources = [], disabled = false }) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(lead?.source || "");
    const valueRef = useRef(value);
    const wrapRef = useRef(null);

    useEffect(() => {
        setValue(lead?.source || "");
        valueRef.current = lead?.source || "";
    }, [lead?.id, lead?.source]);

    useEffect(() => {
        if (!editing) {
            return undefined;
        }

        const frame = requestAnimationFrame(() => {
            const input = wrapRef.current?.querySelector(
                '[data-slot="combobox-input"]'
            );

            if (input instanceof HTMLInputElement) {
                input.focus();
            }
        });

        return () => cancelAnimationFrame(frame);
    }, [editing]);

    const options = useMemo(
        () =>
            Array.from(
                new Set([...DEFAULT_SOURCES, ...sources, lead?.source].filter(Boolean))
            ),
        [sources, lead?.source]
    );

    const commit = (raw = valueRef.current) => {
        const next = String(raw || "").trim() || null;
        const current = lead?.source || null;

        if (next !== current) {
            patchLead(
                lead,
                { source: next },
                next ? "Source updated" : "Source cleared"
            );
        }

        setEditing(false);
    };

    return (
        <DetailField label="Source">
            {editing && !disabled ? (
                <div ref={wrapRef}>
                    <ComboBox
                        value={value}
                        onValueChange={(next) => {
                            valueRef.current = next;
                            setValue(next);
                        }}
                        options={options}
                        placeholder="Google, Referral..."
                        clearable
                        onOpenChange={(open) => {
                            if (!open) {
                                commit();
                            }
                        }}
                        onBlur={() => commit()}
                    />
                </div>
            ) : (
                <EditableValueButton
                    label="source"
                    displayValue={lead?.source || "—"}
                    disabled={disabled}
                    onEdit={() => setEditing(true)}
                />
            )}
        </DetailField>
    );
}

/**
 * @param {object} props
 * @param {object} props.lead
 * @param {Array<{id: number, title: string}>} [props.campaigns]
 * @param {boolean} props.disabled
 */
function CampaignField({ lead, campaigns = [], disabled = false }) {
    const [editing, setEditing] = useState(false);
    const wrapRef = useRef(null);
    const hasCampaigns = campaigns.length > 0;

    const options = useMemo(
        () =>
            campaigns.map((campaign) => ({
                value: String(campaign.id),
                label: campaign.title,
            })),
        [campaigns]
    );

    const displayValue =
        lead?.campaign?.title ||
        campaigns.find((campaign) => Number(campaign.id) === Number(lead?.campaign_id))
            ?.title ||
        "—";

    useEffect(() => {
        if (!editing || !hasCampaigns) {
            return undefined;
        }

        const frame = requestAnimationFrame(() => {
            const trigger = wrapRef.current?.querySelector(
                '[data-slot="select-trigger"]'
            );

            if (trigger instanceof HTMLElement) {
                trigger.click();
            }
        });

        const onPointerDown = (event) => {
            const target = event.target;

            if (
                wrapRef.current?.contains(target) ||
                (target instanceof Element &&
                    target.closest('[data-slot="select-content"]'))
            ) {
                return;
            }

            setEditing(false);
        };

        document.addEventListener("pointerdown", onPointerDown);

        return () => {
            cancelAnimationFrame(frame);
            document.removeEventListener("pointerdown", onPointerDown);
        };
    }, [editing, hasCampaigns]);

    if (!hasCampaigns) {
        return (
            <DetailField label="Campaign">
                <span className="text-sm text-muted-foreground">
                    No campaigns added
                </span>
            </DetailField>
        );
    }

    return (
        <DetailField label="Campaign">
            {editing && !disabled ? (
                <div ref={wrapRef}>
                    <SelectBox
                        value={lead?.campaign_id ? String(lead.campaign_id) : ""}
                        options={options}
                        placeholder="Select campaign…"
                        clearable
                        onValueChange={(nextValue) => {
                            const next = nextValue ? Number(nextValue) : null;

                            if ((lead?.campaign_id ?? null) !== next) {
                                patchLead(
                                    lead,
                                    { campaign_id: next },
                                    next ? "Campaign updated" : "Campaign cleared"
                                );
                            }

                            setEditing(false);
                        }}
                    />
                </div>
            ) : (
                <EditableValueButton
                    label="campaign"
                    displayValue={displayValue}
                    disabled={disabled}
                    onEdit={() => setEditing(true)}
                />
            )}
        </DetailField>
    );
}

/**
 * @param {object} props
 * @param {object} props.lead
 * @param {boolean} props.disabled
 */
function DealValueSlider({ lead, disabled = false }) {
    const { min, max, step } = dealValueBounds(lead?.budget);
    const committed = Math.max(0, Number(lead?.budget) || 0);
    const [value, setValue] = useState([committed]);

    useEffect(() => {
        setValue([Math.max(0, Number(lead?.budget) || 0)]);
    }, [lead?.id, lead?.budget]);

    const current = Array.isArray(value) ? Number(value[0]) || 0 : Number(value) || 0;

    return (
        <div className="space-y-2 py-3 sm:col-span-2">
            <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Deal value
                </div>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                    {formatMoney(current)}
                </span>
            </div>
            <Slider
                value={value}
                min={min}
                max={max}
                step={step}
                disabled={disabled}
                onValueChange={(next) => {
                    setValue(Array.isArray(next) ? next : [Number(next) || 0]);
                }}
                onValueCommitted={(next) => {
                    const nextValue = Array.isArray(next)
                        ? Number(next[0]) || 0
                        : Number(next) || 0;

                    if (nextValue === committed) {
                        return;
                    }

                    patchLead(lead, { budget: nextValue }, "Deal value updated");
                }}
            />
            <div className="flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
                <span>{formatMoney(min)}</span>
                <span>{formatMoney(max)}</span>
            </div>
        </div>
    );
}

/**
 * Lead-only details tab.
 *
 * @param {object} props
 * @param {object} props.lead
 * @param {boolean} props.isArchived
 * @param {boolean} props.dealLocked
 * @param {string[]} [props.sources]
 * @param {Array<{id: number, title: string}>} [props.campaigns]
 */
export function LeadDetailsTab({
    lead,
    isArchived = false,
    dealLocked = false,
    sources = [],
    campaigns = [],
}) {
    const editDisabled = isArchived || dealLocked;
    const creator = lead?.creator;
    const creatorName = creator?.display_name || "—";

    const creatorTrigger = (
        <span className="flex min-w-0 items-center gap-2">
            {creator ? (
                <UserAvatar user={creator} size="sm" className="size-6" />
            ) : null}
            <span className="truncate">{creatorName}</span>
        </span>
    );

    return (
        <DetailCard title="Lead information" icon="flag-line">
            <SourceField
                lead={lead}
                sources={sources}
                disabled={editDisabled}
            />
            <CampaignField
                lead={lead}
                campaigns={campaigns}
                disabled={editDisabled}
            />
            <DealValueSlider lead={lead} disabled={editDisabled} />
            <DetailField label="Lead score">
                <LeadMetricBar
                    value={lead?.score}
                    barClassName="bg-emerald-500"
                />
            </DetailField>
            <DetailField label="Engagement">
                <LeadMetricBar
                    value={lead?.engagement}
                    barClassName="bg-blue-600 dark:bg-blue-500"
                />
            </DetailField>
            <DetailField label="Last activity">
                <RelativeTimeTooltip
                    value={lead.last_activity_at}
                    className="text-sm"
                />
            </DetailField>
            <DetailField label="Created by">
                {creator?.code ? (
                    <UserCardPopover user={creator} className="-ml-1 px-1 py-0.5">
                        {creatorTrigger}
                    </UserCardPopover>
                ) : (
                    creatorTrigger
                )}
            </DetailField>
            <DetailField label="Created">
                {formatDateTime(lead.created_at)}
            </DetailField>
            {isArchived ? (
                <DetailField label="Archived">
                    {formatDateTime(lead.archived_at)}
                </DetailField>
            ) : null}
            <div className="sm:col-span-2">
                <DetailField label="Notes">{lead.notes || "—"}</DetailField>
            </div>
        </DetailCard>
    );
}

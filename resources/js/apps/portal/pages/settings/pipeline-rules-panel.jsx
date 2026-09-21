import { useEffect, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { pipelineRules as updatePipelineRules } from "@/routes/portal/settings";
import { NumberInput } from "@/components/ui/number-input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

function pathFrom(url) {
    const raw = String(url || "/");

    if (raw.startsWith("//") || raw.startsWith("http://") || raw.startsWith("https://")) {
        try {
            const pathname = new URL(raw.startsWith("//") ? `https:${raw}` : raw).pathname;

            return pathname === "" ? "/" : pathname;
        } catch {
            return "/";
        }
    }

    return raw.startsWith("/") ? raw : `/${raw}`;
}

function RuleRow({ title, description, checked, onCheckedChange, disabled = false, children, last = false }) {
    return (
        <div className={cn("px-5 py-4", !last && "border-b border-border/60")}>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <p className="text-base font-bold tracking-tight text-foreground">{title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
                    {children}
                </div>
                <Switch
                    className="mt-0.5 shrink-0"
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={onCheckedChange}
                />
            </div>
        </div>
    );
}

export default function PipelineRulesPanel({ pipelineRules = {} }) {
    const [processing, setProcessing] = useState(false);
    const [autoAssign, setAutoAssign] = useState(Boolean(pipelineRules.auto_assign));
    const [requireNotes, setRequireNotes] = useState(
        Boolean(pipelineRules.require_notes_on_stage_change)
    );
    const [flagStale, setFlagStale] = useState(Boolean(pipelineRules.flag_stale_leads));
    const [staleAfterDays, setStaleAfterDays] = useState(
        Number(pipelineRules.stale_after_days ?? 14)
    );
    const staleTimer = useRef(null);

    const stateRef = useRef({
        auto_assign: autoAssign,
        require_notes_on_stage_change: requireNotes,
        flag_stale_leads: flagStale,
        stale_after_days: staleAfterDays,
    });

    useEffect(() => {
        setAutoAssign(Boolean(pipelineRules.auto_assign));
        setRequireNotes(Boolean(pipelineRules.require_notes_on_stage_change));
        setFlagStale(Boolean(pipelineRules.flag_stale_leads));
        setStaleAfterDays(Number(pipelineRules.stale_after_days ?? 14));
    }, [pipelineRules]);

    useEffect(() => {
        stateRef.current = {
            auto_assign: autoAssign,
            require_notes_on_stage_change: requireNotes,
            flag_stale_leads: flagStale,
            stale_after_days: staleAfterDays,
        };
    }, [autoAssign, requireNotes, flagStale, staleAfterDays]);

    useEffect(() => {
        return () => {
            if (staleTimer.current) {
                clearTimeout(staleTimer.current);
            }
        };
    }, []);

    const persist = (next) => {
        const payload = {
            auto_assign: next.auto_assign,
            require_notes_on_stage_change: next.require_notes_on_stage_change,
            flag_stale_leads: next.flag_stale_leads,
            stale_after_days: Number(next.stale_after_days) || 14,
        };

        setProcessing(true);
        router.put(pathFrom(updatePipelineRules.url()), payload, {
            preserveScroll: true,
            preserveState: "errors",
            optimistic: (props) => ({
                pipelineRules: {
                    ...(props.pipelineRules ?? {}),
                    ...payload,
                },
            }),
            onError: (errors) =>
                toast.error(errors.stale_after_days || errors.message || "Unable to save rule"),
            onFinish: () => setProcessing(false),
        });
    };

    const toggle = (key, value) => {
        const next = {
            ...stateRef.current,
            [key]: Boolean(value),
        };

        if (key === "auto_assign") {
            setAutoAssign(Boolean(value));
        }
        if (key === "require_notes_on_stage_change") {
            setRequireNotes(Boolean(value));
        }
        if (key === "flag_stale_leads") {
            setFlagStale(Boolean(value));
        }

        persist(next);
    };

    const scheduleStaleDays = (value) => {
        const days = Number(value) || 14;
        setStaleAfterDays(days);
        stateRef.current = {
            ...stateRef.current,
            stale_after_days: days,
            flag_stale_leads: true,
        };

        if (staleTimer.current) {
            clearTimeout(staleTimer.current);
        }

        staleTimer.current = setTimeout(() => {
            persist({
                ...stateRef.current,
                stale_after_days: days,
                flag_stale_leads: true,
            });
        }, 400);
    };

    return (
        <div>
            <RuleRow
                title="Auto-Assign New Lead"
                description="Round-robin assignment across active reps"
                checked={autoAssign}
                disabled={processing}
                onCheckedChange={(value) => toggle("auto_assign", value)}
            />

            <RuleRow
                title="Require Notes Before Stage Change"
                description="Agents must leave a note before moving a lead"
                checked={requireNotes}
                disabled={processing}
                onCheckedChange={(value) => toggle("require_notes_on_stage_change", value)}
            />

            <RuleRow
                title="Flag Stale Leads"
                description="Highlight leads with no activity after a set number of days"
                checked={flagStale}
                disabled={processing}
                onCheckedChange={(value) => toggle("flag_stale_leads", value)}
                last
            >
                {flagStale ? (
                    <div className="mt-3 max-w-[10rem]">
                        <NumberInput
                            label="Days"
                            value={staleAfterDays}
                            min={1}
                            max={365}
                            showSteppers={false}
                            disabled={processing}
                            onChange={(value) => scheduleStaleDays(value ?? 14)}
                        />
                    </div>
                ) : null}
            </RuleRow>
        </div>
    );
}

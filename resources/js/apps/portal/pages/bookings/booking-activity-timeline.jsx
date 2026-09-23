import { useEffect, useRef, useState } from "react";
import { FilePreview, FilePreviewTile } from "@/components/file-preview";
import { isVoiceNoteFile, VoiceNotePlayer } from "@/components/voice-note-player";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDateTime, formatRelativeTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

export const NOTE_ACTION = "Note";
export const NOTE_PLACEHOLDER = "Add a note on this booking...";

const SYSTEM_ACTIVITY_ICONS = {
    "Booking created": "file-list-3-line",
    "Token verified": "shield-check-line",
    "Booking & KYC completed": "user-follow-line",
    "Payment plan set": "calendar-schedule-line",
    "Payment recorded": "money-dollar-circle-line",
    "Ballot confirmed": "map-pin-line",
    "Buyer transferred": "user-shared-line",
    "Litigation set": "error-warning-line",
    "Litigation cleared": "checkbox-circle-line",
    "Ready for handover": "home-smile-line",
    "Booking completed": "flag-line",
    "Booking cancelled": "close-circle-line",
};

/**
 * @param {string} action
 * @param {boolean} isSystemLog
 * @returns {{ icon: string, color: string }}
 */
function activityMeta(action, isSystemLog = false) {
    if (action === NOTE_ACTION) {
        return { icon: "sticky-note-line", color: "#64748B" };
    }

    if (isSystemLog || SYSTEM_ACTIVITY_ICONS[action]) {
        return {
            icon: SYSTEM_ACTIVITY_ICONS[action] || "history-line",
            color: "var(--muted-foreground)",
        };
    }

    return { icon: "history-line", color: "var(--primary)" };
}

/**
 * @param {string} color
 * @param {string} [alphaHex]
 * @returns {{ backgroundColor: string, color: string }}
 */
export function activityIconStyle(color, alphaHex = "22") {
    if (!color || String(color).startsWith("var(")) {
        const token = String(color || "").includes("muted")
            ? "var(--muted-foreground)"
            : "var(--primary)";

        return {
            backgroundColor: `color-mix(in oklab, ${token} 14%, transparent)`,
            color: color || "var(--primary)",
        };
    }

    return {
        backgroundColor: `${color}${alphaHex}`,
        color,
    };
}

/**
 * @param {Array} entries
 * @returns {Array}
 */
function sortedActivities(entries = []) {
    return [...entries].sort(
        (left, right) => new Date(left.created_at) - new Date(right.created_at),
    );
}

function paymentMethodOptions(deal) {
    const fromDeal = Array.isArray(deal?.payment_methods) ? deal.payment_methods : [];

    return Array.from(new Set([...fromDeal, ...FALLBACK_PAYMENT_METHODS].filter(Boolean)));
}

function emptyPaymentForm(deal) {
    const methods = paymentMethodOptions(deal);

    return {
        amount: null,
        method: methods[0] || "Cash",
        reference: "",
        paid_on: new Date().toISOString().slice(0, 10),
        receipt: null,
    };
}

function pdfPreviewFile(name, url) {
    return {
        name: name || "Document.pdf",
        url,
        type: "application/pdf",
    };
}

function previewFileFromUrl(name, url) {
    const lower = String(url || "").toLowerCase();
    const isImage = /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(lower);

    if (isImage) {
        return {
            name: name || "Receipt",
            url,
            type: "image/jpeg",
            kind: "media",
        };
    }

    return pdfPreviewFile(name, url);
}

function bookingAmountValue(order, deal) {
    if (order?.token_amount != null && Number(order.token_amount) > 0) {
        return Number(order.token_amount);
    }

    if (order?.booking_amount != null && Number(order.booking_amount) > 0) {
        return Number(order.booking_amount);
    }

    if (deal?.plan?.down_payment != null && Number(deal.plan.down_payment) > 0) {
        return Number(deal.plan.down_payment);
    }

    return null;
}

function splitActions({ stage, status, deal, cancelled, closed }) {
    if (cancelled || closed) {
        return { primary: [], more: [] };
    }

    const primary = [];
    const more = [];
    const tokenVerified = Boolean(deal?.booking?.verified_at);

    if (stage === "token") {
        primary.push({ id: "verify", label: "Verify token" });
    }

    if (stage === "booking_kyc") {
        primary.push({ id: "enter_kyc", label: "Enter Booking & KYC" });
    }

    if (stage === "active") {
        primary.push({ id: "payment", label: "Record payment" });
    }

    if (tokenVerified && !deal?.plan?.template && (stage === "booking_kyc" || stage === "active")) {
        more.push({ id: "plan", label: "Set payment plan" });
    }

    if (stage === "active") {
        if (deal?.balloting_enabled && !deal?.booking?.balloted_at) {
            more.push({ id: "ballot", label: "Record balloting" });
        }

        more.push({
            id: "litigation",
            label: status === "litigation" ? "Clear litigation" : "Set litigation",
        });

        if (Number(deal?.ledger?.total_outstanding) <= 0) {
            if (deal?.handover_ready_at) {
                more.push({ id: "deliver", label: "Complete / handover" });
            } else {
                more.push({ id: "handover", label: "Ready for handover" });
            }
        }
    }

    more.push({ id: "transfer", label: "Transfer" });
    more.push({ id: "cancel", label: "Cancel booking", destructive: true });

    return { primary, more };
}

function ActivityAttachments({ files }) {
    const [open, setOpen] = useState(false);
    const [index, setIndex] = useState(0);
    const voiceNotes = (files || []).filter((file) => isVoiceNoteFile(file));
    const otherFiles = (files || []).filter((file) => !isVoiceNoteFile(file));

    return (
        <>
            <div className="mt-2 space-y-2">
                {voiceNotes.map((file) => (
                    <VoiceNotePlayer
                        key={`${file.kind}-${file.id}`}
                        src={file.url}
                        name={file.name || "Voice note"}
                    />
                ))}
                {otherFiles.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {otherFiles.map((file, fileIndex) => (
                            <FilePreviewTile
                                key={`${file.kind}-${file.id}`}
                                file={file}
                                onPreview={() => {
                                    setIndex(fileIndex);
                                    setOpen(true);
                                }}
                            />
                        ))}
                    </div>
                ) : null}
            </div>
            <FilePreview
                open={open}
                onOpenChange={setOpen}
                files={otherFiles}
                index={index}
                onIndexChange={setIndex}
            />
        </>
    );
}

function RelativeTimeTooltip({ value, className }) {
    if (!value) {
        return <span className={className}>—</span>;
    }

    const absolute = formatDateTime(value);
    const relative = formatRelativeTime(value);

    return (
        <Tooltip>
            <TooltipTrigger
                delay={200}
                render={
                    <button
                        type="button"
                        className={cn(
                            "cursor-default border-0 bg-transparent p-0 text-left text-xs text-muted-foreground",
                            className,
                        )}
                    >
                        {relative}
                    </button>
                }
            />
            <TooltipContent>{absolute}</TooltipContent>
        </Tooltip>
    );
}

function entryAttachments(entry) {
    if (Array.isArray(entry?.attachments) && entry.attachments.length > 0) {
        return entry.attachments;
    }

    return [
        ...(entry?.media || []).map((file) => ({ ...file, kind: file.kind || "media" })),
        ...(entry?.documents || []).map((file) => ({ ...file, kind: file.kind || "document" })),
    ];
}

function ActivityRow({ entry, isLast = false }) {
    const isSystemLog = entry.type === "LOG";

    if (isSystemLog) {
        return <SystemLogRow entry={entry} isLast={isLast} />;
    }

    return <UserNoteRow entry={entry} isLast={isLast} />;
}

function SystemLogRow({ entry, isLast = false }) {
    const actorName = entry.user?.display_name;
    const meta = activityMeta(entry.action, true);

    return (
        <li className="relative flex gap-3">
            {!isLast ? (
                <span
                    className="absolute top-9 bottom-[-1.5rem] left-[1.125rem] border-l border-dashed border-border/70"
                    aria-hidden
                />
            ) : null}

            <span
                className="relative z-[1] flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border/60"
                aria-hidden
            >
                <Icon name={meta.icon} className="text-sm" />
            </span>

            <div className="min-w-0 flex-1 rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-2">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="text-sm font-medium text-muted-foreground">{entry.action}</p>
                    {entry.stage_label ? (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {entry.stage_label}
                        </span>
                    ) : null}
                    <RelativeTimeTooltip value={entry.created_at} />
                </div>

                {entry.comments ? (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground/90">
                        {entry.comments}
                    </p>
                ) : null}

                {actorName ? (
                    <p className="mt-1 text-[11px] text-muted-foreground/80">{actorName}</p>
                ) : null}
            </div>
        </li>
    );
}

function UserNoteRow({ entry, isLast = false }) {
    const actorName = entry.user?.display_name || "System";
    const actorAvatar = entry.user?.avatar || undefined;
    const meta = activityMeta(entry.action, false);
    const files = entryAttachments(entry);

    return (
        <li className="relative flex gap-3">
            {!isLast ? (
                <span
                    className="absolute top-9 bottom-[-1.5rem] left-[1.125rem] border-l border-dotted border-border"
                    aria-hidden
                />
            ) : null}

            <span
                className="relative z-[1] flex size-9 shrink-0 items-center justify-center rounded-full"
                style={activityIconStyle(meta.color)}
                aria-hidden
            >
                <Icon name={meta.icon} className="text-base" />
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
                <RelativeTimeTooltip value={entry.created_at} />

                <p className="mt-0.5 text-sm font-semibold text-foreground">{entry.action}</p>

                <div className="mt-1.5 flex items-center gap-1.5">
                    <Avatar
                        name={actorName}
                        src={actorAvatar}
                        className="size-5 shrink-0"
                        textClass="text-[8px]"
                    />
                    <span className="truncate text-xs text-muted-foreground">{actorName}</span>
                </div>

                {entry.comments &&
                !(
                    entry.comments === "Voice note" &&
                    files.some((file) => isVoiceNoteFile(file))
                ) ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {entry.comments}
                    </p>
                ) : null}

                {files.length > 0 ? <ActivityAttachments files={files} /> : null}
            </div>
        </li>
    );
}

/**
 * @param {object} props
 * @param {Array} props.entries
 * @param {boolean} [props.active]
 * @param {boolean} [props.showHeader]
 * @param {import('react').ReactNode} [props.headerAction]
 * @param {string} [props.emptyMessage]
 * @param {number} [props.limit]
 */
export function ActivityTimeline({
    entries = [],
    active = true,
    showHeader = true,
    headerAction = null,
    emptyMessage = "No activity yet.",
    limit,
}) {
    const endRef = useRef(null);
    const prevKeyRef = useRef(null);
    const rows = sortedActivities(entries);
    const visible = typeof limit === "number" ? rows.slice(-limit) : rows;
    const historyKey = visible.map((entry) => entry.id).join(":");

    const scrollToEnd = (smooth = false) => {
        const viewport = endRef.current?.closest('[data-slot="scroll-area-viewport"]');

        if (viewport) {
            if (smooth) {
                viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
            } else {
                viewport.scrollTop = viewport.scrollHeight;
            }
            return;
        }

        endRef.current?.scrollIntoView({
            block: "end",
            behavior: smooth ? "smooth" : "auto",
        });
    };

    useEffect(() => {
        if (!active) {
            return;
        }

        const changed = prevKeyRef.current !== historyKey;
        const smooth = changed && prevKeyRef.current !== null;
        prevKeyRef.current = historyKey;

        const frame = window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => scrollToEnd(smooth));
        });

        return () => window.cancelAnimationFrame(frame);
    }, [active, historyKey]);

    return (
        <div className="space-y-4">
            {showHeader ? (
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Icon name="time-line" className="text-lg text-foreground" />
                        <h3 className="text-base font-semibold text-foreground">Recent Activity</h3>
                    </div>
                    {headerAction}
                </div>
            ) : null}

            {visible.length === 0 ? (
                <div className="flex min-h-32 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                    {emptyMessage}
                </div>
            ) : (
                <ol className="space-y-6">
                    {visible.map((entry, index) => (
                        <ActivityRow
                            key={entry.id}
                            entry={entry}
                            isLast={index === visible.length - 1}
                        />
                    ))}
                </ol>
            )}

            <div ref={endRef} aria-hidden className="h-px w-full" />
        </div>
    );
}

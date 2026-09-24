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
import { dayjs, formatDateTime, formatRelativeTime, toDayjs } from "@/lib/datetime";
import { cn } from "@/lib/utils";

const SYSTEM_ACTIVITY_ICONS = {
    "Lead created": "user-add-line",
    "Stage changed": "git-commit-line",
    "Assignee changed": "user-shared-line",
    "Lead shared": "share-line",
    "Lead archived": "archive-line",
    "Lead restored": "arrow-go-back-line",
    "Deal won": "trophy-line",
    "Deal lost": "close-circle-line",
    "Deal booked": "bookmark-line",
};

const ACTIVITY_TYPE_COLORS = {
    call: "#64B5F6",
    meeting: "#FFB74D",
    site_visit: "#9575CD",
    email: "#F06292",
    message: "#0284C7",
    whatsapp_call: "#16A34A",
    whatsapp_message: "#0D9488",
    note: "#64748B",
    follow_up: "#16A34A",
    arrange_site_visit: "#FF8A65",
    arrange_meeting: "#0284C7",
    do_nothing: "#FFB74D",
};



/**
 * @param {string} title
 * @param {Array} items
 * @returns {{ icon: string, color: string }}
 */
export function activityTypeMeta(title, items = []) {
    const match = items.find((item) => item?.title === title || item?.label === title);
    const label = match?.label || "";
    const icon =
        match?.icon ||
        SYSTEM_ACTIVITY_ICONS[title] ||
        "history-line";
    const color =
        match?.color ||
        ACTIVITY_TYPE_COLORS[label] ||
        (SYSTEM_ACTIVITY_ICONS[title] ? "var(--muted-foreground)" : "var(--primary)");

    return { icon, color };
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

function timelineEntries(lead) {
    const tasks = Array.isArray(lead?.tasks) ? lead.tasks : [];
    const hasCreated = tasks.some((task) => task.action === "Lead created");

    const rows = hasCreated || !lead?.created_at
        ? [...tasks]
        : [
            ...tasks,
            {
                id: `created-${lead.id}`,
                action: "Lead created",
                comments: lead.creator?.display_name
                    ? `${lead.creator.display_name} created this lead.`
                    : "Created automatically.",
                status: "COMPLETED",
                type: "LOG",
                created_at: lead.created_at,
                user: lead.creator || null,
            },
        ];

    // Oldest → newest so the latest sits at the bottom.
    return rows.sort(
        (left, right) => new Date(left.created_at) - new Date(right.created_at),
    );
}

export function ActivityTimeline({ lead, active = true, actionTypes = [] }) {
    const endRef = useRef(null);
    const prevLeadCodeRef = useRef(null);
    const prevHistoryKeyRef = useRef(null);
    const entries = timelineEntries(lead);
    const scheduled = entries.filter((entry) => entry.status === "PENDING");
    const history = entries.filter((entry) => entry.status !== "PENDING");
    const historyKey = history.map((entry) => entry.id).join(":");

    const scrollToEnd = (smooth = false) => {
        const viewport = endRef.current?.closest(
            '[data-slot="scroll-area-viewport"]',
        );

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

        const leadChanged = prevLeadCodeRef.current !== lead?.code;
        const historyChanged = prevHistoryKeyRef.current !== historyKey;
        const smooth = !leadChanged && historyChanged && prevHistoryKeyRef.current !== null;

        prevLeadCodeRef.current = lead?.code ?? null;
        prevHistoryKeyRef.current = historyKey;

        const frame = window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => scrollToEnd(smooth));
        });

        return () => window.cancelAnimationFrame(frame);
    }, [active, lead?.code, historyKey]);

    if (entries.length === 0) {
        return (
            <div className="space-y-5">
                <div className="sticky top-0 z-10">
                    <div className="flex justify-center px-1">
                        <div className="inline-flex max-w-full items-center rounded-full border border-dashed border-border bg-muted px-3.5 py-1.5 text-center text-sm text-muted-foreground">
                            Nothing has been scheduled
                        </div>
                    </div>
                </div>
                <div className="flex min-h-32 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                    No activity yet
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-10">
            <div className="sticky top-0 z-10">
                {scheduled.length > 0 ? (
                    <div className="space-y-2">
                        {scheduled.map((entry) => (
                            <ScheduledActivityCard
                                key={entry.id}
                                entry={entry}
                                lead={lead}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex justify-center px-1 ">
                        <div className="inline-flex max-w-full bg-muted items-center rounded-full border border-dashed border-border bg-muted px-3.5 py-1.5 text-center text-sm text-muted-foreground">
                            Nothing has been scheduled
                        </div>
                    </div>
                )}
            </div>

            {history.length > 0 ? (
                <div className="space-y-3">             
                    <ol className="space-y-6">
                        {history.map((entry, index) => (
                            <ActivityRow
                                key={entry.id}
                                entry={entry}
                                actionTypes={actionTypes}
                                isLast={index === history.length - 1}
                            />
                        ))}
                    </ol>
                </div>
            ) : null}

            <div ref={endRef} aria-hidden className="h-px w-full" />
        </div>
    );
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

export function RelativeTimeTooltip({ value, className }) {
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

function nextActionTone(dueValue) {
    const due = toDayjs(dueValue);
    const now = dayjs();

    if (!due) {
        return "upcoming";
    }

    if (due.isBefore(now)) {
        return "overdue";
    }

    if (due.isSame(now, "day")) {
        return "today";
    }

    return "upcoming";
}

function nextActionMessage(actionTitle, dueValue) {
    const due = toDayjs(dueValue);
    const title = actionTitle || "Next action";

    if (!due) {
        return `${title} is scheduled`;
    }

    const relative = due.fromNow();

    if (due.isBefore(dayjs())) {
        return `${title} was scheduled ${relative}`;
    }

    return `${title} is scheduled ${relative}`;
}

function ScheduledActivityCard({ entry, lead }) {
    const tone = nextActionTone(lead.due_date);
    const message = nextActionMessage(entry.action, lead.due_date);

    return (
        <div className="flex justify-center px-1">
            <div
                className={cn(
                    "inline-flex max-w-full items-center gap-2 rounded-full px-3.5 py-2.5 text-center text-base font-medium shadow-xs",
                    tone === "upcoming" && "bg-primary/5 text-primary",
                    tone === "today" && "bg-orange-500 text-white",
                    tone === "overdue" && "bg-destructive text-destructive-foreground",
                )}
                title={formatDateTime(lead.due_date)}
            >
                <span className="inline-flex size-4 shrink-0 items-center justify-center">
                    <Icon
                        name={
                            tone === "overdue"
                                ? "error-warning-line"
                                : tone === "today"
                                  ? "time-line"
                                  : "calendar-check-line"
                        }
                        className="text-base leading-none"
                    />
                </span>
                <span className="min-w-0 truncate leading-none">{message}</span>
            </div>
        </div>
    );
}

function ActivityRow({ entry, actionTypes = [], isLast = false }) {
    const isSystemLog = entry.type === "LOG";

    if (isSystemLog) {
        return <SystemLogRow entry={entry} isLast={isLast} />;
    }

    return (
        <UserActivityRow
            entry={entry}
            actionTypes={actionTypes}
            isLast={isLast}
        />
    );
}

function SystemLogRow({ entry, isLast = false }) {
    const actorName = entry.user?.display_name;
    const meta = activityTypeMeta(entry.action, []);

    return (
        <li className="relative flex gap-3">
            {!isLast ? (
                <span
                    className="absolute top-9 -bottom-6 left-4.5 border-l border-dashed border-border/50"
                    aria-hidden
                />
            ) : null}

            <span
                className="relative z-1 flex size-9 shrink-0 items-center justify-center text-muted-foreground"
                aria-hidden
            >
                <Icon
                    name={meta.icon || "history-line"}
                    className="text-sm leading-none opacity-70"
                />
            </span>

            <div className="min-w-0 flex-1 self-center py-0.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="text-sm font-medium text-muted-foreground">
                        {entry.action}
                    </p>
                    <RelativeTimeTooltip
                        value={entry.created_at}
                        className="text-xs text-muted-foreground/70"
                    />
                </div>

                {entry.comments ? (
                    <p className="mt-0.5 text-sm leading-snug text-muted-foreground/80">
                        {entry.comments}
                        {actorName ? (
                            <span className="text-muted-foreground/60">
                                {" "}
                                · {actorName}
                            </span>
                        ) : null}
                    </p>
                ) : actorName ? (
                    <p className="mt-0.5 text-xs text-muted-foreground/60">
                        {actorName}
                    </p>
                ) : null}
            </div>
        </li>
    );
}

function UserActivityRow({ entry, actionTypes = [], isLast = false }) {
    const actorName = entry.user?.display_name || "System";
    const actorAvatar = entry.user?.avatar || undefined;
    const meta = activityTypeMeta(entry.action, actionTypes);

    return (
        <li className="relative flex gap-3">
            {!isLast ? (
                <span
                    className="absolute top-9 -bottom-6 left-4.5 border-l border-dotted border-border"
                    aria-hidden
                />
            ) : null}

            <span
                className="relative z-1 flex size-9 shrink-0 items-center justify-center rounded-full"
                style={activityIconStyle(meta.color)}
                aria-hidden
            >
                <Icon name={meta.icon} className="text-base" />
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
                <RelativeTimeTooltip
                    value={entry.created_at}
                    className="text-sm text-muted-foreground"
                />

                <div className="flex flex-row items-center gap-2">
                    <p className="mt-0.5 text-base font-semibold text-foreground">
                        {entry.action}
                    </p>

                    <div className="mt-1.5 flex items-center gap-1.5">
                        <Avatar
                            name={actorName}
                            src={actorAvatar}
                            className="size-5 shrink-0"
                            textClass="text-[8px]"
                        />
                        <span className="truncate text-sm text-muted-foreground">
                            {actorName}
                        </span>
                    </div>
                </div>

                {entry.comments &&
                !(
                    entry.comments === "Voice note" &&
                    entry.attachments?.some((file) => isVoiceNoteFile(file))
                ) ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {entry.comments}
                    </p>
                ) : null}

                {entry.attachments?.length ? (
                    <ActivityAttachments files={entry.attachments} />
                ) : null}
            </div>
        </li>
    );
}

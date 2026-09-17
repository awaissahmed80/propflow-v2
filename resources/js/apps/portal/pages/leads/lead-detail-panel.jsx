import { useEffect, useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import {
    archive as archiveLead,
    destroy as destroyLead,
    restore as restoreLead,
    update,
} from "@/actions/App/Http/Controllers/Portal/LeadController";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HeatIcon } from "@/components/ui/heat-icon";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { DateTimePicker } from "@/components/ui/date-picker";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatRelativeTime, toDayjs } from "@/lib/datetime";
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";

const TABS = [
    { id: "tasks", label: "Tasks & Updates" },
    { id: "details", label: "Details" },
    { id: "close", label: "Close Deal" },
];

const UPDATE_PLACEHOLDER =
    "Have you taken any steps on this lead? Record them here...";

// Short labels aligned with HubSpot / Pipedrive / Salesforce activity types.
const ACTIVITY_TYPES = [
    "Call",
    "Meeting",
    "Site Visit",
    "Email",
    "Message",
    "WhatsApp Call",
    "WhatsApp Message",
    "Note",
];

const NEXT_ACTION_TYPES = [
    "Follow-up",
    "Arrange Site Visit",
    "Arrange Meeting",
    "Do Nothing",
];

function phoneDigits(phone) {
    return String(phone || "").replace(/\D+/g, "");
}

function whatsappUrl(phone) {
    const digits = phoneDigits(phone);

    return digits ? `https://wa.me/${digits}` : null;
}

function telUrl(phone) {
    const digits = phoneDigits(phone);

    return digits ? `tel:+${digits}` : null;
}

function patchLead(lead, payload, successMessage = "Lead updated") {
    router.patch(update.url(lead.id), payload, {
        preserveScroll: true,
        onSuccess: () => toast.success(successMessage),
        onError: () => toast.error("Could not update lead"),
    });
}

function StageMenu({ lead, stages }) {
    const color = lead.stage?.color || "var(--muted-foreground)";

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
                        style={{
                            backgroundColor: `${color}22`,
                            borderColor: `${color}55`,
                            color,
                        }}
                    >
                        {lead.stage?.title || "Stage"}
                        <Icon name="arrow-down-s-line" className="text-sm" />
                    </button>
                }
            />
            <DropdownMenuContent align="end" className="min-w-40">
                {stages.map((stage) => {
                    const selected = Number(lead.lead_stage_id) === Number(stage.id);
                    const stageColor = stage.color || "var(--muted-foreground)";

                    return (
                        <DropdownMenuItem
                            key={stage.id}
                            disabled={selected}
                            onClick={() =>
                                patchLead(lead, { lead_stage_id: Number(stage.id) })
                            }
                        >
                            <span
                                className="size-1.5 shrink-0 rounded-sm"
                                style={{ backgroundColor: stageColor }}
                                aria-hidden
                            />
                            {stage.title}
                            {selected ? (
                                <Icon name="check-line" className="ml-auto text-sm" />
                            ) : null}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function AssigneeMenu({ lead, assignees }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <button
                        type="button"
                        className="inline-flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-muted/40 px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted/70"
                    >
                        {lead.assignee ? (
                            <>
                                <Avatar
                                    name={lead.assignee.display_name}
                                    src={lead.assignee.avatar || undefined}
                                    size="sm"
                                    className="size-6 shrink-0"
                                    textClass="text-[9px]"
                                />
                                <span className="min-w-0 truncate font-medium">
                                    {lead.assignee.display_name}
                                </span>
                            </>
                        ) : (
                            <span className="text-muted-foreground">Assign to…</span>
                        )}
                        <Icon
                            name="expand-up-down-line"
                            className="ml-auto shrink-0 text-sm text-muted-foreground"
                        />
                    </button>
                }
            />
            <DropdownMenuContent align="start" className="min-w-48">
                {assignees.map((user) => {
                    const selected = Number(lead.assigned_to) === Number(user.id);

                    return (
                        <DropdownMenuItem
                            key={user.id}
                            disabled={selected}
                            onClick={() =>
                                patchLead(lead, { assigned_to: Number(user.id) })
                            }
                        >
                            <Avatar
                                name={user.display_name}
                                src={user.avatar || undefined}
                                size="sm"
                                className="size-6 shrink-0"
                                textClass="text-[9px]"
                            />
                            <span className="truncate">{user.display_name}</span>
                            {selected ? (
                                <Icon name="check-line" className="ml-auto text-sm" />
                            ) : null}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function ProjectMenu({ lead, projects }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <button
                        type="button"
                        className="inline-flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-muted/40 px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted/70"
                    >
                        {lead.project ? (
                            <>
                                {lead.project.thumbnail ? (
                                    <img
                                        src={lead.project.thumbnail}
                                        alt=""
                                        className="size-6 shrink-0 rounded-full object-cover"
                                    />
                                ) : (
                                    <Avatar
                                        name={lead.project.title}
                                        size="sm"
                                        className="size-6 shrink-0"
                                        textClass="text-[9px]"
                                    />
                                )}
                                <span className="min-w-0 truncate font-medium">
                                    {lead.project.title}
                                </span>
                            </>
                        ) : (
                            <span className="text-muted-foreground">Select project…</span>
                        )}
                        <Icon
                            name="expand-up-down-line"
                            className="ml-auto shrink-0 text-sm text-muted-foreground"
                        />
                    </button>
                }
            />
            <DropdownMenuContent align="start" className="min-w-52">
                <DropdownMenuItem
                    disabled={!lead.project_id}
                    onClick={() => patchLead(lead, { project_id: null })}
                >
                    No project
                </DropdownMenuItem>
                {projects.map((project) => {
                    const selected = Number(lead.project_id) === Number(project.id);

                    return (
                        <DropdownMenuItem
                            key={project.id}
                            disabled={selected}
                            onClick={() =>
                                patchLead(lead, { project_id: Number(project.id) })
                            }
                        >
                            {project.thumbnail ? (
                                <img
                                    src={project.thumbnail}
                                    alt=""
                                    className="size-6 shrink-0 rounded-md object-cover"
                                />
                            ) : (
                                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted">
                                    <Icon name="community-line" className="text-sm" />
                                </span>
                            )}
                            <span className="truncate">{project.title}</span>
                            {selected ? (
                                <Icon name="check-line" className="ml-auto text-sm" />
                            ) : null}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function DetailField({ label, children }) {
    return (
        <div className="space-y-1">
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
            </div>
            <div className="text-sm text-foreground">{children}</div>
        </div>
    );
}

function UpdateComposer({ leadId }) {
    const [expanded, setExpanded] = useState(false);
    const [activityType, setActivityType] = useState(ACTIVITY_TYPES[0]);
    const [notes, setNotes] = useState("");
    const [nextActionType, setNextActionType] = useState(NEXT_ACTION_TYPES[0]);
    const [nextAt, setNextAt] = useState(() => new Date());

    const reset = () => {
        setExpanded(false);
        setActivityType(ACTIVITY_TYPES[0]);
        setNotes("");
        setNextActionType(NEXT_ACTION_TYPES[0]);
        setNextAt(new Date());
    };

    useEffect(() => {
        reset();
    }, [leadId]);

    if (!expanded) {
        return (
            <div className="shrink-0 border-t border-border bg-gradient-to-t from-primary/[0.08] to-transparent px-4 py-4">
                <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className={cn(
                        "group flex w-full items-center gap-3 rounded-xl border border-primary/35 bg-primary/10 px-4 py-3.5 text-left shadow-[0_10px_30px_-18px_rgba(56,71,208,0.55)]",
                        "transition-all duration-200 hover:border-primary/55 hover:bg-primary/15 hover:shadow-[0_14px_36px_-16px_rgba(56,71,208,0.65)]",
                        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    )}
                >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform duration-200 group-hover:scale-105">
                        <Icon name="add-line" className="text-xl" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold tracking-tight text-foreground">
                            Log an update
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-muted-foreground group-hover:text-foreground/80">
                            {UPDATE_PLACEHOLDER}
                        </span>
                    </span>
                    <span className="hidden shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground sm:inline-flex">
                        Record
                        <Icon
                            name="arrow-right-s-line"
                            className="text-sm transition-transform duration-200 group-hover:translate-x-0.5"
                        />
                    </span>
                </button>
            </div>
        );
    }

    return (
        <div className="shrink-0 space-y-3 border-t border-primary/25 bg-primary/[0.04] px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">What&apos;s Done</span>
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2.5 py-1 font-medium transition-colors hover:bg-muted/70"
                                >
                                    {activityType}
                                    <Icon
                                        name="arrow-down-s-line"
                                        className="text-sm text-muted-foreground"
                                    />
                                </button>
                            }
                        />
                        <DropdownMenuContent align="start" className="w-auto min-w-40">
                            {ACTIVITY_TYPES.map((type) => (
                                <DropdownMenuItem
                                    key={type}
                                    disabled={activityType === type}
                                    className="whitespace-nowrap"
                                    onClick={() => setActivityType(type)}
                                >
                                    {type}
                                    {activityType === type ? (
                                        <Icon
                                            name="check-line"
                                            className="ml-auto text-sm"
                                        />
                                    ) : null}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="flex items-center gap-1.5">
                    <IconButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        icon="attachment-2"
                        aria-label="Attach file"
                        onClick={() => toast.message("Attachments coming soon")}
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={reset}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        disabled={!notes.trim()}
                        onClick={() => {
                            toast.message("Lead updates coming soon");
                            reset();
                        }}
                    >
                        Submit
                    </Button>
                </div>
            </div>

            <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={UPDATE_PLACEHOLDER}
                rows={3}
                autoFocus
                className="min-h-20 resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
            />

            <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">What&apos;s Next?</span>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2.5 py-1 font-medium transition-colors hover:bg-muted/70"
                            >
                                {nextActionType}
                                <Icon
                                    name="arrow-down-s-line"
                                    className="text-sm text-muted-foreground"
                                />
                            </button>
                        }
                    />
                    <DropdownMenuContent align="start" className="w-auto min-w-40">
                        {NEXT_ACTION_TYPES.map((type) => (
                            <DropdownMenuItem
                                key={type}
                                disabled={nextActionType === type}
                                className="whitespace-nowrap"
                                onClick={() => setNextActionType(type)}
                            >
                                {type}
                                {nextActionType === type ? (
                                    <Icon
                                        name="check-line"
                                        className="ml-auto text-sm"
                                    />
                                ) : null}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {nextActionType !== "Do Nothing" ? (
                    <DateTimePicker
                        value={nextAt}
                        onChange={(value) => {
                            const next = toDayjs(value);
                            if (next) {
                                setNextAt(next.toDate());
                            }
                        }}
                        clearable={false}
                        side="top"
                        displayFormat="d MMM yyyy h:mm a"
                        className="w-auto"
                        triggerClassName="h-8 w-auto min-w-0 gap-2 border-border bg-muted/40 px-2.5 py-1 text-sm shadow-none dark:bg-muted/40 dark:hover:bg-muted/70"
                    />
                ) : null}
            </div>
        </div>
    );
}

export default function LeadDetailPanel({
    lead,
    stages = [],
    projects = [],
    assignees = [],
    onClose,
    onEdit,
}) {
    const [tab, setTab] = useState("tasks");

    const contactName = lead?.contact?.display_name || "—";
    const phone = lead?.contact?.phone_number;
    const email = lead?.contact?.email_address;
    const wa = useMemo(() => whatsappUrl(phone), [phone]);
    const call = useMemo(() => telUrl(phone), [phone]);
    const stageColor = lead?.stage?.color || "var(--primary)";
    const isArchived = Boolean(lead?.archived_at);

    const handleArchive = async () => {
        const confirmed = await confirm(
            "Move this lead to the archive? You can restore it later.",
            "Archive lead"
        );

        if (!confirmed) {
            return;
        }

        router.post(
            archiveLead.url(lead.id),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success("Lead archived");
                    onClose?.();
                },
                onError: () => toast.error("Could not archive lead"),
            }
        );
    };

    const handleRestore = () => {
        router.post(
            restoreLead.url(lead.id),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success("Lead restored to pipeline");
                    onClose?.();
                },
                onError: () => toast.error("Could not restore lead"),
            }
        );
    };

    const handleDelete = async () => {
        const confirmed = await confirm(
            "Permanently remove this archived lead? This cannot be undone from the archive.",
            "Delete lead"
        );

        if (!confirmed) {
            return;
        }

        router.delete(destroyLead.url(lead.id), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success("Lead deleted");
                onClose?.();
            },
            onError: (errors) =>
                toast.error(errors.lead || errors.message || "Could not delete lead"),
        });
    };

    if (!lead) {
        return null;
    }

    return (
        <div className="flex h-full min-h-0 flex-col bg-card">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
                <div className="flex min-w-0 items-center gap-2">
                    <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: stageColor }}
                        aria-hidden
                    />
                    <span className="truncate font-mono text-xs text-muted-foreground">
                        {lead.code}
                    </span>
                    {isArchived ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Archived
                        </span>
                    ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {!isArchived ? <StageMenu lead={lead} stages={stages} /> : null}
                    <IconButton
                        type="button"
                        size="sm"
                        className="rounded-full"
                        icon="close-line"
                        aria-label="Close lead details"
                        onClick={onClose}
                    />
                </div>
            </div>

            <div className="shrink-0 space-y-4 border-b border-border px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <h2 className="truncate text-2xl font-bold tracking-tight text-foreground">
                            {contactName}
                        </h2>
                        <HeatIcon tag={lead.tag} />
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                        {wa ? (
                            <a
                                href={wa}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex size-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 transition-colors hover:bg-emerald-500/25 dark:text-emerald-400"
                                aria-label="WhatsApp"
                                onClick={(event) => event.stopPropagation()}
                            >
                                <Icon name="whatsapp-line" className="text-lg" />
                            </a>
                        ) : null}
                        {call ? (
                            <a
                                href={call}
                                className="inline-flex size-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 transition-colors hover:bg-emerald-500/25 dark:text-emerald-400"
                                aria-label="Call"
                                onClick={(event) => event.stopPropagation()}
                            >
                                <Icon name="phone-line" className="text-lg" />
                            </a>
                        ) : null}
                    </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                    <AssigneeMenu lead={lead} assignees={assignees} />
                    <ProjectMenu lead={lead} projects={projects} />
                </div>
            </div>

            <div className="shrink-0 border-b border-border px-5 py-2">
                <div className="flex flex-wrap gap-1.5">
                    {TABS.filter((item) => !(isArchived && item.id === "close")).map((item) => {
                        const active = tab === item.id;

                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setTab(item.id)}
                                className={cn(
                                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                                    active
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                {item.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <ScrollArea className="min-h-0 flex-1">
                <div className="px-5 py-5">
                    {tab === "tasks" ? (
                        <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-4 text-center text-sm text-amber-600 dark:text-amber-400">
                            Nothing has been scheduled
                        </div>
                    ) : null}

                    {tab === "details" ? (
                        <div className="space-y-5">
                            <div className="flex flex-wrap justify-end gap-2">
                                {!isArchived ? (
                                    <>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onEdit?.(lead)}
                                        >
                                            <Icon name="pencil-line" className="text-base" />
                                            Edit lead
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleArchive}
                                        >
                                            <Icon name="archive-line" className="text-base" />
                                            Archive
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={handleRestore}
                                        >
                                            <Icon name="arrow-go-back-line" className="text-base" />
                                            Restore to pipeline
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="sm"
                                            onClick={handleDelete}
                                        >
                                            <Icon name="delete-bin-line" className="text-base" />
                                            Delete permanently
                                        </Button>
                                    </>
                                )}
                            </div>
                            <DetailField label="Phone">{phone || "—"}</DetailField>
                            <DetailField label="Email">{email || "—"}</DetailField>
                            <DetailField label="Source">{lead.source || "—"}</DetailField>
                            <DetailField label="Campaign">
                                {lead.campaign?.title || "—"}
                            </DetailField>
                            <DetailField label="Deal value">
                                {formatMoney(lead.budget)}
                            </DetailField>
                            <DetailField label="Next action">
                                {lead.next_action || "—"}
                            </DetailField>
                            <DetailField label="Last activity">
                                <span title={formatDateTime(lead.last_activity_at)}>
                                    {formatRelativeTime(lead.last_activity_at)}
                                </span>
                            </DetailField>
                            {isArchived ? (
                                <DetailField label="Archived">
                                    {formatDateTime(lead.archived_at)}
                                </DetailField>
                            ) : null}
                            <DetailField label="Created">
                                {formatDateTime(lead.created_at)}
                            </DetailField>
                            <DetailField label="Notes">{lead.notes || "—"}</DetailField>
                        </div>
                    ) : null}

                    {tab === "close" && !isArchived ? (
                        <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-muted/20 px-4 text-center">
                            <p className="text-sm text-muted-foreground">
                                Mark this lead as won or lost to close the deal.
                            </p>
                            <div className="flex flex-wrap justify-center gap-2">
                                <Button
                                    type="button"
                                    onClick={() => {
                                        const won = stages.find(
                                            (stage) => stage.label === "closed_won"
                                        );
                                        if (won) {
                                            patchLead(
                                                lead,
                                                { lead_stage_id: Number(won.id) },
                                                "Lead marked as won"
                                            );
                                        }
                                    }}
                                >
                                    Close as won
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        const lost = stages.find(
                                            (stage) => stage.label === "closed_lost"
                                        );
                                        if (lost) {
                                            patchLead(
                                                lead,
                                                { lead_stage_id: Number(lost.id) },
                                                "Lead marked as lost"
                                            );
                                        }
                                    }}
                                >
                                    Close as lost
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </ScrollArea>

            {tab === "tasks" ? <UpdateComposer leadId={lead.id} /> : null}
        </div>
    );
}

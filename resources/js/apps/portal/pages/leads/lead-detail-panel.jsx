import { useEffect, useMemo, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import {
    archive as archiveLead,
    destroy as destroyLead,
    restore as restoreLead,
} from "@/actions/App/Http/Controllers/Portal/LeadController";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ContactCardPopover } from "../../components/contact-card";
import { ActivityTimeline } from "./lead-activity-timeline";
import {
    AssigneeMenu,
    HeatMenu,
    ProjectMenu,
    StageMenu,
} from "./lead-assignment-menus";
import { LeadDetailsTab } from "./lead-detail-sections";
import { LeadShareButton, LeadSharedUsers } from "./lead-share-controls";
import { UpdateComposer } from "./lead-update-composer";
import CloseDealForm from "./close-deal-form";

const TABS = [
    { id: "tasks", label: "Tasks & Updates" },
    { id: "details", label: "Details" },
    { id: "close", label: "Close Deal" },
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

export default function LeadDetailPanel({
    lead,
    stages = [],
    projects = [],
    units = [],
    assignees = [],
    sources = [],
    campaigns = [],
    activityTypes = [],
    nextActionTypes = [],
    onClose,
    onEditContact,
    initialTab = "tasks",
    initialClosePath = null,
}) {
    const [tab, setTab] = useState(initialTab);
    const [closePath, setClosePath] = useState(initialClosePath);
    const bodyRef = useRef(null);

    useEffect(() => {
        setTab(initialTab || "tasks");
        setClosePath(initialClosePath);
    }, [lead?.id, initialTab, initialClosePath]);

    useEffect(() => {
        const viewport = bodyRef.current?.querySelector(
            '[data-slot="scroll-area-viewport"]',
        );

        if (!viewport) {
            return;
        }

        if (tab === "tasks") {
            return;
        }

        const frame = window.requestAnimationFrame(() => {
            viewport.scrollTop = 0;
        });

        return () => window.cancelAnimationFrame(frame);
    }, [tab, lead?.id]);

    const contactName = lead?.contact?.display_name || "—";
    const phone = lead?.contact?.phone_number;
    const wa = useMemo(() => whatsappUrl(phone), [phone]);
    const call = useMemo(() => telUrl(phone), [phone]);
    const stageColor = lead?.stage?.color || "var(--primary)";
    const isArchived = Boolean(lead?.archived_at);
    const dealLocked = Boolean(lead?.deal_locked || lead?.active_order);

    const openCloseDeal = (outcome) => {
        setClosePath(outcome || null);
        setTab("close");
    };

    const handleArchive = async () => {
        const confirmed = await confirm(
            "Move this lead to the archive? You can restore it later.",
            "Archive lead"
        );

        if (!confirmed) {
            return;
        }

        router.post(
            archiveLead.url(lead.code),
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
            restoreLead.url(lead.code),
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

        router.delete(destroyLead.url(lead.code), {
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
                    {lead.code ? (
                        <span className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            {lead.code}
                        </span>
                    ) : null}
                    {isArchived ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Archived
                        </span>
                    ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {!isArchived ? (
                        <StageMenu
                            lead={lead}
                            stages={stages}
                            locked={dealLocked}
                            onCloseDealRequest={openCloseDeal}
                        />
                    ) : null}
                    <IconButton
                        type="button"
                        size="sm"
                        className="rounded-full"
                        icon="close-line"
                        aria-label="Close lead details"
                        tooltip="Close"
                        onClick={onClose}
                    />
                </div>
            </div>

            {dealLocked && !isArchived ? (
                <div className="shrink-0 space-y-2 border-b border-amber-500/30 bg-amber-500/10 px-5 py-2.5 text-sm text-amber-950 dark:text-amber-100">
                    <p>
                        Deal closed — continue as the buyer’s liaison on the booking until
                        handover. Operations / Accounts handle verification and ledgers.
                    </p>
                    {lead.active_order?.code ? (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-amber-600/40 bg-background/70"
                            onClick={() =>
                                router.get(`/bookings?booking=${lead.active_order.code}`)
                            }
                        >
                            <Icon name="book-2-line" className="text-base" />
                            Open booking
                            {lead.active_order.liaison_active === false
                                ? " (history)"
                                : ""}
                        </Button>
                    ) : null}
                </div>
            ) : null}

            <div className="shrink-0 space-y-4 border-b border-border px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <h2 className="truncate text-2xl font-bold tracking-tight text-foreground">
                            {contactName}
                        </h2>
                        {lead.contact?.uuid ? (
                            <ContactCardPopover
                                contact={lead.contact}
                                onEdit={onEditContact}
                                editDisabled={isArchived || dealLocked}
                                className="size-7 shrink-0 justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground"
                            >
                                <Icon name="information-line" className="text-base" />
                            </ContactCardPopover>
                        ) : null}
                        <HeatMenu lead={lead} locked={dealLocked} />
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                        {wa ? (
                            <Tooltip>
                                <TooltipTrigger
                                    render={
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
                                    }
                                />
                                <TooltipContent>WhatsApp</TooltipContent>
                            </Tooltip>
                        ) : null}
                        {call ? (
                            <Tooltip>
                                <TooltipTrigger
                                    render={
                                        <a
                                            href={call}
                                            className="inline-flex size-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 transition-colors hover:bg-emerald-500/25 dark:text-emerald-400"
                                            aria-label="Call"
                                            onClick={(event) => event.stopPropagation()}
                                        >
                                            <Icon name="phone-line" className="text-lg" />
                                        </a>
                                    }
                                />
                                <TooltipContent>Call</TooltipContent>
                            </Tooltip>
                        ) : null}
                        <LeadShareButton
                            lead={lead}
                            assignees={assignees}
                            disabled={isArchived || dealLocked}
                        />
                    </div>
                </div>

                <div className="flex flex-wrap items-start gap-x-10 gap-y-2">
                    <AssigneeMenu lead={lead} assignees={assignees} locked={dealLocked} />
                    <ProjectMenu lead={lead} projects={projects} locked={dealLocked} />
                    <LeadSharedUsers lead={lead} />
                </div>
            </div>

            <div className="shrink-0 border-b border-border px-5 py-2">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap gap-2.5">
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
                                            ? "bg-muted text-foreground"
                                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                                    )}
                                >
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        {!isArchived ? (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={dealLocked}
                                onClick={handleArchive}
                            >
                                <Icon name="archive-line" className="text-base" />
                                Archive
                            </Button>
                        ) : (
                            <>
                                <Button type="button" size="sm" onClick={handleRestore}>
                                    <Icon name="arrow-go-back-line" className="text-base" />
                                    Restore
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleDelete}
                                >
                                    <Icon name="delete-bin-line" className="text-base" />
                                    Delete
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <ScrollArea ref={bodyRef} className="min-h-0 flex-1 bg-background">
                <div className="px-5 py-5">
                    {tab === "tasks" ? (
                        <ActivityTimeline
                            lead={lead}
                            active={tab === "tasks"}
                            actionTypes={[...activityTypes, ...nextActionTypes]}
                        />
                    ) : null}

                    {tab === "details" ? (
                        <LeadDetailsTab
                            lead={lead}
                            isArchived={isArchived}
                            dealLocked={dealLocked}
                            sources={sources}
                            campaigns={campaigns}
                        />
                    ) : null}

                    {tab === "close" && !isArchived ? (
                        <CloseDealForm
                            lead={lead}
                            projects={projects}
                            units={units}
                            initialPath={closePath}
                        />
                    ) : null}
                </div>
            </ScrollArea>

            {tab === "tasks" ? (
                <UpdateComposer
                    leadCode={lead.code}
                    activityTypes={activityTypes}
                    nextActionTypes={nextActionTypes}
                    locked={dealLocked}
                />
            ) : null}
        </div>
    );
}

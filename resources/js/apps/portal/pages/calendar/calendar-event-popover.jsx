import { Link } from "@inertiajs/react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
    PopoverDescription,
    PopoverHeader,
    PopoverTitle,
} from "@/components/ui/popover";
import { formatDateTime } from "@/lib/datetime";
import { eventTimeLabel } from "./calendar-helpers";

export function EventDetailPopover({ event, detail }) {
    const kind = detail?.kind || event?.subject?.type;
    const data = detail?.data;

    if (kind === "lead") {
        return (
            <>
                <PopoverHeader>
                    <PopoverTitle>{data?.contact?.display_name || event.title}</PopoverTitle>
                    <PopoverDescription>
                        {[data?.project?.title, data?.stage?.title].filter(Boolean).join(" · ") ||
                            event.subtitle}
                    </PopoverDescription>
                </PopoverHeader>
                <div className="space-y-2">
                    <DetailRow label="Next action" value={data?.next_action || event.subtitle} />
                    <DetailRow
                        label="Due"
                        value={formatDateTime(data?.due_date || event.when)}
                    />
                    <DetailRow
                        label="Assignee"
                        value={
                            data?.assignee?.display_name || event.assignee?.display_name
                        }
                    />
                    <DetailRow label="Project" value={data?.project?.title} />
                </div>
                <PopoverActions
                    href={event.href || `/leads?lead=${event.subject?.code}`}
                    label="Open lead"
                />
            </>
        );
    }

    if (kind === "order") {
        return (
            <>
                <PopoverHeader>
                    <PopoverTitle>
                        {data?.contact?.display_name || event.title}
                    </PopoverTitle>
                    <PopoverDescription>
                        {[data?.project?.title, data?.unit?.name].filter(Boolean).join(" · ") ||
                            event.subtitle ||
                            "Booking"}
                    </PopoverDescription>
                </PopoverHeader>
                <div className="space-y-2">
                    <DetailRow label="Status" value={data?.status || data?.stage} />
                    <DetailRow label="Project" value={data?.project?.title} />
                    <DetailRow label="Unit" value={data?.unit?.name} />
                    <DetailRow
                        label="Assignee"
                        value={
                            data?.assignee?.display_name || event.assignee?.display_name
                        }
                    />
                    <DetailRow label="Booked" value={formatDateTime(data?.booked_at)} />
                    <DetailRow label="When" value={eventTimeLabel(event)} />
                </div>
                <PopoverActions
                    href={data?.href || event.href || `/bookings/${event.subject?.code}`}
                    label="Open order"
                />
            </>
        );
    }

    if (kind === "campaign") {
        return (
            <>
                <PopoverHeader>
                    <PopoverTitle>{data?.title || event.title}</PopoverTitle>
                    <PopoverDescription>{data?.status || "Campaign"}</PopoverDescription>
                </PopoverHeader>
                <div className="space-y-2">
                    <DetailRow
                        label="Range"
                        value={`${formatDateTime(data?.starts_at || event.when, "MMM D, YYYY")} – ${formatDateTime(data?.ends_at || event.end, "MMM D, YYYY")}`}
                    />
                    <DetailRow
                        label="Owner"
                        value={data?.owner?.display_name || event.assignee?.display_name}
                    />
                    <DetailRow label="Project" value={data?.project?.title} />
                </div>
                <PopoverActions
                    href={
                        data?.href ||
                        event.href ||
                        `/campaigns/${data?.slug || event.subject?.code}`
                    }
                    label="Open campaign"
                />
            </>
        );
    }

    if (kind === "project") {
        return (
            <>
                <PopoverHeader>
                    <PopoverTitle>{data?.title || event.title}</PopoverTitle>
                    <PopoverDescription>
                        {data?.status || event.subtitle || "Project"}
                    </PopoverDescription>
                </PopoverHeader>
                <div className="space-y-2">
                    <DetailRow
                        label="Range"
                        value={`${formatDateTime(data?.start_date || event.when, "MMM D, YYYY")} – ${formatDateTime(data?.end_date || event.end, "MMM D, YYYY")}`}
                    />
                    <DetailRow
                        label="Progress"
                        value={data?.progress != null ? `${data.progress}%` : null}
                    />
                    {Array.isArray(data?.phases) && data.phases.length > 0 ? (
                        <div className="pt-1">
                            <p className="mb-1 text-xs font-medium text-muted-foreground">
                                Phases
                            </p>
                            <ul className="space-y-1">
                                {data.phases.slice(0, 4).map((phase) => (
                                    <li
                                        key={phase.id}
                                        className="flex justify-between gap-2 text-xs"
                                    >
                                        <span className="truncate">{phase.title}</span>
                                        <span className="shrink-0 text-muted-foreground">
                                            {phase.status}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                </div>
                <PopoverActions
                    href={data?.href || event.href || `/projects/${event.subject?.code}`}
                    label="Open project"
                />
            </>
        );
    }

    return (
        <>
            <PopoverHeader>
                <PopoverTitle>{event.title}</PopoverTitle>
                <PopoverDescription>{event.subtitle}</PopoverDescription>
            </PopoverHeader>
            <div className="space-y-2">
                <DetailRow label="When" value={eventTimeLabel(event)} />
                <DetailRow label="Assignee" value={event.assignee?.display_name} />
            </div>
            {event.href ? <PopoverActions href={event.href} label="Open" /> : null}
        </>
    );
}

function PopoverActions({ href, label }) {
    if (!href) {
        return null;
    }

    return (
        <div className="flex justify-end border-t border-border/70 pt-3">
            <Button size="sm" nativeButton={false} render={<Link href={href} />}>
                {label}
                <Icon name="arrow-right-line" className="text-base" />
            </Button>
        </div>
    );
}

function DetailRow({ label, value }) {
    if (value == null || value === "" || value === "—") {
        return null;
    }

    return (
        <div className="flex items-start justify-between gap-4 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right font-medium text-foreground">{value}</span>
        </div>
    );
}

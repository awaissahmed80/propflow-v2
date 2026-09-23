import { useEffect, useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import { index as calendarIndex } from "@/actions/App/Http/Controllers/Portal/CalendarController";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toSelectedList } from "@/components/ui/filter-menu";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime, toDayjs } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { isPagePending, PageSkeleton } from "../../components/page-skeleton";
import { EventDetailPopover } from "./calendar-event-popover";
import {
    MODULE_BAR,
    MODULE_DOT,
    MODULE_ICON,
    MODULE_SOFT,
    detailMatchesEvent,
    eventTimeLabel,
    pathFrom,
    toFilterParam,
} from "./calendar-helpers";
import { SidebarSection } from "./calendar-sidebar-section";

function CalendarPage({
    filters = {},
    formOptions = {},
    monthMarkers = {},
    dayEvents = [],
    openedLead = null,
    openedOrder = null,
    openedCampaign = null,
    openedProject = null,
}) {
    const { user } = useAuth();
    const pending = isPagePending(dayEvents);
    const [activeEventId, setActiveEventId] = useState(null);

    const selectedDate = useMemo(() => {
        const parsed = toDayjs(filters.date);

        return parsed ? parsed.toDate() : new Date();
    }, [filters.date]);

    const [month, setMonth] = useState(() => {
        const parsed = toDayjs(filters.month ? `${filters.month}-01` : filters.date);

        return parsed ? parsed.startOf("month").toDate() : new Date();
    });

    useEffect(() => {
        const parsed = toDayjs(filters.month ? `${filters.month}-01` : filters.date);

        if (parsed) {
            setMonth(parsed.startOf("month").toDate());
        }
    }, [filters.month, filters.date]);

    useEffect(() => {
        if (!openedLead && !openedOrder && !openedCampaign && !openedProject) {
            setActiveEventId(null);
        }
    }, [openedLead, openedOrder, openedCampaign, openedProject]);

    const appliedFilters = useMemo(
        () => ({
            assigned_to: toSelectedList(filters.assigned_to),
            team: toSelectedList(filters.team),
            type: toSelectedList(filters.type),
            overdue: filters.overdue ? ["1"] : [],
        }),
        [filters.assigned_to, filters.team, filters.type, filters.overdue],
    );

    const ownership = useMemo(() => {
        const ids = appliedFilters.assigned_to;
        const me = user?.id != null ? String(user.id) : null;

        if (me && ids.length === 1 && ids[0] === me) {
            return "mine";
        }

        if (ids.length === 0) {
            return "all";
        }

        return "custom";
    }, [appliedFilters.assigned_to, user?.id]);

    const visitCalendar = (next = {}) => {
        const dateValue = Object.prototype.hasOwnProperty.call(next, "date")
            ? next.date
            : filters.date;
        const monthValue = Object.prototype.hasOwnProperty.call(next, "month")
            ? next.month
            : filters.month;

        const assignedTo = Object.prototype.hasOwnProperty.call(next, "assigned_to")
            ? next.assigned_to
            : appliedFilters.assigned_to;
        const team = Object.prototype.hasOwnProperty.call(next, "team")
            ? next.team
            : appliedFilters.team;
        const type = Object.prototype.hasOwnProperty.call(next, "type")
            ? next.type
            : appliedFilters.type;
        const overdue = Object.prototype.hasOwnProperty.call(next, "overdue")
            ? next.overdue
            : appliedFilters.overdue;

        const params = {
            date: dateValue || "",
            month: monthValue || "",
            assigned_to: toFilterParam(assignedTo),
            team: toFilterParam(team),
            type: toFilterParam(type),
            overdue: toSelectedList(overdue).includes("1") ? "1" : "",
            lead: Object.prototype.hasOwnProperty.call(next, "lead") ? next.lead : "",
            order: Object.prototype.hasOwnProperty.call(next, "order") ? next.order : "",
            campaign: Object.prototype.hasOwnProperty.call(next, "campaign")
                ? next.campaign
                : "",
            project: Object.prototype.hasOwnProperty.call(next, "project")
                ? next.project
                : "",
        };

        Object.keys(params).forEach((key) => {
            if (key === "assigned_to") {
                return;
            }

            if (!params[key]) {
                delete params[key];
            }
        });

        params.assigned_to = toFilterParam(assignedTo);

        router.get(pathFrom(calendarIndex.url()), params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: [
                "filters",
                "formOptions",
                "monthMarkers",
                "dayEvents",
                "openedLead",
                "openedOrder",
                "openedCampaign",
                "openedProject",
            ],
        });
    };

    const patchFilters = (patch) => {
        setActiveEventId(null);
        visitCalendar({
            assigned_to: Object.prototype.hasOwnProperty.call(patch, "assigned_to")
                ? patch.assigned_to
                : appliedFilters.assigned_to,
            team: Object.prototype.hasOwnProperty.call(patch, "team")
                ? patch.team
                : appliedFilters.team,
            type: Object.prototype.hasOwnProperty.call(patch, "type")
                ? patch.type
                : appliedFilters.type,
            overdue: Object.prototype.hasOwnProperty.call(patch, "overdue")
                ? patch.overdue
                : appliedFilters.overdue,
            lead: null,
            order: null,
            campaign: null,
            project: null,
        });
    };

    const handleSelectDate = (date) => {
        if (!date) {
            return;
        }

        const next = dayjs(date);
        setActiveEventId(null);

        visitCalendar({
            date: next.format("YYYY-MM-DD"),
            month: next.format("YYYY-MM"),
            lead: null,
            order: null,
            campaign: null,
            project: null,
        });
    };

    const handleMonthChange = (nextMonth) => {
        setMonth(nextMonth);
        const next = dayjs(nextMonth);
        setActiveEventId(null);

        visitCalendar({
            month: next.format("YYYY-MM"),
            lead: null,
            order: null,
            campaign: null,
            project: null,
        });
    };

    const shiftDay = (delta) => {
        const base = toDayjs(filters.date) || dayjs();
        const next = base.add(delta, "day");
        setActiveEventId(null);

        visitCalendar({
            date: next.format("YYYY-MM-DD"),
            month: next.format("YYYY-MM"),
            lead: null,
            order: null,
            campaign: null,
            project: null,
        });
    };

    const goToday = () => {
        const today = dayjs();
        setActiveEventId(null);

        visitCalendar({
            date: today.format("YYYY-MM-DD"),
            month: today.format("YYYY-MM"),
            lead: null,
            order: null,
            campaign: null,
            project: null,
        });
    };

    const openEvent = (event) => {
        const subject = event?.subject;

        if (!subject?.type || !subject?.code) {
            return;
        }

        setActiveEventId(event.id);

        visitCalendar({
            lead: subject.type === "lead" ? subject.code : null,
            order: subject.type === "order" ? subject.code : null,
            campaign: subject.type === "campaign" ? subject.code : null,
            project: subject.type === "project" ? subject.code : null,
        });
    };

    const clearDetail = () => {
        setActiveEventId(null);
        visitCalendar({
            lead: null,
            order: null,
            campaign: null,
            project: null,
        });
    };

    const toggleModule = (moduleId) => {
        const allIds = modules.map((module) => module.id);
        const current =
            appliedFilters.type.length === 0 ? allIds : [...appliedFilters.type];
        let next = current.includes(moduleId)
            ? current.filter((value) => value !== moduleId)
            : [...current, moduleId];

        if (next.length === 0) {
            next = [moduleId];
        }

        patchFilters({
            type: next.length === allIds.length ? [] : next,
        });
    };

    const setOwnership = (value) => {
        if (value === "mine" && user?.id != null) {
            patchFilters({ assigned_to: [String(user.id)] });

            return;
        }

        if (value === "all") {
            patchFilters({ assigned_to: [] });
        }
    };

    const markersFor = (date) => {
        const key = dayjs(date).format("YYYY-MM-DD");

        return Array.isArray(monthMarkers?.[key]) ? monthMarkers[key] : [];
    };

    const dayLabel = formatDateTime(filters.date, "dddd, MMM D, YYYY");
    const monthLabel = formatDateTime(filters.date, "MMMM YYYY");
    const modules = formOptions.modules || [];
    const activeTypes = appliedFilters.type;

    if (pending) {
        return <PageSkeleton title="Calendar" />;
    }

    return (
        <Layout>
            <Layout.Header metaTitle="Calendar" breadcrumbs={[{ label: "Calendar" }]} />

            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar className="flex-wrap gap-2">
                    <div className="mr-auto min-w-0 shrink-0">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Calendar
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            Schedule across leads, orders, payments, campaigns, and projects
                        </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <Button type="button" size="sm" onClick={goToday}>
                            Today
                        </Button>
                        <Button
                            type="button"
                            size="smicon"
                            variant="outline"
                            aria-label="Previous day"
                            onClick={() => shiftDay(-1)}
                        >
                            <Icon name="arrow-left-s-line" />
                        </Button>
                        <Button
                            type="button"
                            size="smicon"
                            variant="outline"
                            aria-label="Next day"
                            onClick={() => shiftDay(1)}
                        >
                            <Icon name="arrow-right-s-line" />
                        </Button>
                        <span className="px-2 text-sm font-medium text-foreground">
                            {monthLabel}
                        </span>
                    </div>
                </Layout.Toolbar>

                <ResizablePanelGroup
                    orientation="horizontal"
                    className="min-h-0 flex-1 border-t border-border/70"
                >
                    <ResizablePanel
                        defaultSize="28%"
                        minSize="20%"
                        maxSize="38%"
                        className="min-w-[17.5rem] max-w-[26rem] overflow-hidden bg-muted/20"
                    >
                        <ScrollArea className="h-full">
                            <div className="flex flex-col gap-5 p-4">
                                <div className="w-full rounded-xl border border-border/80 bg-background p-2 shadow-xs">
                                    <Calendar
                                        mode="single"
                                        selected={selectedDate}
                                        month={month}
                                        onMonthChange={handleMonthChange}
                                        onSelect={handleSelectDate}
                                        className="w-full [--cell-size:--spacing(9)]"
                                        classNames={{
                                            root: "w-full",
                                            months: "w-full",
                                            month: "w-full",
                                            table: "w-full",
                                            weekdays: "w-full",
                                            week: "w-full",
                                        }}
                                        components={{
                                            DayButton: ({ day, modifiers, ...props }) => {
                                                const colors = markersFor(day.date);

                                                return (
                                                    <CalendarDayButton
                                                        day={day}
                                                        modifiers={modifiers}
                                                        {...props}
                                                    >
                                                        <span className="text-sm leading-none">
                                                            {day.date.getDate()}
                                                        </span>
                                                        {colors.length > 0 ? (
                                                            <span className="mt-0.5 flex max-w-full flex-wrap justify-center gap-0.5">
                                                                {colors.slice(0, 4).map((color) => (
                                                                    <span
                                                                        key={color}
                                                                        className={cn(
                                                                            "size-1 rounded-full",
                                                                            MODULE_DOT[color] ||
                                                                                MODULE_DOT.slate,
                                                                        )}
                                                                    />
                                                                ))}
                                                            </span>
                                                        ) : (
                                                            <span className="mt-0.5 h-1" />
                                                        )}
                                                    </CalendarDayButton>
                                                );
                                            },
                                        }}
                                    />
                                </div>

                                <SidebarSection title="Modules">
                                    <ul className="space-y-1">
                                        {modules.map((module) => {
                                            const active =
                                                activeTypes.length === 0 ||
                                                activeTypes.includes(module.id);

                                            return (
                                                <li key={module.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleModule(module.id)}
                                                        className={cn(
                                                            "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                                                            active
                                                                ? "bg-background text-foreground shadow-xs ring-1 ring-border/70"
                                                                : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                                                        )}
                                                    >
                                                        <span
                                                            className={cn(
                                                                "flex size-7 items-center justify-center rounded-md text-white",
                                                                MODULE_BAR[module.color] ||
                                                                    MODULE_BAR.slate,
                                                            )}
                                                        >
                                                            <Icon
                                                                name={
                                                                    MODULE_ICON[module.id] ||
                                                                    "calendar-line"
                                                                }
                                                                className="text-sm"
                                                            />
                                                        </span>
                                                        <span className="flex-1 font-medium">
                                                            {module.label}
                                                        </span>
                                                        <span
                                                            className={cn(
                                                                "size-2 rounded-full",
                                                                MODULE_DOT[module.color] ||
                                                                    MODULE_DOT.slate,
                                                                !active && "opacity-30",
                                                            )}
                                                        />
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </SidebarSection>

                                <SidebarSection title="Ownership">
                                    <RadioGroup
                                        value={ownership === "custom" ? "mine" : ownership}
                                        onValueChange={setOwnership}
                                        className="gap-2"
                                    >
                                        <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-background/70">
                                            <RadioGroupItem value="mine" />
                                            <span>My activities</span>
                                        </label>
                                        <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-background/70">
                                            <RadioGroupItem value="all" />
                                            <span>Everyone</span>
                                        </label>
                                    </RadioGroup>
                                    {ownership === "custom" ? (
                                        <p className="mt-1 px-2 text-xs text-muted-foreground">
                                            Custom assignee filter is active.
                                        </p>
                                    ) : null}
                                </SidebarSection>

                                <SidebarSection title="Status">
                                    <Checkbox
                                        checked={appliedFilters.overdue.includes("1")}
                                        onCheckedChange={(checked) =>
                                            patchFilters({
                                                overdue: checked ? ["1"] : [],
                                            })
                                        }
                                    >
                                        <span className="text-sm">Overdue only</span>
                                    </Checkbox>
                                </SidebarSection>

                                {(formOptions.teams || []).length > 0 ? (
                                    <SidebarSection title="Teams">
                                        <ul className="space-y-1">
                                            {(formOptions.teams || []).map((team) => {
                                                const active = appliedFilters.team.includes(
                                                    team.code,
                                                );

                                                return (
                                                    <li key={team.code}>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const next = active
                                                                    ? appliedFilters.team.filter(
                                                                          (code) =>
                                                                              code !== team.code,
                                                                      )
                                                                    : [
                                                                          ...appliedFilters.team,
                                                                          team.code,
                                                                      ];

                                                                patchFilters({ team: next });
                                                            }}
                                                            className={cn(
                                                                "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                                                                active
                                                                    ? "bg-background font-medium text-foreground shadow-xs ring-1 ring-border/70"
                                                                    : "text-muted-foreground hover:bg-background/70",
                                                            )}
                                                        >
                                                            <span
                                                                className="size-2.5 rounded-full"
                                                                style={{
                                                                    backgroundColor:
                                                                        team.color ||
                                                                        "var(--muted-foreground)",
                                                                }}
                                                            />
                                                            {team.title}
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </SidebarSection>
                                ) : null}
                            </div>
                        </ScrollArea>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    <ResizablePanel defaultSize="72%" minSize="45%" className="min-w-0 overflow-hidden bg-background">
                        <div className="flex h-full min-h-0 flex-col">
                            <div className="flex shrink-0 items-end justify-between gap-3 border-b border-border/70 px-5 py-3">
                                <div>
                                    <h2 className="text-base font-semibold tracking-tight text-foreground">
                                        {dayLabel}
                                    </h2>
                                    <p className="text-xs text-muted-foreground">
                                        {dayEvents.length === 0
                                            ? "No events on this day"
                                            : `${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}`}
                                    </p>
                                </div>
                            </div>

                            <ScrollArea className="min-h-0 flex-1">
                                <div className="px-5 py-4">
                                    {dayEvents.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-border bg-muted/15 px-4 py-20 text-center text-sm text-muted-foreground">
                                            Select another day or widen your filters.
                                        </div>
                                    ) : (
                                        <ol className="relative space-y-3">
                                            {dayEvents.map((event) => {
                                                const open = activeEventId === event.id;
                                                const detail = detailMatchesEvent(
                                                    event,
                                                    openedLead,
                                                    openedOrder,
                                                    openedCampaign,
                                                    openedProject,
                                                );
                                                const soft =
                                                    MODULE_SOFT[event.color] || MODULE_SOFT.slate;
                                                const bar =
                                                    MODULE_BAR[event.color] || MODULE_BAR.slate;

                                                return (
                                                    <li
                                                        key={event.id}
                                                        className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3"
                                                    >
                                                        <div className="pt-3 text-right text-xs font-medium tabular-nums text-muted-foreground">
                                                            {eventTimeLabel(event)}
                                                        </div>
                                                        <Popover
                                                            open={open}
                                                            onOpenChange={(next) => {
                                                                if (next) {
                                                                    openEvent(event);
                                                                } else {
                                                                    clearDetail();
                                                                }
                                                            }}
                                                        >
                                                            <PopoverTrigger
                                                                className={cn(
                                                                    "group relative w-full overflow-hidden rounded-xl border px-3 py-3 text-left shadow-xs transition-[box-shadow,transform] hover:-translate-y-px hover:shadow-sm",
                                                                    soft,
                                                                    open && "ring-2 ring-ring/40",
                                                                )}
                                                            >
                                                                <span
                                                                    className={cn(
                                                                        "absolute inset-y-0 left-0 w-1",
                                                                        bar,
                                                                    )}
                                                                />
                                                                <span className="flex items-start justify-between gap-3 pl-1.5">
                                                                    <span className="min-w-0">
                                                                        <span className="mb-1 inline-flex items-center gap-1.5 text-sm font-bold tracking-tight text-muted-foreground">
                                                                            <Icon
                                                                                name={
                                                                                    MODULE_ICON[
                                                                                        event
                                                                                            .module
                                                                                    ] ||
                                                                                    "calendar-line"
                                                                                }
                                                                                className="text-xs"
                                                                            />
                                                                            {event.module}
                                                                        </span>
                                                                        <span className="block truncate text-base font-bold tracking-tight text-foreground">
                                                                            {event.title}
                                                                        </span>
                                                                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                                                            {event.subtitle}
                                                                            {event.assignee
                                                                                ?.display_name
                                                                                ? ` · ${event.assignee.display_name}`
                                                                                : ""}
                                                                        </span>
                                                                    </span>
                                                                    {event.overdue ? (
                                                                        <span className="shrink-0 rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                                                                            Overdue
                                                                        </span>
                                                                    ) : null}
                                                                </span>
                                                            </PopoverTrigger>
                                                            <PopoverContent
                                                                side="left"
                                                                align="start"
                                                                sideOffset={10}
                                                                className="w-80 gap-3"
                                                            >
                                                                <EventDetailPopover
                                                                    event={event}
                                                                    detail={detail}
                                                                />
                                                            </PopoverContent>
                                                        </Popover>
                                                    </li>
                                                );
                                            })}
                                        </ol>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </Layout.Content>
        </Layout>
    );
}

CalendarPage.layout = (page) => <PortalLayout children={page} />;

export default CalendarPage;

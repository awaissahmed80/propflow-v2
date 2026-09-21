import { useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import { format, isValid, parse } from "date-fns";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";
import { Icon } from "@/components/ui/icon";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";

const PERIOD_PRESETS = [
    { value: "today", label: "Today" },
    { value: "week", label: "This week" },
    { value: "month", label: "This month" },
];

const DAY_WINDOW = 15;

function formatCount(value) {
    return new Intl.NumberFormat(undefined).format(Number(value) || 0);
}

function formatCompactMoney(value) {
    return formatMoney(value, { compact: true, maximumFractionDigits: 1 });
}

function parseDateString(value) {
    if (!value) {
        return undefined;
    }

    const parsed = parse(String(value).slice(0, 10), "yyyy-MM-dd", new Date());

    return isValid(parsed) ? parsed : undefined;
}

function formatDelta(value, { suffix = "%", invert = false } = {}) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return { text: "No prior period", positive: null };
    }

    const numeric = Number(value);
    const improved = invert ? numeric > 0 : numeric >= 0;
    const arrow = invert
        ? numeric > 0
            ? "↓"
            : numeric < 0
              ? "↑"
              : ""
        : numeric > 0
          ? "↑"
          : numeric < 0
            ? "↓"
            : "";
    const abs = Math.abs(numeric).toFixed(1).replace(/\.0$/, "");

    return {
        text: `${arrow} ${abs}${suffix}`.trim(),
        positive: numeric === 0 ? null : improved,
    };
}

function MetricCard({ label, value, delta, hint }) {
    const tone =
        delta.positive === true
            ? "text-emerald-600 dark:text-emerald-400"
            : delta.positive === false
              ? "text-rose-600 dark:text-rose-400"
              : "text-muted-foreground";

    return (
        <Card size="sm">
            <CardHeader className="border-b border-border/60">
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-2xl font-semibold tracking-tight tabular-nums">
                    {value}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className={cn("text-xs font-medium", tone)}>
                    {delta.text}
                    {hint ? (
                        <span className="font-normal text-muted-foreground"> {hint}</span>
                    ) : null}
                </p>
            </CardContent>
        </Card>
    );
}

function PeriodPicker({ period, periodLabel, from, to }) {
    const [open, setOpen] = useState(false);
    const [showCustom, setShowCustom] = useState(period === "custom");
    const [range, setRange] = useState({
        from: parseDateString(from),
        to: parseDateString(to),
    });

    const applyPeriod = (nextPeriod, nextFrom = null, nextTo = null) => {
        const query =
            nextPeriod === "custom"
                ? { period: "custom", from: nextFrom, to: nextTo }
                : { period: nextPeriod };

        router.get("/sales", query, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
        setOpen(false);
        setShowCustom(nextPeriod === "custom");
    };

    const applyCustomRange = () => {
        if (!range?.from || !range?.to) {
            return;
        }

        applyPeriod(
            "custom",
            format(range.from, "yyyy-MM-dd"),
            format(range.to, "yyyy-MM-dd"),
        );
    };

    return (
        <Popover
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (nextOpen) {
                    setShowCustom(period === "custom");
                    setRange({
                        from: parseDateString(from),
                        to: parseDateString(to),
                    });
                }
            }}
        >
            <PopoverTrigger
                render={
                    <Button variant="outline" size="sm" className="gap-1.5">
                        <Icon name="calendar-line" />
                        <span className="max-w-56 truncate">{periodLabel}</span>
                        <Icon name="arrow-down-s-line" className="opacity-60" />
                    </Button>
                }
            />
            <PopoverContent align="end" className="w-auto p-0">
                <div className="flex flex-col sm:flex-row">
                    <div className="flex min-w-44 flex-col gap-0.5 border-b border-border p-2 sm:border-r sm:border-b-0">
                        {PERIOD_PRESETS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => applyPeriod(option.value)}
                                className={cn(
                                    "rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                                    period === option.value && !showCustom
                                        ? "bg-accent font-medium text-foreground"
                                        : "text-muted-foreground",
                                )}
                            >
                                {option.label}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => setShowCustom(true)}
                            className={cn(
                                "rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                                showCustom || period === "custom"
                                    ? "bg-accent font-medium text-foreground"
                                    : "text-muted-foreground",
                            )}
                        >
                            Custom dates
                        </button>
                    </div>

                    {showCustom ? (
                        <div className="p-2">
                            <Calendar
                                mode="range"
                                numberOfMonths={1}
                                selected={range}
                                onSelect={setRange}
                                disabled={{ after: new Date() }}
                                defaultMonth={range?.to || range?.from || new Date()}
                            />
                            <div className="flex items-center justify-between gap-2 border-t border-border px-2 pt-2">
                                <p className="text-xs text-muted-foreground">
                                    {range?.from && range?.to
                                        ? `${format(range.from, "MMM d, yyyy")} – ${format(range.to, "MMM d, yyyy")}`
                                        : "Select a start and end date"}
                                </p>
                                <Button
                                    size="sm"
                                    disabled={!range?.from || !range?.to}
                                    onClick={applyCustomRange}
                                >
                                    Apply
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export default function SalesOverview({
    title = "Sales Overview",
    breadcrumbs = [{ label: "Sales" }, { label: "Overview" }],
    period = "month",
    periodLabel = "This month",
    from = null,
    to = null,
    metrics = {},
    leadsByDay = [],
    channels = [],
    funnel = [],
    agents = [],
}) {
    const [dayOffset, setDayOffset] = useState(0);

    const dayWindow = useMemo(() => {
        const total = leadsByDay.length;
        if (total <= DAY_WINDOW) {
            return { rows: leadsByDay, start: 1, end: total, total };
        }

        const maxOffset = Math.max(0, total - DAY_WINDOW);
        const offset = Math.min(Math.max(0, dayOffset), maxOffset);
        const rows = leadsByDay.slice(offset, offset + DAY_WINDOW);

        return {
            rows,
            start: offset + 1,
            end: offset + rows.length,
            total,
            canPrev: offset > 0,
            canNext: offset < maxOffset,
            offset,
            maxOffset,
        };
    }, [leadsByDay, dayOffset]);

    const funnelMax = Math.max(...funnel.map((row) => row.count), 1);

    const chartConfig = {
        count: { label: "Leads", color: "var(--color-chart-1)" },
    };

    return (
        <Layout>
            <Layout.Header metaTitle={title} breadcrumbs={breadcrumbs} />
            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar className="justify-between">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            {title}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Pipeline health, conversion, and channel performance.
                        </p>
                    </div>
                    <div className="ms-auto">
                        <PeriodPicker
                            period={period}
                            periodLabel={periodLabel}
                            from={from}
                            to={to}
                        />
                    </div>
                </Layout.Toolbar>

                <ScrollArea className="min-h-0 flex-1 overflow-hidden">
                    <div className="space-y-4 px-6 py-6">
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <MetricCard
                                label="Total Leads"
                                value={formatCount(metrics.total_leads)}
                                delta={formatDelta(metrics.total_leads_delta)}
                                hint="vs last period"
                            />
                            <MetricCard
                                label="Conversion Rate"
                                value={`${Number(metrics.conversion_rate || 0).toFixed(1)}%`}
                                delta={formatDelta(metrics.conversion_rate_delta, {
                                    suffix: " pts",
                                })}
                            />
                            <MetricCard
                                label="Avg. Lead Velocity"
                                value={
                                    metrics.avg_velocity_days == null
                                        ? "—"
                                        : `${metrics.avg_velocity_days}d`
                                }
                                delta={formatDelta(metrics.avg_velocity_delta, {
                                    suffix: "d faster",
                                    invert: true,
                                })}
                            />
                            <MetricCard
                                label="Pipeline Value"
                                value={formatCompactMoney(metrics.pipeline_value)}
                                delta={formatDelta(metrics.pipeline_value_delta)}
                            />
                        </div>

                        <div className="grid gap-4 xl:grid-cols-5">
                            <Card size="sm" className="xl:col-span-3">
                                <CardHeader className="border-b border-border/60">
                                    <CardTitle>Leads by Day</CardTitle>
                                    <CardDescription>
                                        New leads created, {periodLabel.toLowerCase()}.
                                    </CardDescription>
                                    <CardAction>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <span className="tabular-nums">
                                                Showing {dayWindow.start}-{dayWindow.end} of{" "}
                                                {dayWindow.total}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="smicon"
                                                disabled={!dayWindow.canPrev}
                                                onClick={() =>
                                                    setDayOffset((value) =>
                                                        Math.max(0, value - DAY_WINDOW),
                                                    )
                                                }
                                            >
                                                <Icon name="arrow-left-s-line" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="smicon"
                                                disabled={!dayWindow.canNext}
                                                onClick={() =>
                                                    setDayOffset((value) =>
                                                        Math.min(
                                                            dayWindow.maxOffset ?? 0,
                                                            value + DAY_WINDOW,
                                                        ),
                                                    )
                                                }
                                            >
                                                <Icon name="arrow-right-s-line" />
                                            </Button>
                                        </div>
                                    </CardAction>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    {dayWindow.total === 0 ? (
                                        <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                                            No leads in this period
                                        </div>
                                    ) : (
                                        <ChartContainer
                                            config={chartConfig}
                                            className="aspect-auto h-56 w-full"
                                            initialDimension={{ width: 560, height: 224 }}
                                        >
                                            <BarChart
                                                data={dayWindow.rows}
                                                margin={{ left: 4, right: 4, top: 8, bottom: 0 }}
                                            >
                                                <CartesianGrid vertical={false} />
                                                <XAxis
                                                    dataKey="label"
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tickMargin={8}
                                                    tick={{ fontSize: 11 }}
                                                    interval={0}
                                                />
                                                <YAxis
                                                    allowDecimals={false}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    width={28}
                                                />
                                                <ChartTooltip
                                                    content={<ChartTooltipContent hideLabel />}
                                                />
                                                <Bar
                                                    dataKey="count"
                                                    fill="var(--color-chart-1)"
                                                    radius={[6, 6, 0, 0]}
                                                />
                                            </BarChart>
                                        </ChartContainer>
                                    )}
                                </CardContent>
                            </Card>

                            <Card size="sm" className="xl:col-span-2">
                                <CardHeader className="border-b border-border/60">
                                    <CardTitle>Channel Breakdown</CardTitle>
                                    <CardDescription>Share of leads by source.</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    {channels.length === 0 ? (
                                        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                                            No sources in this period
                                        </div>
                                    ) : (
                                        <ul className="space-y-3">
                                            {channels.map((channel) => (
                                                <li
                                                    key={channel.source}
                                                    className="flex items-center justify-between gap-3"
                                                >
                                                    <span className="flex min-w-0 items-center gap-2.5 text-sm text-foreground">
                                                        <span
                                                            className="size-2.5 shrink-0 rounded-full"
                                                            style={{ background: channel.color }}
                                                        />
                                                        <span className="truncate">
                                                            {channel.source}
                                                        </span>
                                                    </span>
                                                    <span className="shrink-0 tabular-nums text-sm font-medium text-muted-foreground">
                                                        {channel.percent}%
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-5">
                            <Card size="sm" className="xl:col-span-3">
                                <CardHeader className="border-b border-border/60">
                                    <CardTitle>Conversion Funnel</CardTitle>
                                    <CardDescription>
                                        Leads by stage, current pipeline.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3 pt-4">
                                    {funnel.length === 0 ? (
                                        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                                            No pipeline stages yet
                                        </div>
                                    ) : (
                                        funnel.map((stage) => {
                                            const width = Math.max(
                                                8,
                                                Math.round((stage.count / funnelMax) * 100),
                                            );

                                            return (
                                                <div
                                                    key={stage.label}
                                                    className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-3"
                                                >
                                                    <span className="truncate text-sm text-muted-foreground">
                                                        {stage.title}
                                                    </span>
                                                    <div className="h-8 overflow-hidden rounded-md bg-muted/50">
                                                        <div
                                                            className="flex h-full items-center rounded-md px-2.5 text-xs font-medium text-white transition-[width]"
                                                            style={{
                                                                width: `${width}%`,
                                                                background: stage.is_won
                                                                    ? "var(--color-emerald-600, #059669)"
                                                                    : stage.color ||
                                                                      "var(--color-chart-1)",
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-right text-sm tabular-nums font-medium text-foreground">
                                                        {formatCount(stage.count)}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    )}
                                </CardContent>
                            </Card>

                            <Card size="sm" className="xl:col-span-2">
                                <CardHeader className="border-b border-border/60">
                                    <CardTitle>Agent Performance</CardTitle>
                                    <CardDescription>Top reps this period.</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-2">
                                    {agents.length === 0 ? (
                                        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                                            No assigned leads this period
                                        </div>
                                    ) : (
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-border/60 text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                                                    <th className="py-2 pr-2 font-medium">Rep</th>
                                                    <th className="py-2 px-2 text-right font-medium">
                                                        Leads
                                                    </th>
                                                    <th className="py-2 pl-2 text-right font-medium">
                                                        Won
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {agents.map((agent) => (
                                                    <tr
                                                        key={agent.id}
                                                        className="border-b border-border/40 last:border-0"
                                                    >
                                                        <td className="py-2.5 pr-2">
                                                            <div className="flex items-center gap-2.5">
                                                                <Avatar
                                                                    name={agent.display_name}
                                                                    src={agent.avatar}
                                                                    size="sm"
                                                                    className="size-8"
                                                                />
                                                                <span className="truncate font-medium text-foreground">
                                                                    {agent.display_name}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                                                            {formatCount(agent.leads)}
                                                        </td>
                                                        <td className="py-2.5 pl-2 text-right tabular-nums font-medium text-foreground">
                                                            {formatCount(agent.won)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </ScrollArea>
            </Layout.Content>
        </Layout>
    );
}

SalesOverview.layout = (page) => <PortalLayout children={page} />;

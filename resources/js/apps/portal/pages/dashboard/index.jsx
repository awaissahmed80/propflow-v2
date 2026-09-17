import { useMemo } from "react";
import { Link } from "@inertiajs/react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    XAxis,
    YAxis,
} from "recharts";
import { index as inventoryIndex } from "@/routes/portal/inventory";
import { index as leadsIndex } from "@/routes/portal/leads";
import { index as projectsIndex } from "@/routes/portal/projects";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { HeatIcon } from "@/components/ui/heat-icon";
import { Icon } from "@/components/ui/icon";
import {
    Progress,
    ProgressLabel,
    ProgressValue,
} from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDateTime } from "@/lib/datetime";
import { formatMoney } from "@/lib/currency";
import { HEAT_LABELS } from "@/lib/heat";
import { cn } from "@/lib/utils";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";

const STATUS_LABELS = {
    AVAILABLE: "Available",
    RESERVED: "Reserved",
    TOKEN: "Token",
    HOLD: "On Hold",
    SOLD: "Sold",
    INACTIVE: "Inactive",
};

const STATUS_COLORS = {
    AVAILABLE: "var(--color-chart-1)",
    RESERVED: "var(--color-chart-4)",
    TOKEN: "var(--color-chart-2)",
    HOLD: "var(--color-chart-3)",
    SOLD: "var(--color-primary)",
    INACTIVE: "var(--color-muted-foreground)",
};

function formatCompactMoney(value) {
    return formatMoney(value, { compact: true, maximumFractionDigits: 1 });
}

function formatCount(value) {
    return new Intl.NumberFormat(undefined).format(Number(value) || 0);
}

function titleCase(value) {
    return String(value || "")
        .replace(/[_-]+/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isOverdue(dueDate) {
    if (!dueDate) {
        return false;
    }

    return new Date(dueDate).getTime() < new Date().setHours(0, 0, 0, 0);
}

function StatCard({ label, value, hint, icon, href, tone = "default" }) {
    const tones = {
        default: "bg-primary/10 text-primary",
        hot: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
        success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
        muted: "bg-muted text-muted-foreground",
    };

    const content = (
        <Card size="sm" className="transition-colors hover:bg-muted/20">
            <CardHeader className="border-b border-border/60">
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-2xl font-semibold tracking-tight tabular-nums">
                    {value}
                </CardTitle>
                <CardAction>
                    <div
                        className={cn(
                            "flex size-9 items-center justify-center rounded-lg",
                            tones[tone] || tones.default
                        )}
                    >
                        <Icon name={icon} className="text-lg" />
                    </div>
                </CardAction>
            </CardHeader>
            {hint ? (
                <CardContent>
                    <p className="text-xs text-muted-foreground">{hint}</p>
                </CardContent>
            ) : null}
        </Card>
    );

    if (!href) {
        return content;
    }

    return (
        <Link href={href} className="block outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {content}
        </Link>
    );
}

function LeadMiniRow({ lead }) {
    const name = lead.contact?.display_name || lead.code || "Lead";
    const overdue = isOverdue(lead.due_date);

    return (
        <div className="flex items-center gap-3 py-2.5">
            <Avatar name={name} size="sm" className="size-8" />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-foreground">{name}</p>
                    <HeatIcon tag={lead.tag} />
                </div>
                <p className="truncate text-xs text-muted-foreground">
                    {lead.stage?.title || lead.stage?.label || "No stage"}
                    {lead.project?.title ? ` · ${lead.project.title}` : ""}
                </p>
            </div>
            <div className="shrink-0 text-right">
                {lead.due_date ? (
                    <p
                        className={cn(
                            "text-xs tabular-nums",
                            overdue ? "font-medium text-destructive" : "text-muted-foreground"
                        )}
                    >
                        {formatDateTime(lead.due_date)}
                    </p>
                ) : (
                    <p className="text-xs text-muted-foreground">
                        {lead.next_action || "—"}
                    </p>
                )}
            </div>
        </div>
    );
}

function Dashboard({
    stats = {},
    pipeline = [],
    heat = [],
    inventory = [],
    leadSources = [],
    projects = [],
    dueSoon = [],
    recentLeads = [],
}) {
    const pipelineChartData = useMemo(
        () =>
            pipeline.map((row) => ({
                stage: row.title,
                count: row.count,
                fill: row.color || "var(--color-primary)",
            })),
        [pipeline]
    );

    const inventoryChartData = useMemo(
        () =>
            inventory
                .filter((row) => row.count > 0)
                .map((row) => ({
                    status: STATUS_LABELS[row.status] || titleCase(row.status),
                    count: row.count,
                    key: row.status,
                    fill: STATUS_COLORS[row.status] || "var(--color-muted-foreground)",
                })),
        [inventory]
    );

    const sourceChartData = useMemo(
        () =>
            leadSources.map((row) => ({
                source: row.source,
                count: row.count,
            })),
        [leadSources]
    );

    const heatMax = Math.max(...heat.map((row) => row.count), 1);
    const pipelineTotal = pipeline.reduce((sum, row) => sum + row.count, 0);
    const inventoryTotal = inventory.reduce((sum, row) => sum + row.count, 0);

    const pipelineConfig = {
        count: { label: "Leads", color: "var(--color-primary)" },
    };

    const sourceConfig = {
        count: { label: "Leads", color: "var(--color-chart-4)" },
    };

    const inventoryConfig = Object.fromEntries(
        inventory.map((row) => [
            row.status,
            {
                label: STATUS_LABELS[row.status] || titleCase(row.status),
                color: STATUS_COLORS[row.status] || "var(--color-muted-foreground)",
            },
        ])
    );

    return (
        <Layout>
            <Layout.Header metaTitle="Dashboard" breadcrumbs={[]} />
            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar>
                    <div className="min-w-0">
                        <h1 className="shrink-0 text-xl font-bold tracking-tight text-foreground">
                            Dashboard
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Pipeline, inventory, and follow-ups at a glance.
                        </p>
                    </div>
                </Layout.Toolbar>

                <ScrollArea className="min-h-0 flex-1 overflow-hidden">
                    <div className="space-y-6 px-6 py-6">
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <StatCard
                                label="Open leads"
                                value={formatCount(stats.leads_total)}
                                hint={`+${formatCount(stats.leads_this_week)} this week`}
                                icon="user-star-line"
                                href={leadsIndex.url()}
                            />
                            <StatCard
                                label="Hot pipeline"
                                value={formatCount(stats.hot_leads)}
                                hint="Very hot + hot tags"
                                icon="fire-line"
                                tone="hot"
                                href={leadsIndex.url({ query: { tag: "HOT,VERY HOT" } })}
                            />
                            <StatCard
                                label="Available units"
                                value={formatCount(stats.available_units)}
                                hint={`${formatCount(stats.units_total)} total inventory`}
                                icon="shape-line"
                                tone="success"
                                href={inventoryIndex.url()}
                            />
                            <StatCard
                                label="Pipeline budget"
                                value={formatCompactMoney(stats.pipeline_budget)}
                                hint="Sum of open lead budgets"
                                icon="funds-line"
                                href={leadsIndex.url()}
                            />
                        </div>

                        <div className="grid gap-4 xl:grid-cols-5">
                            <Card size="sm" className="xl:col-span-3">
                                <CardHeader className="border-b border-border/60">
                                    <CardTitle>Lead pipeline</CardTitle>
                                    <CardDescription>
                                        {formatCount(pipelineTotal)} leads across stages
                                    </CardDescription>
                                    <CardAction>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            render={<Link href={leadsIndex.url()} />}
                                        >
                                            View all
                                        </Button>
                                    </CardAction>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    {pipelineTotal === 0 ? (
                                        <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                                            No leads in the pipeline yet
                                        </div>
                                    ) : (
                                        <ChartContainer
                                            config={pipelineConfig}
                                            className="aspect-auto h-56 w-full"
                                            initialDimension={{ width: 520, height: 224 }}
                                        >
                                            <BarChart
                                                data={pipelineChartData}
                                                margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
                                            >
                                                <CartesianGrid vertical={false} />
                                                <XAxis
                                                    dataKey="stage"
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tickMargin={8}
                                                    interval={0}
                                                    tick={{ fontSize: 11 }}
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
                                                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                                                    {pipelineChartData.map((entry) => (
                                                        <Cell
                                                            key={entry.stage}
                                                            fill={entry.fill}
                                                        />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ChartContainer>
                                    )}
                                </CardContent>
                            </Card>

                            <Card size="sm" className="xl:col-span-2">
                                <CardHeader className="border-b border-border/60">
                                    <CardTitle>Inventory mix</CardTitle>
                                    <CardDescription>
                                        {formatCount(inventoryTotal)} units by status
                                    </CardDescription>
                                    <CardAction>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            render={<Link href={inventoryIndex.url()} />}
                                        >
                                            Inventory
                                        </Button>
                                    </CardAction>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    {inventoryTotal === 0 ? (
                                        <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                                            No inventory units yet
                                        </div>
                                    ) : (
                                        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                                            <ChartContainer
                                                config={inventoryConfig}
                                                className="mx-auto aspect-square h-44 w-full max-w-[11rem]"
                                                initialDimension={{ width: 176, height: 176 }}
                                            >
                                                <PieChart>
                                                    <ChartTooltip
                                                        content={
                                                            <ChartTooltipContent nameKey="status" />
                                                        }
                                                    />
                                                    <Pie
                                                        data={inventoryChartData}
                                                        dataKey="count"
                                                        nameKey="status"
                                                        innerRadius={48}
                                                        outerRadius={72}
                                                        strokeWidth={2}
                                                    >
                                                        {inventoryChartData.map((entry) => (
                                                            <Cell
                                                                key={entry.key}
                                                                fill={entry.fill}
                                                            />
                                                        ))}
                                                    </Pie>
                                                </PieChart>
                                            </ChartContainer>
                                            <ul className="space-y-2">
                                                {inventory
                                                    .filter((row) => row.count > 0)
                                                    .map((row) => (
                                                        <li
                                                            key={row.status}
                                                            className="flex items-center justify-between gap-3 text-sm"
                                                        >
                                                            <span className="flex items-center gap-2 text-muted-foreground">
                                                                <span
                                                                    className="size-2.5 rounded-sm"
                                                                    style={{
                                                                        background:
                                                                            STATUS_COLORS[
                                                                                row.status
                                                                            ],
                                                                    }}
                                                                />
                                                                {STATUS_LABELS[row.status] ||
                                                                    titleCase(row.status)}
                                                            </span>
                                                            <span className="tabular-nums font-medium">
                                                                {formatCount(row.count)}
                                                            </span>
                                                        </li>
                                                    ))}
                                            </ul>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                            <Card size="sm">
                                <CardHeader className="border-b border-border/60">
                                    <CardTitle>Lead heat</CardTitle>
                                    <CardDescription>
                                        Interest intensity across the book
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3 pt-4">
                                    {heat.every((row) => row.count === 0) ? (
                                        <p className="py-8 text-center text-sm text-muted-foreground">
                                            No heat tags to show yet
                                        </p>
                                    ) : (
                                        heat.map((row) => (
                                            <div key={row.tag} className="space-y-1.5">
                                                <div className="flex items-center justify-between gap-2 text-sm">
                                                    <span className="flex items-center gap-1.5 font-medium">
                                                        <HeatIcon tag={row.tag} />
                                                        {HEAT_LABELS[row.tag] || row.tag}
                                                    </span>
                                                    <span className="tabular-nums text-muted-foreground">
                                                        {formatCount(row.count)}
                                                    </span>
                                                </div>
                                                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                                    <div
                                                        className="h-full rounded-full bg-primary/80 transition-all"
                                                        style={{
                                                            width: `${Math.max(
                                                                (row.count / heatMax) * 100,
                                                                row.count > 0 ? 4 : 0
                                                            )}%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>

                            <Card size="sm">
                                <CardHeader className="border-b border-border/60">
                                    <CardTitle>Lead sources</CardTitle>
                                    <CardDescription>Where enquiries come from</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    {sourceChartData.length === 0 ? (
                                        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                                            No source data yet
                                        </div>
                                    ) : (
                                        <ChartContainer
                                            config={sourceConfig}
                                            className="aspect-auto h-48 w-full"
                                            initialDimension={{ width: 360, height: 192 }}
                                        >
                                            <BarChart
                                                data={sourceChartData}
                                                layout="vertical"
                                                margin={{ left: 8, right: 12, top: 4, bottom: 4 }}
                                            >
                                                <CartesianGrid horizontal={false} />
                                                <XAxis type="number" hide />
                                                <YAxis
                                                    dataKey="source"
                                                    type="category"
                                                    tickLine={false}
                                                    axisLine={false}
                                                    width={88}
                                                    tick={{ fontSize: 11 }}
                                                />
                                                <ChartTooltip
                                                    content={<ChartTooltipContent hideLabel />}
                                                />
                                                <Bar
                                                    dataKey="count"
                                                    fill="var(--color-count)"
                                                    radius={[0, 6, 6, 0]}
                                                />
                                            </BarChart>
                                        </ChartContainer>
                                    )}
                                </CardContent>
                            </Card>

                            <Card size="sm">
                                <CardHeader className="border-b border-border/60">
                                    <CardTitle>Projects</CardTitle>
                                    <CardDescription>
                                        {formatCount(stats.active_projects)} active of{" "}
                                        {formatCount(stats.projects_total)}
                                    </CardDescription>
                                    <CardAction>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            render={<Link href={projectsIndex.url()} />}
                                        >
                                            All
                                        </Button>
                                    </CardAction>
                                </CardHeader>
                                <CardContent className="space-y-4 pt-4">
                                    {projects.length === 0 ? (
                                        <p className="py-8 text-center text-sm text-muted-foreground">
                                            No projects yet
                                        </p>
                                    ) : (
                                        projects.map((project) => (
                                            <div key={project.id} className="space-y-2">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-medium">
                                                            {project.title}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {project.code} ·{" "}
                                                            {formatCount(project.units_count)} units
                                                        </p>
                                                    </div>
                                                    <Badge variant="secondary" className="shrink-0">
                                                        {titleCase(project.status)}
                                                    </Badge>
                                                </div>
                                                <Progress value={project.progress}>
                                                    <ProgressLabel>Progress</ProgressLabel>
                                                    <ProgressValue />
                                                </Progress>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                            <Card size="sm">
                                <CardHeader className="border-b border-border/60">
                                    <CardTitle>Follow-ups</CardTitle>
                                    <CardDescription>
                                        {formatCount(stats.overdue)} overdue ·{" "}
                                        {formatCount(stats.due_soon)} due in 7 days
                                    </CardDescription>
                                    <CardAction>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            render={<Link href={leadsIndex.url()} />}
                                        >
                                            Open leads
                                        </Button>
                                    </CardAction>
                                </CardHeader>
                                <CardContent className="pt-2">
                                    {dueSoon.length === 0 ? (
                                        <p className="py-10 text-center text-sm text-muted-foreground">
                                            Nothing due soon — nice and clear.
                                        </p>
                                    ) : (
                                        <div className="divide-y divide-border">
                                            {dueSoon.map((lead) => (
                                                <LeadMiniRow key={lead.id} lead={lead} />
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card size="sm">
                                <CardHeader className="border-b border-border/60">
                                    <CardTitle>Recent leads</CardTitle>
                                    <CardDescription>Latest enquiries added</CardDescription>
                                    <CardAction>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            render={<Link href={leadsIndex.url()} />}
                                        >
                                            View all
                                        </Button>
                                    </CardAction>
                                </CardHeader>
                                <CardContent className="pt-2">
                                    {recentLeads.length === 0 ? (
                                        <p className="py-10 text-center text-sm text-muted-foreground">
                                            New leads will show up here.
                                        </p>
                                    ) : (
                                        <div className="divide-y divide-border">
                                            {recentLeads.map((lead) => (
                                                <LeadMiniRow key={lead.id} lead={lead} />
                                            ))}
                                        </div>
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

Dashboard.layout = (page) => <PortalLayout children={page} />;

export default Dashboard;

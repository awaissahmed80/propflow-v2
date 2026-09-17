import { Link } from "@inertiajs/react";
import { index as settingsIndex } from "@/routes/portal/settings";
import { Icon } from "@/components/ui/icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import ComingSoonPanel from "./coming-soon-panel";
import CampaignsPanel from "./campaigns-panel";
import GeneralPanel from "./general-panel";
import MetaDataPanel from "./meta-data-panel";
import PipelinePanel from "./pipeline-panel";

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

const PANEL_BY_SECTION = {
    general: GeneralPanel,
    "meta-data": MetaDataPanel,
    pipeline: PipelinePanel,
    campaigns: CampaignsPanel,
};

export default function SettingsIndex({
    section = "general",
    sections = [],
    general = {},
    configuration = {},
    pipelineRules = {},
    metaTypes = [],
    stages = [],
    campaignGoalTypes = [],
}) {
    const active = sections.find((item) => item.id === section) ?? sections[0];
    const Panel = PANEL_BY_SECTION[section] ?? ComingSoonPanel;

    return (
        <Layout>
            <Layout.Header
                metaTitle={active?.label ? `${active.label} · Settings` : "Settings"}
                breadcrumbs={[{ label: "Settings" }, { label: active?.label ?? "General" }]}
            />

            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar>
                    <h1 className="shrink-0 text-xl font-bold tracking-tight text-foreground">
                        Settings
                    </h1>
                </Layout.Toolbar>

                <div className="flex min-h-0 flex-1 overflow-hidden bg-muted/15">
                    <aside className="hidden w-60 shrink-0 border-r border-border/80 bg-background md:flex md:flex-col">
                        <ScrollArea className="min-h-0 flex-1">
                            <nav className="space-y-1 p-3">
                                {sections.map((item) => {
                                    const href = pathFrom(settingsIndex.url(item.id));
                                    const isActive = item.id === section;

                                    return (
                                        <Link
                                            key={item.id}
                                            href={href}
                                            preserveScroll
                                            className={cn(
                                                "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                                                isActive
                                                    ? "bg-primary/10 text-primary"
                                                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
                                                    isActive
                                                        ? "bg-primary/15 text-primary"
                                                        : "bg-muted text-muted-foreground group-hover:text-foreground"
                                                )}
                                            >
                                                <Icon
                                                    name={item.icon || "settings-3-line"}
                                                    className="text-base"
                                                />
                                            </span>
                                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                            {item.coming_soon ? (
                                                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                                    Soon
                                                </span>
                                            ) : null}
                                        </Link>
                                    );
                                })}
                            </nav>
                        </ScrollArea>
                    </aside>

                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                        <div className="border-b border-border/80 bg-background px-4 py-3 md:hidden">
                            <div className="flex gap-1.5 overflow-x-auto pb-1">
                                {sections.map((item) => {
                                    const href = pathFrom(settingsIndex.url(item.id));
                                    const isActive = item.id === section;

                                    return (
                                        <Link
                                            key={item.id}
                                            href={href}
                                            preserveScroll
                                            className={cn(
                                                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap",
                                                isActive
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-muted text-muted-foreground"
                                            )}
                                        >
                                            <Icon name={item.icon || "settings-3-line"} className="text-sm" />
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>

                        <ScrollArea className="min-h-0 flex-1">
                            <div className="w-full px-6 py-4 text-left">
                                {!["general", "meta-data", "pipeline", "campaigns"].includes(section) ? (
                                    <div className="mb-5 flex items-center gap-2.5">
                                        <span className="flex size-8 items-center justify-center rounded-md bg-background shadow-xs ring-1 ring-border/70">
                                            <Icon
                                                name={active?.icon || "settings-3-line"}
                                                className="text-base text-foreground"
                                            />
                                        </span>
                                        <h2 className="text-base font-semibold tracking-tight text-foreground">
                                            {active?.label ?? "Settings"}
                                        </h2>
                                    </div>
                                ) : null}

                                <Panel
                                    section={active}
                                    general={general}
                                    configuration={configuration}
                                    pipelineRules={pipelineRules}
                                    metaTypes={metaTypes}
                                    stages={stages}
                                    campaignGoalTypes={campaignGoalTypes}
                                />
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </Layout.Content>
        </Layout>
    );
}

SettingsIndex.layout = (page) => <PortalLayout children={page} />;

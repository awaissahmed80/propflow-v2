import { Icon } from "@/components/ui/icon";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";

export default function TodoListIndex({
    title = "Todo List",
    description = "Track personal and shared follow-ups across sales and operations.",
    breadcrumbs = [{ label: "Todo List" }],
}) {
    return (
        <Layout>
            <Layout.Header metaTitle={title} breadcrumbs={breadcrumbs} />
            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
                        <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{description}</p>
                    </div>
                </Layout.Toolbar>
                <div className="min-h-0 flex-1 overflow-auto px-6 py-6">
                    <div className="rounded-xl border border-border/80 bg-card/40 px-5 py-8 shadow-xs">
                        <div className="flex items-start gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                <Icon name="checkbox-line" className="text-lg" />
                            </span>
                            <div>
                                <p className="text-sm font-medium text-foreground">
                                    This workspace is coming soon
                                </p>
                                <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                                    Navigation is live so your team can land here. Task workflows will
                                    follow.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </Layout.Content>
        </Layout>
    );
}

TodoListIndex.layout = (page) => <PortalLayout children={page} />;

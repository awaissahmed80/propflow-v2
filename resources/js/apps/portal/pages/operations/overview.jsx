import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";

export default function OperationsOverview({
    title = "Operations Overview",
    breadcrumbs = [{ label: "Operations" }, { label: "Overview" }],
}) {
    return (
        <Layout>
            <Layout.Header metaTitle={title} breadcrumbs={breadcrumbs} />
            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
                    </div>
                </Layout.Toolbar>
                <div className="min-h-0 flex-1 overflow-auto px-6 py-6" />
            </Layout.Content>
        </Layout>
    );
}

OperationsOverview.layout = (page) => <PortalLayout children={page} />;

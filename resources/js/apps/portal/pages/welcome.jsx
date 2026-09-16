import PortalLayout from "../layouts/portal.layout";
import { Layout } from "../components/layout";

function Dashboard() {
    return (
        <Layout>
            <Layout.Header metaTitle="Dashboard" breadcrumbs={[]} />
            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar>
                    <h1 className="shrink-0 text-xl font-bold tracking-tight text-foreground">
                        Dashboard
                    </h1>
                </Layout.Toolbar>
                <div className="px-6 py-6 text-sm text-muted-foreground">
                    Welcome to Propflow Portal
                </div>
            </Layout.Content>
        </Layout>
    );
}

Dashboard.layout = (page) => <PortalLayout children={page} />;

export default Dashboard;

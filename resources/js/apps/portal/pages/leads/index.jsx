import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";

function Leads() {
    return (
        <Layout>
            <Layout.Header metaTitle="Leads" breadcrumbs={[{ label: "Leads" }]} />
            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar>
                    <h1 className="shrink-0 text-xl font-bold tracking-tight text-foreground">
                        Leads
                    </h1>
                </Layout.Toolbar>
                <div className="px-6 py-6 text-sm text-muted-foreground">
                    Welcome to the Leads page.
                </div>
            </Layout.Content>
        </Layout>
    );
}

Leads.layout = (page) => <PortalLayout children={page} />;

export default Leads;

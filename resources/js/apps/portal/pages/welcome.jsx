import PortalLayout from "../layouts/portal.layout";
import { Layout } from "../components/layout";


function Dashboard() {
    return(
        <Layout>
            <Layout.Header metaTitle="Dashboard" breadcrumbs={[]} />
            <div>Welcome To Propflow Portal</div>
        </Layout>
    )
}


Dashboard.layout = (page) => <PortalLayout children={page} />;

export default Dashboard
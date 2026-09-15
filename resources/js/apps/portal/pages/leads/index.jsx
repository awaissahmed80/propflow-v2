import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";


function Leads () {
    return(
        <Layout>
            <Layout.Header metaTitle="Leads" breadcrumbs={[{label: 'Leads'}]} />
            <div>Welcome To Leads Page</div>
        </Layout>
    )
}

Leads.layout = (page) => <PortalLayout children={page} />;

export default Leads
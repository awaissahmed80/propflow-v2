import { Icon } from "@/components/ui/icon";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import {
    COMMISSIONS_SUBNAV,
    OperationsSubnav,
    RECEIVABLES_SUBNAV,
} from "../../components/operations-subnav";

const SUBNAV_BY_SECTION = {
    vouchers: RECEIVABLES_SUBNAV,
    verification: RECEIVABLES_SUBNAV,
    statements: RECEIVABLES_SUBNAV,
    agents: COMMISSIONS_SUBNAV,
    dealers: COMMISSIONS_SUBNAV,
};

export default function OperationsComingSoon({
    section = "vouchers",
    title = "Coming Soon",
    description = "This Operations workspace is scaffolded and ready for a follow-up build.",
    icon = "tools-line",
    breadcrumbs = [{ label: "Operations" }, { label: "Coming Soon" }],
}) {
    const subnav = SUBNAV_BY_SECTION[section] ?? null;

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
                {subnav ? <OperationsSubnav items={subnav} /> : null}
                <div className="min-h-0 flex-1 overflow-auto px-6 py-6">
                    <div className="rounded-xl border border-border/80 bg-card/40 px-5 py-8 shadow-xs">
                        <div className="flex items-start gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                <Icon name={icon} className="text-lg" />
                            </span>
                            <div>
                                <p className="text-sm font-medium text-foreground">
                                    This workspace is coming soon
                                </p>
                                <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                                    Navigation is live so your team can land here. The full workflow will
                                    follow the same patterns as Bookings and the Installment Engine.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </Layout.Content>
        </Layout>
    );
}

OperationsComingSoon.layout = (page) => <PortalLayout children={page} />;

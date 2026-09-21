import { useEffect, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { index, show } from "@/routes/portal/campaigns";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { isPagePending, PageSkeleton } from "../../components/page-skeleton";
import { Button } from "@/components/ui/button";
import { FilterInput } from "@/components/ui/filter-input";
import { Icon } from "@/components/ui/icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import CampaignForm from "./campaign-form";

const emptyPagination = {
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
    from: null,
    to: null,
};

function statusTone(status) {
    if (status === "active") {
        return "bg-emerald-500/10 text-emerald-700";
    }

    if (status === "archived") {
        return "bg-muted text-muted-foreground";
    }

    return "bg-amber-500/10 text-amber-800";
}

export default function CampaignsIndex({
    campaigns: campaignsProp,
    pagination = emptyPagination,
    filters = {},
    formOptions = {},
}) {
    const pending = isPagePending(campaignsProp);
    const campaigns = campaignsProp ?? [];
    const [search, setSearch] = useState(filters.q || "");
    const [createOpen, setCreateOpen] = useState(false);
    const searchTimeout = useRef(null);

    useEffect(() => {
        setSearch(filters.q || "");
    }, [filters.q]);

    useEffect(() => {
        return () => {
            if (searchTimeout.current) {
                clearTimeout(searchTimeout.current);
            }
        };
    }, []);

    const visit = (next = {}) => {
        const params = {
            q: Object.prototype.hasOwnProperty.call(next, "q") ? next.q : search,
        };

        Object.keys(params).forEach((key) => {
            if (!params[key]) {
                delete params[key];
            }
        });

        router.get(index.url(), params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ["campaigns", "pagination", "filters", "formOptions"],
        });
    };

    const handleSearchChange = (event) => {
        const value = event.target.value;
        setSearch(value);

        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }

        searchTimeout.current = setTimeout(() => {
            visit({ q: value.trim() });
        }, 300);
    };

    if (pending) {
        return <PageSkeleton title="Campaigns" variant="cards" />;
    }

    return (
        <Layout>
            <Layout.Header metaTitle="Campaigns" breadcrumbs={[{ label: "Campaigns" }]} />
            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar>
                    <div className="mr-2 shrink-0">
                        <h1 className="text-xl font-bold tracking-tight text-foreground">
                            Campaigns
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            Landing pages and lead capture forms
                        </p>
                    </div>
                    <FilterInput
                        value={search}
                        onChange={handleSearchChange}
                        placeholder="Search campaigns..."
                        className="w-56"
                    />
                    <div className="ml-auto">
                        <Button type="button" onClick={() => setCreateOpen(true)}>
                            <Icon name="add-line" className="text-base" />
                            New campaign
                        </Button>
                    </div>
                </Layout.Toolbar>

                <ScrollArea className="min-h-0 flex-1">
                    <div className="px-6 py-6">
                        {campaigns.length === 0 ? (
                            <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-6 text-center">
                                <h2 className="text-lg font-semibold tracking-tight">
                                    Create your first campaign
                                </h2>
                                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                                    Build a landing page around a project and embed the same lead
                                    form on your website.
                                </p>
                                <Button
                                    type="button"
                                    className="mt-5"
                                    onClick={() => setCreateOpen(true)}
                                >
                                    <Icon name="add-line" className="text-base" />
                                    New campaign
                                </Button>
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-lg border border-border bg-card">
                                <table className="w-full min-w-[720px] text-left text-sm">
                                    <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Campaign</th>
                                            <th className="px-4 py-3 font-medium">Project</th>
                                            <th className="px-4 py-3 font-medium">Form</th>
                                            <th className="px-4 py-3 font-medium">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {campaigns.map((campaign) => (
                                            <tr
                                                key={campaign.id}
                                                role="button"
                                                tabIndex={0}
                                                className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40"
                                                onClick={() =>
                                                    router.visit(show.url(campaign.slug))
                                                }
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter" || event.key === " ") {
                                                        event.preventDefault();
                                                        router.visit(show.url(campaign.slug));
                                                    }
                                                }}
                                            >
                                                <td className="px-4 py-3 font-medium text-foreground">
                                                    {campaign.title}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {campaign.project?.title || "—"}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {campaign.form?.name || "—"}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={cn(
                                                            "inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize",
                                                            statusTone(campaign.status)
                                                        )}
                                                    >
                                                        {campaign.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {pagination.total > 0 ? (
                            <p className="mt-4 text-sm text-muted-foreground">
                                Showing {pagination.from}–{pagination.to} of {pagination.total}
                            </p>
                        ) : null}
                    </div>
                </ScrollArea>
            </Layout.Content>

            <CampaignForm
                isOpen={createOpen}
                onClose={() => setCreateOpen(false)}
                formOptions={formOptions}
            />
        </Layout>
    );
}

CampaignsIndex.layout = (page) => <PortalLayout children={page} />;

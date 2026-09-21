import { useState } from "react";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { DocumentManager, MediaManager } from "@/components/media-manager";
import { Icon } from "@/components/ui/icon";
import {
    ToggleGroup,
    ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const TABS = [
    { value: "media", label: "Media", icon: "image-line" },
    { value: "documents", label: "Documents", icon: "file-text-line" },
];

function FileManager() {
    const [tab, setTab] = useState("media");

    return (
        <Layout>
            <Layout.Header
                metaTitle="Files & Media"
                breadcrumbs={[{ label: "Files & Media" }]}
            />

            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar>
                    <h1 className="shrink-0 text-2xl font-bold tracking-tight text-foreground">
                        Files & Media
                    </h1>

                    <ToggleGroup
                        className="ml-auto"
                        variant="outline"
                        spacing={0}
                        value={[tab]}
                        onValueChange={(next) => {
                            if (next?.[0]) {
                                setTab(next[0]);
                            }
                        }}
                        aria-label="Library type"
                    >
                        {TABS.map((item) => (
                            <ToggleGroupItem
                                key={item.value}
                                value={item.value}
                                className={cn(
                                    "gap-1.5 px-3 data-pressed:bg-muted data-pressed:text-foreground"
                                )}
                                aria-label={item.label}
                            >
                                <Icon name={item.icon} className="text-base" />
                                {item.label}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                </Layout.Toolbar>

                <div className="min-h-0 flex-1 px-6 py-4">
                    {tab === "media" ? (
                        <MediaManager embedded />
                    ) : (
                        <DocumentManager embedded />
                    )}
                </div>
            </Layout.Content>
        </Layout>
    );
}

FileManager.layout = (page) => <PortalLayout children={page} />;

export default FileManager;

import { useEffect, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { destroy, update } from "@/actions/App/Http/Controllers/Portal/ProjectController";
import { index as projectsIndex } from "@/routes/portal/projects";
import { index as inventoryIndex } from "@/routes/portal/inventory";
import { index as leadsIndex } from "@/routes/portal/leads";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { DocumentManager, MediaManager } from "@/components/media-manager";
import { FilePreview } from "@/components/file-preview";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import ProjectForm from "./project-form";
import ProgressForm from "./progress-form";
import FeatureForm from "./feature-form";
import DocumentLinkForm from "./document-link-form";
import {
    formatArea,
    projectCityCountry,
    projectLocation,
    statusTone,
    typeTone,
} from "./project-details-helpers";
import {
    EmptyPanel,
    SidebarSection,
    StatItem,
} from "./project-details-shared";
import { FeaturesList } from "./project-features-list";
import { InventoryPanel } from "./project-inventory-panel";
import { LocationMapPanel } from "./project-location-map-panel";
import { ProgressTimeline } from "./project-progress-timeline";
import { ProjectRecordPanel } from "./project-record-panel";

const STATUS_LABELS = {
    draft: "Draft",
    active: "Active",
    on_hold: "On hold",
    completed: "Completed",
    archived: "Archived",
};

function ProjectDetails({ project }) {
    const [editOpen, setEditOpen] = useState(false);
    const [progressFormOpen, setProgressFormOpen] = useState(false);
    const [editingPhase, setEditingPhase] = useState(null);
    const [featureFormOpen, setFeatureFormOpen] = useState(false);
    const [editingFeature, setEditingFeature] = useState(null);
    const [mediaManager, setMediaManager] = useState(null);
    const [documentManagerOpen, setDocumentManagerOpen] = useState(false);
    const [editingDocument, setEditingDocument] = useState(null);
    const [galleryPreviewIndex, setGalleryPreviewIndex] = useState(null);
    const [documentPreviewOpen, setDocumentPreviewOpen] = useState(false);
    const [documentPreviewIndex, setDocumentPreviewIndex] = useState(0);
    const [progressValue, setProgressValue] = useState([
        Number(project.progress) || 0,
    ]);
    const location = projectLocation(project);
    const cityCountry = projectCityCountry(project);
    const gallery = project.gallery ?? [];
    const documents = project.documents ?? [];
    const previewDocuments = documents.map((document) => ({
        id: document.id,
        name: document.title || document.name || "Document",
        url: document.url || document.src,
        thumbnail_url: document.thumbnail_url ?? null,
        type: document.type ?? null,
        kind: document.kind || "document",
        is_secure: Boolean(document.is_secure),
    }));
    const phases = project.phases ?? [];
    const features = project.features ?? [];
    const stats = project.stats ?? {};
    const inventoryUnits = project.inventory?.units ?? [];
    const progress = progressValue[0] ?? 0;
    const galleryIds = gallery.map((image) => image.id);
    const documentIds = documents.map((document) => document.id);
    const thumbnailIds = project.thumbnail_id ? [project.thumbnail_id] : [];

    const openDocumentPreview = (index) => {
        setDocumentPreviewIndex(index);
        setDocumentPreviewOpen(true);
    };

    useEffect(() => {
        setProgressValue([Number(project.progress) || 0]);
    }, [project.progress]);

    const reloadProject = () => {
        router.reload({ only: ["project"], preserveScroll: true });
    };

    const openProgressForm = (phase = null) => {
        setEditingPhase(phase);
        setProgressFormOpen(true);
    };

    const closeProgressForm = () => {
        setProgressFormOpen(false);
        setEditingPhase(null);
    };

    const openFeatureForm = (feature = null) => {
        setEditingFeature(feature);
        setFeatureFormOpen(true);
    };

    const closeFeatureForm = () => {
        setFeatureFormOpen(false);
        setEditingFeature(null);
    };

    const saveProject = (patch, callbacks = {}) => {
        router.patch(update.url(project.code), patch, {
            preserveScroll: true,
            preserveState: true,
            only: ["project"],
            onSuccess: () => {
                toast.success("Saved");
                callbacks.onSuccess?.();
            },
            onError: (errors) => {
                toast.error(errors.message || "Unable to save");
                callbacks.onError?.(errors);
            },
        });
    };

    const confirmDelete = async () => {
        const confirmed = await confirm(
            `Delete "${project.title}"? This cannot be undone.`,
            "Delete Project"
        );

        if (!confirmed) {
            return;
        }

        router.delete(destroy.url(project.code), {
            preserveScroll: true,
            onSuccess: () => toast.success("Project deleted"),
            onError: () => toast.error("Unable to delete project"),
        });
    };

    return (
        <Layout>
            <Layout.Header
                metaTitle={project.title}
                showBack
                breadcrumbs={[
                    { label: "Projects", to: projectsIndex.url() },
                    { label: project.title },
                ]}
            />

            <Layout.Content className="min-h-0 flex-1 overflow-y-auto p-0">
                <div className="px-6 py-6 lg:px-8">
                <div className="flex w-full flex-col gap-5 pb-8">
                    <section className="rounded-md border border-border/80 bg-card p-4 shadow-[0_16px_48px_-24px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_48px_-24px_rgba(0,0,0,0.45)] sm:p-5">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex min-w-0 flex-1 flex-col gap-3">
                                <div className="flex items-stretch gap-4">
                                    <button
                                        type="button"
                                        className="group relative w-32 shrink-0 self-stretch overflow-hidden rounded-md border border-border bg-muted sm:w-36"
                                        onClick={() =>
                                            setMediaManager({
                                                linkage: "THUMBNAIL",
                                                multiple: false,
                                                selectedIds: thumbnailIds,
                                                title: "Project thumbnail",
                                                description:
                                                    "Choose one image as the project thumbnail.",
                                            })
                                        }
                                    >
                                        {project.thumbnail ? (
                                            <img
                                                src={project.thumbnail}
                                                alt=""
                                                className="absolute inset-0 size-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex size-full min-h-32 items-center justify-center text-muted-foreground sm:min-h-36">
                                                <Icon name="image-line" className="text-3xl" />
                                            </div>
                                        )}
                                        <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                                            <Icon
                                                name="camera-line"
                                                className="text-xl text-white"
                                            />
                                        </span>
                                    </button>

                                    <div className="min-w-0 flex-1 space-y-2">
                                        {project.type ? (
                                            <p
                                                className={cn(
                                                    "inline-flex w-fit items-center rounded-sm px-2.5 py-1 text-sm font-semibold capitalize tracking-wide",
                                                    typeTone(project.type)
                                                )}
                                            >
                                                {project.type}
                                            </p>
                                        ) : null}

                                        <div className="flex flex-wrap items-center gap-2">
                                            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                                                {project.title}
                                            </h1>
                                            <Badge
                                                className={cn(
                                                    "rounded-sm border-0 font-semibold uppercase tracking-wide",
                                                    statusTone(project.status)
                                                )}
                                            >
                                                {STATUS_LABELS[project.status] || project.status}
                                            </Badge>
                                        </div>

                                        {location || cityCountry ? (
                                            <div className="space-y-0.5 text-sm text-muted-foreground">
                                                {location ? <p>{location}</p> : null}
                                                {cityCountry ? <p>{cityCountry}</p> : null}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            <div className="flex w-full shrink-0 flex-col gap-8 lg:max-w-sm">
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditOpen(true)}
                                    >
                                        <Icon name="pencil-line" className="text-base" />
                                        Edit
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="destructive"
                                        onClick={confirmDelete}
                                    >
                                        <Icon name="delete-bin-line" className="text-base" />
                                        Delete
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <Label className="text-sm font-medium text-muted-foreground">
                                            Progress
                                        </Label>
                                        <span className="text-sm font-semibold tabular-nums text-foreground">
                                            {progress}%
                                        </span>
                                    </div>
                                    <Slider
                                        value={progressValue}
                                        min={0}
                                        max={100}
                                        step={1}
                                        onValueChange={(next) => {
                                            setProgressValue(
                                                Array.isArray(next)
                                                    ? next
                                                    : [Number(next) || 0]
                                            );
                                        }}
                                        onValueCommitted={(next) => {
                                            const committed = Array.isArray(next)
                                                ? Number(next[0]) || 0
                                                : Number(next) || 0;

                                            if (committed === Number(project.progress || 0)) {
                                                return;
                                            }

                                            saveProject({ progress: committed });
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="overflow-hidden rounded-md border border-border/80 bg-card shadow-[0_16px_48px_-24px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_48px_-24px_rgba(0,0,0,0.45)]">
                        <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
                            <StatItem
                                icon="ruler-line"
                                label="Total Area"
                                value={formatArea(stats.total_area, project.area_unit)}
                            />
                            <StatItem
                                icon="filter-3-line"
                                label="Total Leads"
                                value={stats.leads_count ?? 0}
                                href={leadsIndex.url({
                                    query: { project: project.code },
                                })}
                            />
                            <StatItem
                                icon="layout-grid-line"
                                label="Total Units"
                                value={stats.units_count ?? 0}
                                href={inventoryIndex.url({
                                    query: { project: project.code },
                                })}
                            />
                            <StatItem
                                icon="checkbox-circle-line"
                                label="Sold"
                                value={stats.sold_count ?? 0}
                            />
                        </div>
                    </section>

                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(20rem,0.9fr)]">
                        <div className="flex flex-col gap-5">
                            <Card className="gap-0 overflow-hidden rounded-md py-0 shadow-[0_16px_48px_-24px_rgba(0,0,0,0.12)] ring-border/60 dark:shadow-[0_16px_48px_-24px_rgba(0,0,0,0.45)]">
                                <CardHeader className="border-b border-border px-4 py-3 [.border-b]:pb-3">
                                    <CardTitle className="text-base font-bold">
                                        Description
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {project.description ? (
                                        <div className="p-4 sm:p-5">
                                            <MarkdownContent content={project.description} />
                                        </div>
                                    ) : (
                                        <EmptyPanel
                                            icon="file-text-line"
                                            message="No description yet"
                                            action={
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    onClick={() => setEditOpen(true)}
                                                >
                                                    Add description
                                                </Button>
                                            }
                                        />
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="gap-0 overflow-hidden rounded-md py-0 shadow-[0_16px_48px_-24px_rgba(0,0,0,0.12)] ring-border/60 dark:shadow-[0_16px_48px_-24px_rgba(0,0,0,0.45)]">
                                <CardHeader className="border-b border-border px-4 py-3 [.border-b]:pb-3">
                                    <CardTitle className="text-base font-bold">
                                        Project Gallery
                                    </CardTitle>
                                    <CardAction>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                                setMediaManager({
                                                    linkage: "GALLERY",
                                                    multiple: true,
                                                    selectedIds: galleryIds,
                                                    title: "Project gallery",
                                                    description:
                                                        "Select images for this project gallery.",
                                                })
                                            }
                                        >
                                            <Icon name="add-line" className="text-base" />
                                            Manage images
                                        </Button>
                                    </CardAction>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {gallery.length === 0 ? (
                                        <EmptyPanel
                                            icon="folder-image-line"
                                            message="No images available"
                                            action={
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    onClick={() =>
                                                        setMediaManager({
                                                            linkage: "GALLERY",
                                                            multiple: true,
                                                            selectedIds: galleryIds,
                                                            title: "Project gallery",
                                                            description:
                                                                "Select images for this project gallery.",
                                                        })
                                                    }
                                                >
                                                    Add images
                                                </Button>
                                            }
                                        />
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3">
                                            {gallery.map((image, index) => (
                                                <button
                                                    key={image.id}
                                                    type="button"
                                                    className="aspect-[4/3] overflow-hidden rounded-md border border-border bg-muted transition-opacity hover:opacity-90"
                                                    onClick={() =>
                                                        setGalleryPreviewIndex(index)
                                                    }
                                                >
                                                    <img
                                                        src={image.src}
                                                        alt={image.name || ""}
                                                        className="size-full object-cover"
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <InventoryPanel
                                project={project}
                                units={inventoryUnits}
                                stats={stats}
                            />

                            <LocationMapPanel project={project} onSave={saveProject} />
                        </div>

                        <div className="flex flex-col gap-4">
                            <SidebarSection
                                title="Progress & updates"
                                onAdd={() => openProgressForm()}
                            >
                                <ProgressTimeline
                                    phases={phases}
                                    onEdit={openProgressForm}
                                />
                            </SidebarSection>

                            <SidebarSection
                                title="Documents & files"
                                onAdd={() => setDocumentManagerOpen(true)}
                            >
                                {previewDocuments.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        No documents yet. Upload or select files from the library.
                                    </p>
                                ) : (
                                    <ul className="space-y-2">
                                        {documents.map((document, index) => (
                                            <li key={document.link_id || document.id}>
                                                <div className="group flex items-center gap-1 rounded-md px-1 py-1 transition-colors hover:bg-muted/60">
                                                    <button
                                                        type="button"
                                                        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1.5 text-left text-sm text-foreground"
                                                        onClick={() => openDocumentPreview(index)}
                                                    >
                                                        <Icon
                                                            name="file-text-line"
                                                            className="shrink-0 text-base text-muted-foreground"
                                                        />
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block truncate font-medium">
                                                                {document.title ||
                                                                    document.name ||
                                                                    "Document"}
                                                            </span>
                                                            {document.label &&
                                                            document.name &&
                                                            document.label !== document.name ? (
                                                                <span className="block truncate text-xs text-muted-foreground">
                                                                    {document.name}
                                                                </span>
                                                            ) : null}
                                                        </span>
                                                        {document.is_secure ? (
                                                            <Badge
                                                                className="shrink-0 gap-1 rounded-sm border-0 bg-amber-500/15 font-medium text-amber-700 dark:text-amber-400"
                                                                title="Secure file"
                                                            >
                                                                <Icon
                                                                    name="lock-line"
                                                                    className="text-xs"
                                                                />
                                                                Secure
                                                            </Badge>
                                                        ) : null}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                                                        aria-label={`Settings for ${document.title || document.name || "document"}`}
                                                        onClick={() => setEditingDocument(document)}
                                                    >
                                                        <Icon
                                                            name="settings-3-line"
                                                            className="text-base"
                                                        />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                                                        aria-label={`Preview ${document.title || document.name || "document"}`}
                                                        onClick={() => openDocumentPreview(index)}
                                                    >
                                                        <Icon
                                                            name="eye-line"
                                                            className="text-base"
                                                        />
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </SidebarSection>

                            <SidebarSection
                                title="Features"
                                onAdd={() => openFeatureForm()}
                            >
                                <FeaturesList
                                    features={features}
                                    onEdit={openFeatureForm}
                                />
                            </SidebarSection>

                            <ProjectRecordPanel project={project} />
                        </div>
                    </div>
                </div>
                </div>
            </Layout.Content>

            <ProjectForm
                isOpen={editOpen}
                onClose={() => setEditOpen(false)}
                data={project}
            />

            <ProgressForm
                isOpen={progressFormOpen}
                onClose={closeProgressForm}
                projectCode={project.code}
                data={editingPhase}
            />

            <FeatureForm
                isOpen={featureFormOpen}
                onClose={closeFeatureForm}
                projectCode={project.code}
                features={features}
                data={editingFeature}
            />

            <MediaManager
                open={Boolean(mediaManager)}
                onOpenChange={(open) => {
                    if (!open) {
                        setMediaManager(null);
                    }
                }}
                multiple={mediaManager?.multiple ?? true}
                assetableType="project"
                assetableId={project.id}
                linkage={mediaManager?.linkage || "GALLERY"}
                selectedIds={mediaManager?.selectedIds || []}
                title={mediaManager?.title}
                description={mediaManager?.description}
                onApplied={reloadProject}
            />

            <DocumentManager
                open={documentManagerOpen}
                onOpenChange={setDocumentManagerOpen}
                multiple
                assetableType="project"
                assetableId={project.id}
                linkage="DOCUMENT"
                selectedIds={documentIds}
                title="Project Documents"
                description="Select files for this project."
                onApplied={reloadProject}
            />

            <DocumentLinkForm
                isOpen={Boolean(editingDocument)}
                onClose={() => setEditingDocument(null)}
                document={editingDocument}
                onSaved={reloadProject}
            />

            <FilePreview
                open={documentPreviewOpen}
                onOpenChange={setDocumentPreviewOpen}
                files={previewDocuments}
                index={documentPreviewIndex}
                onIndexChange={setDocumentPreviewIndex}
            />

            <ImageLightbox
                open={galleryPreviewIndex !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setGalleryPreviewIndex(null);
                    }
                }}
                images={gallery}
                index={galleryPreviewIndex ?? 0}
                onIndexChange={setGalleryPreviewIndex}
            />
        </Layout>
    );
}

ProjectDetails.layout = (page) => <PortalLayout children={page} />;

export default ProjectDetails;

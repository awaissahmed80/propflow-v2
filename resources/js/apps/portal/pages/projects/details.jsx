import { useEffect, useState } from "react";
import { Link, router } from "@inertiajs/react";
import { toast } from "sonner";
import { destroy, update } from "@/actions/App/Http/Controllers/Portal/ProjectController";
import { index as projectsIndex } from "@/routes/portal/projects";
import { index as inventoryIndex } from "@/routes/portal/inventory";
import { index as leadsIndex } from "@/routes/portal/leads";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { DocumentManager, MediaManager } from "@/components/media-manager";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import ProjectForm from "./project-form";
import ProgressForm from "./progress-form";
import FeatureForm from "./feature-form";

const STATUS_LABELS = {
    draft: "Draft",
    active: "Active",
    on_hold: "On hold",
    completed: "Completed",
    archived: "Archived",
};

const UNIT_STATUS_LABELS = {
    AVAILABLE: "Available",
    RESERVED: "Reserved",
    TOKEN: "Token",
    HOLD: "On Hold",
    SOLD: "Sold",
    INACTIVE: "Inactive",
};

const PHASE_STATUS_LABELS = {
    planned: "Planned",
    in_progress: "In progress",
    completed: "Completed",
    delayed: "Delayed",
};

function statusTone(status) {
    switch (status) {
        case "active":
            return "bg-sky-500/15 text-sky-600 dark:text-sky-400";
        case "completed":
            return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
        case "on_hold":
            return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
        case "archived":
            return "bg-muted text-muted-foreground";
        default:
            return "bg-primary/10 text-primary";
    }
}

function typeTone(type) {
    switch (type) {
        case "residential":
            return "bg-amber-700/20 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
        case "commercial":
            return "bg-violet-500/15 text-violet-700 dark:text-violet-300";
        case "mixed":
            return "bg-teal-500/15 text-teal-700 dark:text-teal-300";
        default:
            return "bg-muted text-muted-foreground";
    }
}

function projectLocation(project) {
    return [project.location, project.city, project.country].filter(Boolean).join(", ");
}

function formatArea(value, unit = "Sq. Feet") {
    const area = Number(value) || 0;
    const label = unit || "Sq. Feet";

    return `${area.toLocaleString()} ${label}`;
}

function phaseStatusTone(status) {
    switch (status) {
        case "completed":
            return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
        case "in_progress":
            return "bg-sky-500/15 text-sky-700 dark:text-sky-400";
        case "delayed":
            return "bg-amber-500/15 text-amber-800 dark:text-amber-400";
        default:
            return "bg-muted text-muted-foreground";
    }
}

function formatPhaseDate(value) {
    if (!value) {
        return null;
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function phaseDateRange(phase) {
    const start = formatPhaseDate(phase.start_date);
    const end = formatPhaseDate(phase.end_date);

    if (start && end) {
        return `${start} – ${end}`;
    }

    return start || end || null;
}

function ProgressTimeline({ phases, onEdit }) {
    if (phases.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                No milestones yet. Add the first update to build the timeline.
            </p>
        );
    }

    return (
        <ol className="relative space-y-0 border-l border-border ml-2">
            {phases.map((phase, index) => {
                const dateRange = phaseDateRange(phase);
                const isLast = index === phases.length - 1;
                const statusLabel =
                    PHASE_STATUS_LABELS[phase.status] || phase.status || "Planned";

                return (
                    <li
                        key={phase.id}
                        className={cn("relative pl-5", !isLast && "pb-5")}
                    >
                        <span
                            className={cn(
                                "absolute top-1.5 -left-[5px] size-2.5 rounded-full ring-2 ring-background",
                                phase.status === "completed"
                                    ? "bg-emerald-500"
                                    : phase.status === "in_progress"
                                      ? "bg-sky-500"
                                      : phase.status === "delayed"
                                        ? "bg-amber-500"
                                        : "bg-muted-foreground/50"
                            )}
                        />
                        <button
                            type="button"
                            className="group w-full rounded-md text-left transition-colors hover:bg-muted/40 -mx-1 px-1 py-0.5"
                            onClick={() => onEdit(phase)}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-foreground">
                                        {phase.title}
                                    </div>
                                    {dateRange ? (
                                        <div className="mt-0.5 text-xs text-muted-foreground">
                                            {dateRange}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                    <Badge
                                        variant="secondary"
                                        className={cn(
                                            "rounded-md px-1.5 py-0 text-[11px] font-medium",
                                            phaseStatusTone(phase.status)
                                        )}
                                    >
                                        {statusLabel}
                                    </Badge>
                                    <span className="text-xs tabular-nums text-muted-foreground">
                                        {phase.progress ?? 0}%
                                    </span>
                                </div>
                            </div>
                            {phase.description ? (
                                <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                                    {phase.description}
                                </p>
                            ) : null}
                        </button>
                    </li>
                );
            })}
        </ol>
    );
}

function FeaturesList({ features, onEdit }) {
    if (features.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                No features listed yet. Add amenities and highlights for this project.
            </p>
        );
    }

    return (
        <ul className="space-y-1">
            {features.map((feature, index) => (
                <li key={`${index}-${feature}`}>
                    <button
                        type="button"
                        className="group flex w-full items-start gap-2 rounded-md px-1 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted/40"
                        onClick={() => onEdit({ index, value: feature })}
                    >
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                        <span className="min-w-0 flex-1">{feature}</span>
                    </button>
                </li>
            ))}
        </ul>
    );
}

function StatItem({ icon, label, value, href }) {
    const content = (
        <>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon name={icon} className="text-xl" />
            </div>
            <div className="min-w-0">
                <div className="truncate text-xs text-muted-foreground">{label}</div>
                <div className="truncate text-base font-semibold tracking-tight text-foreground">
                    {value}
                </div>
            </div>
        </>
    );

    if (href) {
        return (
            <Link
                href={href}
                className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
            >
                {content}
            </Link>
        );
    }

    return (
        <div className="flex min-w-0 items-center gap-3 px-4 py-3 sm:px-5">
            {content}
        </div>
    );
}

function EmptyPanel({ icon = "folder-warning-line", message, action }) {
    return (
        <div className="flex min-h-40 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <div className="relative flex size-16 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
                <Icon name={icon} className="text-3xl" />
            </div>
            <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
            {action}
        </div>
    );
}

function LocationMapPanel({ project, onSave }) {
    const mapSrc = project.map_embed_src || null;
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(project.pin_location ?? "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!editing) {
            setDraft(project.pin_location ?? "");
            setError(null);
        }
    }, [project.pin_location, editing]);

    const openEditor = () => {
        setDraft(project.pin_location ?? "");
        setError(null);
        setEditing(true);
    };

    const cancelEditor = () => {
        setDraft(project.pin_location ?? "");
        setError(null);
        setEditing(false);
    };

    const saveMap = () => {
        const pin_location = draft.trim() || null;

        if (pin_location === (project.pin_location || null)) {
            setEditing(false);
            return;
        }

        setSaving(true);
        setError(null);

        onSave(
            { pin_location },
            {
                onSuccess: () => {
                    setEditing(false);
                    setSaving(false);
                },
                onError: (errors) => {
                    setError(
                        errors.pin_location ||
                            errors.message ||
                            "Unable to save map embed"
                    );
                    setSaving(false);
                },
            }
        );
    };

    return (
        <Card className="gap-0 overflow-hidden rounded-md py-0 shadow-[0_16px_48px_-24px_rgba(0,0,0,0.12)] ring-border/60 dark:shadow-[0_16px_48px_-24px_rgba(0,0,0,0.45)]">
            <CardHeader className="border-b border-border px-4 py-3 [.border-b]:pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <Icon name="map-2-line" className="text-base text-muted-foreground" />
                    Location Map
                </CardTitle>
                {mapSrc && !editing ? (
                    <CardAction>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={openEditor}
                        >
                            Edit map
                        </Button>
                    </CardAction>
                ) : null}
                {editing ? (
                    <CardAction>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={cancelEditor}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                    </CardAction>
                ) : null}
            </CardHeader>
            <CardContent className="p-0">
                {editing ? (
                    <div className="space-y-3 p-4">
                        <div className="space-y-1.5">
                            <Label
                                htmlFor="project-map-embed"
                                className="text-sm font-medium text-muted-foreground"
                            >
                                Map embed
                            </Label>
                            <Textarea
                                id="project-map-embed"
                                value={draft}
                                onChange={(event) => setDraft(event.target.value)}
                                placeholder="Paste Google Maps / OSM embed iframe code or map URL"
                                className="min-h-28 rounded-md font-mono text-xs dark:bg-input/30"
                                autoFocus
                            />
                            {error ? (
                                <p className="text-[13px] text-destructive">{error}</p>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    Use “Embed a map” from Google Maps, or paste an
                                    OpenStreetMap embed / share URL.
                                </p>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                size="sm"
                                loading={saving}
                                onClick={saveMap}
                            >
                                Save map
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={saving}
                                onClick={cancelEditor}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : mapSrc ? (
                    <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
                        <iframe
                            title={`${project.title} map`}
                            src={mapSrc}
                            className="size-full border-0"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            allowFullScreen
                        />
                    </div>
                ) : (
                    <EmptyPanel
                        icon="map-pin-line"
                        message="No map has been added."
                        action={
                            <button
                                type="button"
                                className="text-sm font-medium text-primary hover:underline"
                                onClick={openEditor}
                            >
                                Add map embed
                            </button>
                        }
                    />
                )}
            </CardContent>
        </Card>
    );
}

function unitStatusTone(status) {
    switch (status) {
        case "AVAILABLE":
            return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
        case "RESERVED":
            return "bg-sky-500/15 text-sky-700 dark:text-sky-400";
        case "TOKEN":
            return "bg-violet-500/15 text-violet-700 dark:text-violet-400";
        case "HOLD":
            return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
        case "SOLD":
            return "bg-primary/10 text-primary";
        default:
            return "bg-muted text-muted-foreground";
    }
}

function InventoryPanel({ project, stats, units }) {
    const inventoryUrl = inventoryIndex.url({
        query: { project: project.code },
    });

    return (
        <SidebarSection
            title="Inventory"
            icon="shape-line"
            action={
                <Link
                    href={inventoryUrl}
                    className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                >
                    View inventory
                </Link>
            }
        >
            <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-md border border-border/80 px-2.5 py-2 text-center">
                        <div className="text-base font-semibold text-foreground">
                            {stats.available_count ?? 0}
                        </div>
                        <div className="text-[11px] text-muted-foreground">Available</div>
                    </div>
                    <div className="rounded-md border border-border/80 px-2.5 py-2 text-center">
                        <div className="text-base font-semibold text-foreground">
                            {stats.reserved_count ?? 0}
                        </div>
                        <div className="text-[11px] text-muted-foreground">Reserved</div>
                    </div>
                    <div className="rounded-md border border-border/80 px-2.5 py-2 text-center">
                        <div className="text-base font-semibold text-foreground">
                            {stats.sold_count ?? 0}
                        </div>
                        <div className="text-[11px] text-muted-foreground">Sold</div>
                    </div>
                </div>

                {units.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No units yet. Add inventory for this project from the inventory page.
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {units.map((unit) => (
                            <li key={unit.id}>
                                <div className="flex items-center gap-2 rounded-md px-2 py-2 text-sm">
                                    <Icon
                                        name="layout-grid-line"
                                        className="shrink-0 text-base text-muted-foreground"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate font-medium text-foreground">
                                            {unit.name || "Unit"}
                                        </div>
                                        <div className="truncate text-xs text-muted-foreground">
                                            {[unit.type, unit.block?.title]
                                                .filter(Boolean)
                                                .join(" · ") || "—"}
                                        </div>
                                    </div>
                                    <Badge
                                        className={cn(
                                            "shrink-0 font-normal",
                                            unitStatusTone(unit.status)
                                        )}
                                    >
                                        {UNIT_STATUS_LABELS[unit.status] || unit.status}
                                    </Badge>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </SidebarSection>
    );
}

function SidebarSection({ title, icon = "flag-line", onAdd, action, children }) {
    return (
        <Card
            size="sm"
            className="gap-0 rounded-md py-0 shadow-[0_16px_48px_-24px_rgba(0,0,0,0.12)] ring-border/60 dark:shadow-[0_16px_48px_-24px_rgba(0,0,0,0.45)]"
        >
            <CardHeader className="border-b border-border px-4 py-3 [.border-b]:pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <Icon name={icon} className="text-base text-muted-foreground" />
                    {title}
                </CardTitle>
                {action ? <CardAction>{action}</CardAction> : null}
                {!action && onAdd ? (
                    <CardAction>
                        <IconButton
                            type="button"
                            size="sm"
                            className="rounded-md"
                            icon="add-line"
                            aria-label={`Add to ${title}`}
                            onClick={onAdd}
                        />
                    </CardAction>
                ) : null}
            </CardHeader>
            <CardContent className="px-4 py-4">{children}</CardContent>
        </Card>
    );
}

function ProjectDetails({ project }) {
    const [editOpen, setEditOpen] = useState(false);
    const [progressFormOpen, setProgressFormOpen] = useState(false);
    const [editingPhase, setEditingPhase] = useState(null);
    const [featureFormOpen, setFeatureFormOpen] = useState(false);
    const [editingFeature, setEditingFeature] = useState(null);
    const [mediaManager, setMediaManager] = useState(null);
    const [documentManagerOpen, setDocumentManagerOpen] = useState(false);
    const [galleryPreviewIndex, setGalleryPreviewIndex] = useState(null);
    const [progressValue, setProgressValue] = useState([
        Number(project.progress) || 0,
    ]);
    const location = projectLocation(project);
    const gallery = project.gallery ?? [];
    const documents = project.documents ?? [];
    const phases = project.phases ?? [];
    const features = project.features ?? [];
    const stats = project.stats ?? {};
    const inventoryUnits = project.inventory?.units ?? [];
    const progress = progressValue[0] ?? 0;
    const galleryIds = gallery.map((image) => image.id);
    const documentIds = documents.map((document) => document.id);
    const thumbnailIds = project.thumbnail_id ? [project.thumbnail_id] : [];

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
                            <div className="flex min-w-0 flex-1 gap-4">
                                <button
                                    type="button"
                                    className="group relative size-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted sm:size-24"
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
                                            className="size-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex size-full items-center justify-center text-muted-foreground">
                                            <Icon name="image-line" className="text-3xl" />
                                        </div>
                                    )}
                                    <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                                        <Icon name="camera-line" className="text-xl text-white" />
                                    </span>
                                </button>

                                <div className="min-w-0 flex-1 space-y-2">
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
                                        {project.type ? (
                                            <Badge
                                                className={cn(
                                                    "rounded-sm border-0 font-medium capitalize",
                                                    typeTone(project.type)
                                                )}
                                            >
                                                {project.type}
                                            </Badge>
                                        ) : null}
                                        <IconButton
                                            type="button"
                                            size="sm"
                                            className="rounded-md"
                                            icon="pencil-line"
                                            aria-label="Edit project details"
                                            onClick={() => setEditOpen(true)}
                                        />
                                        <IconButton
                                            type="button"
                                            size="sm"
                                            variant="destructive"
                                            className="rounded-md"
                                            icon="delete-bin-line"
                                            aria-label="Delete project"
                                            onClick={confirmDelete}
                                        />
                                    </div>

                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                        {location ? (
                                            <span className="inline-flex items-center gap-1.5">
                                                <Icon name="map-pin-line" className="text-base" />
                                                {location}
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                className="inline-flex items-center gap-1.5 text-primary hover:underline"
                                                onClick={() => setEditOpen(true)}
                                            >
                                                <Icon
                                                    name="map-pin-add-line"
                                                    className="text-base"
                                                />
                                                Add location
                                            </button>
                                        )}
                                    </div>

                                    {project.description ? (
                                        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                                            {project.description}
                                        </p>
                                    ) : null}
                                </div>
                            </div>

                            <div className="flex w-full shrink-0 flex-col gap-4 lg:max-w-sm">
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
                                stats={stats}
                                units={inventoryUnits}
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
                                {documents.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        No documents yet. Upload or select files from the library.
                                    </p>
                                ) : (
                                    <ul className="space-y-2">
                                        {documents.map((document) => (
                                            <li key={document.id}>
                                                <a
                                                    href={document.src}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                                                >
                                                    <Icon
                                                        name="file-text-line"
                                                        className="text-base text-muted-foreground"
                                                    />
                                                    <span className="truncate">
                                                        {document.title}
                                                    </span>
                                                </a>
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

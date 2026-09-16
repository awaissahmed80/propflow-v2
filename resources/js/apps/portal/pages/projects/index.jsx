import { useEffect, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import { destroy } from "@/actions/App/Http/Controllers/Portal/ProjectController";
import { index, show } from "@/routes/portal/projects";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterInput } from "@/components/ui/filter-input";
import { Icon } from "@/components/ui/icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import ProjectForm from "./project-form";

const VIEW_STORAGE_KEY = "projects.view";

const STATUS_LABELS = {
    draft: "Draft",
    active: "Active",
    on_hold: "On hold",
    completed: "Completed",
    archived: "Archived",
};

function statusTone(status) {
    switch (status) {
        case "active":
            return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
        case "completed":
            return "bg-primary/10 text-primary";
        case "on_hold":
            return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
        case "archived":
            return "bg-muted text-muted-foreground";
        default:
            return "bg-muted text-muted-foreground";
    }
}

function projectLocation(project) {
    return [project.city, project.location, project.country].filter(Boolean).join(" · ") || "—";
}

function openProject(project) {
    router.visit(show.url(project.code));
}

function ProjectActionsMenu({ project, onDelete, alwaysVisible = false }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                className={cn(
                    "pointer-events-auto inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground",
                    "transition-opacity hover:bg-muted hover:text-foreground",
                    alwaysVisible
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
                )}
                aria-label={`Actions for ${project.title}`}
                onClick={(event) => event.stopPropagation()}
            >
                <Icon name="more-2-fill" className="text-lg" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
                <DropdownMenuItem className="gap-2" onClick={() => openProject(project)}>
                    <Icon name="eye-line" className="text-base" />
                    View project
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    variant="destructive"
                    className="gap-2"
                    onClick={() => onDelete(project)}
                >
                    <Icon name="delete-bin-line" className="text-base" />
                    Delete
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function ProjectThumb({ project, className }) {
    if (project.thumbnail) {
        return (
            <img
                src={project.thumbnail}
                alt=""
                className={cn("size-full object-cover", className)}
            />
        );
    }

    return (
        <div
            className={cn(
                "flex size-full items-center justify-center bg-primary/10 text-primary",
                className
            )}
        >
            <Icon name="community-line" className="text-2xl" />
        </div>
    );
}

function ProgressBar({ value }) {
    const progress = Math.min(100, Math.max(0, Number(value) || 0));

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
}

function ProjectCard({ project, onDelete }) {
    return (
        <article
            role="link"
            tabIndex={0}
            aria-label={`View ${project.title}`}
            className={cn(
                "group relative flex cursor-pointer flex-col overflow-hidden rounded-md border border-border bg-card",
                "transition-[transform,box-shadow,border-color] duration-200",
                "hover:-translate-y-0.5 hover:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.14)]",
                "dark:hover:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.5)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            )}
            onClick={() => openProject(project)}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openProject(project);
                }
            }}
        >
            <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                <ProjectThumb project={project} />
                <div className="absolute top-3 right-3 z-10">
                    <ProjectActionsMenu project={project} onDelete={onDelete} />
                </div>
            </div>

            <div className="relative flex flex-1 flex-col gap-3 p-4">
                <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-semibold tracking-tight text-foreground">
                            {project.title}
                        </h2>
                        {project.code ? (
                            <Badge variant="outline" className="rounded-sm font-normal text-muted-foreground">
                                #{project.code}
                            </Badge>
                        ) : null}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                        {projectLocation(project)}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Badge className={cn("rounded-sm border-0 font-medium", statusTone(project.status))}>
                        {STATUS_LABELS[project.status] || project.status}
                    </Badge>
                    {project.type ? (
                        <span className="text-xs capitalize text-muted-foreground">
                            {project.type}
                        </span>
                    ) : null}
                </div>

                <ProgressBar value={project.progress} />

                <div className="mt-auto flex items-center gap-3 pt-1 text-xs text-muted-foreground">
                    <span>{project.blocks_count ?? 0} blocks</span>
                    <span>·</span>
                    <span>{project.units_count ?? 0} units</span>
                </div>
            </div>
        </article>
    );
}

function ProjectListRow({ project, onDelete }) {
    return (
        <div
            role="link"
            tabIndex={0}
            aria-label={`View ${project.title}`}
            className={cn(
                "group relative flex cursor-pointer items-center gap-4 rounded-md border border-border/80 bg-card px-4 py-3",
                "transition-[box-shadow,border-color] hover:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.14)]",
                "dark:hover:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.5)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            )}
            onClick={() => openProject(project)}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openProject(project);
                }
            }}
        >
            <div className="relative size-12 shrink-0 overflow-hidden rounded-md border border-border">
                <ProjectThumb project={project} />
            </div>

            <div className="relative min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-sm font-semibold text-foreground">
                        {project.title}
                    </div>
                    {project.code ? (
                        <span className="text-xs text-muted-foreground">#{project.code}</span>
                    ) : null}
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {projectLocation(project)}
                </div>
            </div>

            <Badge
                className={cn(
                    "relative hidden shrink-0 rounded-sm border-0 font-medium sm:inline-flex",
                    statusTone(project.status)
                )}
            >
                {STATUS_LABELS[project.status] || project.status}
            </Badge>

            <div className="relative hidden w-28 shrink-0 md:block">
                <ProgressBar value={project.progress} />
            </div>

            <div className="relative shrink-0">
                <ProjectActionsMenu project={project} onDelete={onDelete} alwaysVisible />
            </div>
        </div>
    );
}

function readStoredView() {
    if (typeof window === "undefined") {
        return "grid";
    }

    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return stored === "list" || stored === "grid" ? stored : "grid";
}

function ProjectsIndex({ projects = [], filters = { q: "" } }) {
    const [search, setSearch] = useState(filters.q ?? "");
    const [view, setView] = useState(readStoredView);
    const [projectFormOpen, setProjectFormOpen] = useState(false);
    const searchTimeout = useRef(null);

    useEffect(() => {
        setSearch(filters.q ?? "");
    }, [filters.q]);

    useEffect(() => {
        window.localStorage.setItem(VIEW_STORAGE_KEY, view);
    }, [view]);

    useEffect(() => {
        return () => {
            if (searchTimeout.current) {
                clearTimeout(searchTimeout.current);
            }
        };
    }, []);

    const visitProjects = (q = "") => {
        router.get(
            index.url(),
            q ? { q } : {},
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["projects", "filters"],
            }
        );
    };

    const handleSearchChange = (event) => {
        const value = event.target.value;
        setSearch(value);

        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }

        searchTimeout.current = setTimeout(() => {
            visitProjects(value.trim());
        }, 300);
    };

    const confirmDelete = async (project) => {
        const confirmed = await confirm(
            `Delete "${project.title}"? This cannot be undone.`,
            "Delete Project"
        );

        if (!confirmed) {
            return;
        }

        toast.promise(
            new Promise((resolve, reject) => {
                router.delete(destroy.url(project.code), {
                    preserveScroll: true,
                    onSuccess: () => resolve(),
                    onError: () => reject(new Error("Unable to delete project")),
                });
            }),
            {
                loading: "Deleting project...",
                success: "Project deleted",
                error: "Unable to delete project",
            }
        );
    };

    return (
        <Layout>
            <Layout.Header metaTitle="Projects" breadcrumbs={[{ label: "Projects" }]} />
            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar>
                    <h1 className="shrink-0 text-xl font-bold tracking-tight text-foreground">
                        Projects
                    </h1>
                    <FilterInput
                        value={search}
                        onChange={handleSearchChange}
                        placeholder="Search projects..."
                        className="w-64"
                    />

                    <div className="ml-auto flex items-center gap-2">
                        <div className="inline-flex rounded-md border border-border p-0.5">
                            <button
                                type="button"
                                className={cn(
                                    "inline-flex size-8 items-center justify-center rounded-sm text-muted-foreground transition-colors",
                                    view === "grid" && "bg-muted text-foreground"
                                )}
                                aria-label="Grid view"
                                aria-pressed={view === "grid"}
                                onClick={() => setView("grid")}
                            >
                                <Icon name="grid-line" className="text-base" />
                            </button>
                            <button
                                type="button"
                                className={cn(
                                    "inline-flex size-8 items-center justify-center rounded-sm text-muted-foreground transition-colors",
                                    view === "list" && "bg-muted text-foreground"
                                )}
                                aria-label="List view"
                                aria-pressed={view === "list"}
                                onClick={() => setView("list")}
                            >
                                <Icon name="list-check" className="text-base" />
                            </button>
                        </div>

                        <Button
                            type="button"
                            className="shrink-0"
                            onClick={() => setProjectFormOpen(true)}
                        >
                            <Icon name="add-line" className="text-base" />
                            Add Project
                        </Button>
                    </div>
                </Layout.Toolbar>

                <ScrollArea className="flex-1">
                    <div className="px-6 py-6">
                        {projects.length === 0 ? (
                            <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-6 text-center">
                                <div className="mb-4 flex size-14 items-center justify-center rounded-md bg-primary/10 text-primary">
                                    <Icon name="community-line" className="text-2xl" />
                                </div>
                                <h2 className="text-lg font-semibold tracking-tight">
                                    {filters.q
                                        ? "No projects match your search"
                                        : "Create your first project"}
                                </h2>
                                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                                    {filters.q
                                        ? "Try another name, city, code, or status."
                                        : "Start with a name, then add location, dates, and inventory on the project page."}
                                </p>
                                {!filters.q ? (
                                    <Button
                                        type="button"
                                        className="mt-5"
                                        onClick={() => setProjectFormOpen(true)}
                                    >
                                        <Icon name="add-line" className="text-base" />
                                        Create Project
                                    </Button>
                                ) : null}
                            </div>
                        ) : view === "grid" ? (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                                {projects.map((project) => (
                                    <ProjectCard
                                        key={project.id}
                                        project={project}
                                        onDelete={confirmDelete}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {projects.map((project) => (
                                    <ProjectListRow
                                        key={project.id}
                                        project={project}
                                        onDelete={confirmDelete}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </Layout.Content>

            <ProjectForm
                isOpen={projectFormOpen}
                onClose={() => setProjectFormOpen(false)}
            />
        </Layout>
    );
}

ProjectsIndex.layout = (page) => <PortalLayout children={page} />;

export default ProjectsIndex;

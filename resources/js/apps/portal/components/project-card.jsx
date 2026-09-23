import { Link, router } from "@inertiajs/react"
import { useEffect, useRef, useState } from "react"
import { card, show } from "@/routes/portal/projects"
import { pathFrom, requestJson } from "./notifications-helpers"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Icon } from "@/components/ui/icon"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Tooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/** @type {Map<string, object>} */
const projectCardCache = new Map()

export const PROJECT_STATUS_LABELS = {
  draft: "Draft",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  archived: "Archived",
}

export function projectStatusTone(status) {
  switch (status) {
    case "active":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
    case "completed":
      return "bg-primary/10 text-primary"
    case "on_hold":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400"
    case "archived":
      return "bg-muted text-muted-foreground"
    default:
      return "bg-muted text-muted-foreground"
  }
}

export function projectLocationLabel(project) {
  return (
    [project?.city, project?.location, project?.country]
      .filter(Boolean)
      .join(" · ") || "—"
  )
}

export function openProject(project) {
  if (!project?.code) {
    return
  }

  router.visit(show.url(project.code))
}

export function ProjectThumb({ project, className }) {
  const src = project?.thumbnail || project?.thumbnail_url

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={cn("size-full object-cover", className)}
      />
    )
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
  )
}

export function ProjectProgressBar({ value }) {
  const progress = Math.min(100, Math.max(0, Number(value) || 0))

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
  )
}

function ProjectActionsMenu({ project, onDelete, alwaysVisible = false }) {
  return (
    <DropdownMenu>
      <Tooltip content="More actions">
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
      </Tooltip>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem
          className="gap-2"
          onClick={() => openProject(project)}
        >
          <Icon name="eye-line" className="text-base" />
          View project
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="gap-2"
          onClick={() => onDelete?.(project)}
        >
          <Icon name="delete-bin-line" className="text-base" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ProjectCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[16/9] bg-muted" />
      <div className="space-y-3 p-4">
        <div className="h-3 w-16 rounded bg-muted" />
        <div className="h-5 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
        <div className="mt-5 h-1.5 rounded-full bg-muted" />
        <div className="h-3 w-28 rounded bg-muted pt-2" />
      </div>
    </div>
  )
}

/**
 * Project card used on /projects grid and inventory popovers.
 *
 * @param {object} props
 * @param {object} props.project
 * @param {(project: object) => void} [props.onDelete]
 * @param {"interactive" | "preview"} [props.mode]
 * @param {string} [props.className]
 */
export function ProjectCard({
  project,
  onDelete,
  mode = "interactive",
  className,
}) {
  const interactive = mode === "interactive"

  return (
    <article
      role={interactive ? "link" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `View ${project.title}` : undefined}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-md border border-border bg-card",
        interactive &&
          "group cursor-pointer transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.14)] dark:hover:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        !interactive && "border-transparent shadow-none",
        className
      )}
      onClick={interactive ? () => openProject(project) : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                openProject(project)
              }
            }
          : undefined
      }
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        <ProjectThumb project={project} />
        {interactive && onDelete ? (
          <div className="absolute top-3 right-3 z-10">
            <ProjectActionsMenu project={project} onDelete={onDelete} />
          </div>
        ) : null}
      </div>

      <div className="relative flex flex-1 flex-col p-4">
        <div className="min-w-0 space-y-1">
          {project.type ? (
            <p className="truncate text-xs font-medium capitalize text-muted-foreground">
              {project.type}
            </p>
          ) : null}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
              {project.title}
            </h2>
            {project.status ? (
              <Badge
                className={cn(
                  "shrink-0 rounded-sm border-0 font-medium",
                  projectStatusTone(project.status)
                )}
              >
                {PROJECT_STATUS_LABELS[project.status] || project.status}
              </Badge>
            ) : null}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {projectLocationLabel(project)}
          </p>
        </div>

        <div className="mt-5">
          <ProjectProgressBar value={project.progress} />
        </div>

        <div className="mt-auto flex items-center gap-3 pt-5 text-xs text-muted-foreground">
          <span>{project.blocks_count ?? 0} blocks</span>
          <span>·</span>
          <span>{project.units_count ?? 0} units</span>
        </div>
      </div>
    </article>
  )
}

/**
 * Click popover that lazy-loads a project card with a View details action.
 *
 * @param {object} props
 * @param {object | null | undefined} props.project Lean project ({ code, title, thumbnail? })
 * @param {import("react").ReactNode} props.children
 * @param {string} [props.align]
 * @param {string} [props.className]
 */
export function ProjectCardPopover({
  project,
  children,
  align = "start",
  className,
}) {
  const [open, setOpen] = useState(false)
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const requestCode = useRef(null)

  useEffect(() => {
    if (!open || !project?.code) {
      return undefined
    }

    const code = project.code
    const cached = projectCardCache.get(code)

    if (cached) {
      setDetails(cached)
      setFailed(false)
      setLoading(false)
      return undefined
    }

    let cancelled = false
    requestCode.current = code
    setLoading(true)
    setFailed(false)

    requestJson(pathFrom(card.url(code)))
      .then((payload) => {
        if (cancelled || requestCode.current !== code) {
          return
        }

        const next = payload?.data || payload

        if (!next?.code) {
          throw new Error("Invalid project card payload")
        }

        projectCardCache.set(code, next)
        setDetails(next)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled || requestCode.current !== code) {
          return
        }

        setFailed(true)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, project?.code])

  if (!project?.code) {
    return children
  }

  const cardProject = details || project

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "inline-flex max-w-full items-center rounded-md text-left text-sm font-medium text-foreground outline-none",
          "transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50",
          "data-popup-open:text-primary",
          className
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side="bottom"
        sideOffset={8}
        className="w-[22rem] gap-0 overflow-hidden p-0 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.28)] ring-1 ring-foreground/10 dark:shadow-[0_18px_50px_-12px_rgba(0,0,0,0.55)]"
      >
        {loading && !details ? (
          <ProjectCardSkeleton />
        ) : failed && !details ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <Icon
              name="error-warning-line"
              className="text-2xl text-muted-foreground"
            />
            <p className="text-sm text-muted-foreground">Unable to load project</p>
          </div>
        ) : (
          <ProjectCard project={cardProject} mode="preview" />
        )}
        <div className="border-t border-border bg-card px-3 py-2.5">
          <Link
            href={show.url(project.code)}
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "w-full"
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <Icon name="eye-line" className="text-base" />
            View details
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}

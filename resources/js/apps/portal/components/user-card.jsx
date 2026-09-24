import { Link } from "@inertiajs/react"
import { useEffect, useRef, useState } from "react"
import { card, index as usersIndex } from "@/routes/portal/users"
import { Avatar } from "@/components/ui/avatar"
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
import { pathFrom, requestJson } from "./notifications-helpers"

/** @type {Map<string, object>} */
const userCardCache = new Map()

export function UserAvatar({ user, className, size = "default", textClass }) {
  return (
    <Avatar
      name={user?.display_name || user?.email_address || ""}
      src={user?.avatar || undefined}
      size={size}
      className={className}
      textClass={textClass}
    />
  )
}

export function StatCard({ label, value }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-border px-4 py-5 text-center">
      <div className="text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </div>
  )
}

export function InfoField({ label, children }) {
  return (
    <div className="space-y-1.5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground">{children}</div>
    </div>
  )
}

export function userSubtitle(user, { includeEmail = true } = {}) {
  if (user?.title && user?.department) {
    return `${user.title} · ${user.department}`
  }

  return (
    user?.title ||
    user?.department ||
    (includeEmail ? user?.email_address : null) ||
    null
  )
}

/**
 * Workspace user card used on /users and in hover previews.
 *
 * @param {object} props
 * @param {object} props.user
 * @param {boolean} [props.active]
 * @param {(user: object) => void} [props.onView]
 * @param {(user: object) => void} [props.onEdit]
 * @param {(user: object) => void} [props.onDelete]
 * @param {"interactive" | "preview"} [props.mode]
 * @param {string} [props.className]
 */
export function UserCard({
  user,
  active = false,
  onView,
  onEdit,
  onDelete,
  mode = "interactive",
  className,
}) {
  const interactive = mode === "interactive"
  const tags = (user.roles ?? []).slice(0, 4)
  const canDelete = !user.is_owner

  return (
    <article
      className={cn(
        "relative flex items-start gap-3 rounded-md border bg-card p-4",
        interactive &&
          "group transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.14)] dark:hover:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.5)]",
        interactive && active
          ? "border-primary/40 shadow-[0_16px_48px_-16px_rgba(56,71,208,0.22)]"
          : "border-border/80 shadow-none",
        !interactive && "border-transparent shadow-none",
        className
      )}
    >
      {interactive && typeof onView === "function" ? (
        <button
          type="button"
          className="absolute inset-0 z-0 rounded-md"
          aria-label={`View ${user.display_name}`}
          onClick={() => onView(user)}
        />
      ) : null}

      <div
        className={cn(
          "relative z-10 flex w-full items-start gap-3",
          interactive && "pointer-events-none"
        )}
      >
        <UserAvatar user={user} className="size-12" textClass="text-sm" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-semibold tracking-tight text-foreground">
                {user.display_name}
              </div>
              {userSubtitle(user, { includeEmail: interactive }) ? (
                <div className="mt-0.5 truncate text-sm text-muted-foreground">
                  {userSubtitle(user, { includeEmail: interactive })}
                </div>
              ) : null}
            </div>

            {interactive ? (
              <DropdownMenu>
                <Tooltip content="More actions">
                  <DropdownMenuTrigger
                    className={cn(
                      "pointer-events-auto inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground",
                      "opacity-0 transition-opacity hover:bg-muted hover:text-foreground",
                      "group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100",
                      active && "opacity-100"
                    )}
                    aria-label={`Actions for ${user.display_name}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Icon name="more-2-fill" className="text-lg" />
                  </DropdownMenuTrigger>
                </Tooltip>
                <DropdownMenuContent align="end" className="min-w-40">
                  <DropdownMenuItem
                    className="gap-2"
                    onClick={() => onView?.(user)}
                  >
                    <Icon name="user-line" className="text-base" />
                    View profile
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2"
                    onClick={() => onEdit?.(user)}
                  >
                    <Icon name="pencil-line" className="text-base" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    className="gap-2"
                    disabled={!canDelete}
                    onClick={() => {
                      if (canDelete) {
                        onDelete?.(user)
                      }
                    }}
                  >
                    <Icon name="delete-bin-line" className="text-base" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>

          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((role) => (
                <span
                  key={role}
                  className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  {role}
                </span>
              ))}
              {(user.roles?.length ?? 0) > tags.length ? (
                <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  +{user.roles.length - tags.length}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">No roles assigned</div>
          )}
        </div>
      </div>
    </article>
  )
}

function UserCardSkeleton() {
  return (
    <div className="animate-pulse p-4">
      <div className="flex items-start gap-3">
        <div className="size-12 shrink-0 rounded-full bg-muted" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-5 w-2/3 rounded bg-muted" />
          <div className="h-3 w-1/2 rounded bg-muted" />
          <div className="flex gap-1.5 pt-1">
            <div className="h-5 w-16 rounded-full bg-muted" />
            <div className="h-5 w-14 rounded-full bg-muted" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Hover popover that lazy-loads a preview UserCard.
 *
 * @param {object} props
 * @param {object | null | undefined} props.user Lean user ({ code, display_name, avatar? })
 * @param {import("react").ReactNode} props.children
 * @param {string} [props.align]
 * @param {string} [props.className]
 */
export function UserCardPopover({ user, children, align = "start", className }) {
  const [open, setOpen] = useState(false)
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const requestCode = useRef(null)

  useEffect(() => {
    if (!open || !user?.code) {
      return undefined
    }

    const code = user.code
    const cached = userCardCache.get(code)

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
          throw new Error("Invalid user card payload")
        }

        userCardCache.set(code, next)
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
  }, [open, user?.code])

  if (!user?.code) {
    return children
  }

  const cardUser = details || user

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        openOnHover
        delay={200}
        closeDelay={150}
        className={cn(
          "inline-flex max-w-full items-center gap-2.5 rounded-md text-left outline-none",
          "transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50",
          "data-popup-open:bg-muted/50",
          className
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side="top"
        sideOffset={8}
        className="w-88 gap-0 overflow-hidden p-0 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.28)] ring-1 ring-foreground/10 dark:shadow-[0_18px_50px_-12px_rgba(0,0,0,0.55)]"
      >
        {loading && !details ? (
          <UserCardSkeleton />
        ) : failed && !details ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <Icon
              name="error-warning-line"
              className="text-2xl text-muted-foreground"
            />
            <p className="text-sm text-muted-foreground">Unable to load user</p>
          </div>
        ) : (
          <UserCard user={cardUser} mode="preview" />
        )}
        <div className="border-t border-border bg-card px-3 py-2.5">
          <Link
            href={usersIndex.url({ query: { user: user.code } })}
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "w-full"
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <Icon name="user-line" className="text-base" />
            View profile
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}

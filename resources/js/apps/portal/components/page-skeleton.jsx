import { Layout } from "@/portal/components/layout"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * True while an Inertia instant visit is waiting for page props.
 *
 * @param {unknown} value
 */
export function isPagePending(value) {
  return value === undefined
}

/**
 * Shared loading shell for portal index pages during instant navigation.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.metaTitle]
 * @param {Array<{ label: string, href?: string }>} [props.breadcrumbs]
 * @param {"table"|"cards"|"dashboard"|"settings"|"activity"|"files"} [props.variant]
 * @param {string} [props.className]
 */
export function PageSkeleton({
  title,
  metaTitle,
  breadcrumbs = [{ label: title }],
  variant = "table",
  className,
}) {
  return (
    <Layout>
      <Layout.Header metaTitle={metaTitle || title} breadcrumbs={breadcrumbs} />
      <Layout.Content
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden p-0",
          className
        )}
      >
        <Layout.Toolbar>
          <Skeleton className="h-7 w-40" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-8 w-24" />
          </div>
        </Layout.Toolbar>

        <div className="min-h-0 flex-1 overflow-hidden px-6 py-5">
          {variant === "dashboard" ? <DashboardSkeletonBody /> : null}
          {variant === "table" ? <TableSkeletonBody /> : null}
          {variant === "cards" ? <CardsSkeletonBody /> : null}
          {variant === "settings" ? <SettingsSkeletonBody /> : null}
          {variant === "activity" ? <ActivitySkeletonBody /> : null}
          {variant === "files" ? <FilesSkeletonBody /> : null}
        </div>
      </Layout.Content>
    </Layout>
  )
}

function DashboardSkeletonBody() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="space-y-3 rounded-xl border border-border/70 bg-card px-4 py-4"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4 xl:col-span-3">
          <Skeleton className="h-4 w-32" />
          <div className="flex h-56 items-end gap-3 px-2">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton
                key={index}
                className="flex-1 rounded-t-md"
                style={{ height: `${40 + (index % 3) * 22}%` }}
              />
            ))}
          </div>
        </div>
        <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4 xl:col-span-2">
          <Skeleton className="h-4 w-28" />
          <div className="flex items-center gap-6 py-4">
            <Skeleton className="size-36 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-3">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-3 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="space-y-3 rounded-xl border border-border/70 bg-card p-4"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        ))}
      </div>
    </div>
  )
}

function TableSkeletonBody() {
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="border-b border-border bg-muted/30 px-4 py-3">
          <div className="flex gap-4">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-4 w-20" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CardsSkeletonBody() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-48 rounded-xl" />
      ))}
    </div>
  )
}

function SettingsSkeletonBody() {
  return (
    <div className="flex gap-6">
      <div className="hidden w-52 shrink-0 space-y-2 md:block">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-full rounded-md" />
        ))}
      </div>
      <div className="min-w-0 flex-1 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  )
}

function ActivitySkeletonBody() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="flex gap-3 rounded-xl border border-border/80 px-4 py-3"
        >
          <Skeleton className="size-8 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-48 max-w-full" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      ))}
    </div>
  )
}

function FilesSkeletonBody() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: 12 }, (_, index) => (
        <Skeleton key={index} className="aspect-square rounded-md" />
      ))}
    </div>
  )
}

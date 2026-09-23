import { Layout } from "@/portal/components/layout"
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
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
 * Avatar + two text lines — matches shadcn Skeleton avatar example.
 *
 * @param {object} [props]
 * @param {string} [props.className]
 */
export function SkeletonAvatar({ className }) {
  return (
    <div className={cn("flex w-full items-center gap-4", className)}>
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="grid flex-1 gap-2">
        <Skeleton className="h-4 w-[150px] max-w-full" />
        <Skeleton className="h-4 w-[100px] max-w-[70%]" />
      </div>
    </div>
  )
}

/**
 * Multi-row table placeholder — matches shadcn Skeleton table example.
 *
 * @param {object} [props]
 * @param {number} [props.rows]
 * @param {string} [props.className]
 */
export function SkeletonTable({ rows = 8, className }) {
  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div className="flex items-center gap-4" key={index}>
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}

/**
 * Card placeholder — matches shadcn Skeleton card example.
 *
 * @param {object} [props]
 * @param {string} [props.className]
 */
export function SkeletonCard({ className }) {
  return (
    <Card size="sm" className={cn("w-full", className)}>
      <CardHeader>
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="aspect-video w-full" />
      </CardContent>
    </Card>
  )
}

/**
 * Chart / panel block placeholder for Deferred card bodies.
 *
 * @param {object} [props]
 * @param {string} [props.className]
 */
export function SkeletonPanel({ className }) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="min-h-32 w-full flex-1 rounded-lg" />
      <div className="flex gap-2">
        <Skeleton className="h-3 flex-1" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

/**
 * List of avatar rows for feed / recent-item cards.
 *
 * @param {object} [props]
 * @param {number} [props.rows]
 * @param {string} [props.className]
 */
export function SkeletonList({ rows = 5, className }) {
  return (
    <div className={cn("space-y-4 py-2", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <SkeletonAvatar key={index} />
      ))}
    </div>
  )
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
          <Card key={index} size="sm">
            <CardHeader>
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-16" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-5">
        <Card size="sm" className="xl:col-span-3">
          <CardHeader>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-40" />
          </CardHeader>
          <CardContent>
            <div className="flex h-56 items-end gap-3 px-2">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton
                  key={index}
                  className="flex-1 rounded-t-md"
                  style={{ height: `${40 + (index % 3) * 22}%` }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card size="sm" className="xl:col-span-2">
          <CardHeader>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-36" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6 py-2">
              <Skeleton className="size-36 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-3">
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-3 w-full" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    </div>
  )
}

function TableSkeletonBody() {
  return (
    <Card size="sm" className="overflow-hidden">
      <CardHeader className="border-b border-border/60">
        <div className="flex gap-4">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-4 w-20" />
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <SkeletonTable rows={8} />
      </CardContent>
    </Card>
  )
}

function CardsSkeletonBody() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <SkeletonCard key={index} />
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
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}

function ActivitySkeletonBody() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="flex gap-3" key={index}>
          <Skeleton className="size-8 shrink-0 rounded-lg" />
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

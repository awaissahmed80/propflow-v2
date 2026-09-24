import { Badge } from "@/components/ui/badge"
import { Icon } from "@/components/ui/icon"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"

export const UNIT_STATUS_LABELS = {
  AVAILABLE: "Available",
  RESERVED: "Reserved",
  TOKEN: "Token",
  HOLD: "On Hold",
  SOLD: "Sold",
  INACTIVE: "Inactive",
}

export const UNIT_STATUS_COLORS = {
  AVAILABLE: "#10b981",
  RESERVED: "#0ea5e9",
  TOKEN: "#8b5cf6",
  HOLD: "#f59e0b",
  SOLD: "#3b82f6",
  INACTIVE: "#94a3b8",
}

export function unitStatusTone(status) {
  switch (status) {
    case "AVAILABLE":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
    case "RESERVED":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-400"
    case "TOKEN":
      return "bg-violet-500/15 text-violet-700 dark:text-violet-400"
    case "HOLD":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400"
    case "SOLD":
      return "bg-primary/10 text-primary"
    default:
      return "bg-muted text-muted-foreground"
  }
}

/**
 * @param {{ size?: number | null, area_type?: string | null }} unit
 * @returns {string | null}
 */
export function unitSizeLabel(unit) {
  if (unit?.size == null || unit.size === "" || Number(unit.size) === 0) {
    return null
  }

  const size = Number(unit.size).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })
  const areaType = String(unit.area_type || "").trim()

  return areaType ? `${size} ${areaType}` : size
}

/**
 * @param {object} unit
 * @returns {string}
 */
export function unitMetaLine(unit) {
  return [unit?.type, unit?.block?.title, unit?.sector].filter(Boolean).join(" · ")
}

/**
 * @param {{ quantity?: number | null, remaining?: number | null }} unit
 * @returns {string}
 */
export function formatUnitQuantity(unit) {
  const total = unit?.quantity == null ? 1 : Number(unit.quantity)
  const remaining =
    unit?.remaining == null ? total : Number(unit.remaining)

  if (total > 1) {
    return `${total}/${remaining}`
  }

  return String(total)
}

/**
 * Inventory unit card for project details, inventory grids, and popovers.
 *
 * @param {object} props
 * @param {object} props.unit
 * @param {"interactive" | "preview"} [props.mode]
 * @param {(unit: object) => void} [props.onClick]
 * @param {string} [props.className]
 */
export function UnitCard({
  unit,
  mode = "interactive",
  onClick,
  className,
}) {
  const interactive = mode === "interactive"
  const clickable = interactive && typeof onClick === "function"
  const sizeLabel = unitSizeLabel(unit)
  const meta = unitMetaLine(unit)
  const hasPrice = unit?.price != null && Number(unit.price) > 0
  const statusLabel = UNIT_STATUS_LABELS[unit?.status] || unit?.status || "—"
  const statusColor =
    UNIT_STATUS_COLORS[unit?.status] || "var(--muted-foreground)"

  return (
    <article
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={
        clickable ? `Open ${unit?.name || "unit"}` : undefined
      }
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-md border border-border bg-card",
        interactive &&
          "group transition-[transform,box-shadow,border-color] duration-200",
        interactive &&
          "hover:-translate-y-0.5 hover:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.14)] dark:hover:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.5)]",
        clickable &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        !interactive && "border-border/70 shadow-none",
        className
      )}
      onClick={clickable ? () => onClick(unit) : undefined}
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onClick(unit)
              }
            }
          : undefined
      }
    >
      <div
        className="h-1 w-full"
        style={{ backgroundColor: statusColor }}
        aria-hidden
      />

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon name="layout-grid-line" className="text-base" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <h3 className="truncate text-sm font-semibold tracking-tight text-foreground">
                {unit?.name || "Unit"}
              </h3>
              {meta ? (
                <p className="truncate text-xs text-muted-foreground">{meta}</p>
              ) : (
                <p className="text-xs text-muted-foreground">No placement set</p>
              )}
            </div>
          </div>

          <Badge
            className={cn(
              "shrink-0 gap-1.5 rounded-sm border-0 font-medium",
              unitStatusTone(unit?.status)
            )}
          >
            <span
              className="size-1.5 shrink-0 rounded-sm"
              style={{ backgroundColor: statusColor }}
              aria-hidden
            />
            {statusLabel}
          </Badge>
        </div>

        <div className="mt-auto grid grid-cols-3 gap-2 border-t border-border/70 pt-3">
          <div className="min-w-0 space-y-0.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Size
            </div>
            <div className="truncate text-sm font-medium text-foreground">
              {sizeLabel || "—"}
            </div>
          </div>
          <div className="min-w-0 space-y-0.5 text-center">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Qty/Rem
            </div>
            <div className="truncate text-sm font-semibold tabular-nums text-foreground">
              {formatUnitQuantity(unit)}
            </div>
          </div>
          <div className="min-w-0 space-y-0.5 text-right">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Price
            </div>
            <div className="truncate text-sm font-semibold tabular-nums text-foreground">
              {hasPrice ? formatMoney(unit.price) : "—"}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

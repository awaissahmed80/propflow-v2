import { cn } from "@/lib/utils"

/**
 * Pill badge for lead pipeline stages (table + filters).
 *
 * @param {object} props
 * @param {string} props.label
 * @param {string | null | undefined} [props.color]
 * @param {boolean} [props.selected]
 * @param {string} [props.className]
 * @param {import("react").ElementType} [props.as]
 */
function StageBadge({
  label,
  color,
  selected = false,
  className,
  as: Comp = "span",
  ...props
}) {
  const isInteractive = Comp === "button" || Comp === "a"

  return (
    <Comp
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 border px-2.5 py-1 text-xs font-medium transition-colors",
        isInteractive ? "rounded-md" : "rounded-full",
        selected
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-background text-foreground",
        className
      )}
      {...props}
    >
      <span
        className="size-2 shrink-0 rounded-full"
        style={{
          backgroundColor: color || "var(--muted-foreground)",
        }}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </Comp>
  )
}

export { StageBadge }

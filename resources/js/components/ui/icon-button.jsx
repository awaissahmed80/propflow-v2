import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Icon } from "./icon"
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip"

const iconButtonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-icon-button text-foreground shadow-xs hover:text-primary hover:bg-icon-button/50",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:text-white dark:hover:text-white focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 hover:bg-destructive/50",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-icon-button text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        unstyled: "text-muted-foregrond hover:text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "size-(--height-control-icon)",
        lg: "size-9",
        icon: "size-(--height-control-icon)",
        sm: "size-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * @param {object} props
 * @param {string | false} [props.tooltip] Label for hover tooltip. Pass `false` to disable when used as a menu trigger.
 */
function IconButton({
  className,
  variant,
  size,
  loading = false,
  asChild = false,
  icon = "",
  type = "button",
  disabled,
  tooltip,
  "aria-label": ariaLabel,
  ...props
}) {
  const Comp = asChild ? Slot : "button"
  const tip =
    tooltip === false
      ? null
      : typeof tooltip === "string" && tooltip.trim()
        ? tooltip.trim()
        : typeof ariaLabel === "string" && ariaLabel.trim()
          ? ariaLabel.trim()
          : null

  const isDeleteAction =
    typeof icon === "string" && /(delete|trash|remove)/i.test(icon)

  const button = (
    <Comp
      data-slot="button"
      className={cn(
        iconButtonVariants({ variant, size }),
        isDeleteAction &&
          variant !== "destructive" &&
          "text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20",
        className
      )}
      disabled={disabled || loading}
      type={type}
      aria-label={ariaLabel}
      {...props}
    >
      {loading ? (
        <Icon name="loader-3-fill" className="animate-spin" />
      ) : (
        icon && <Icon name={icon} />
      )}
    </Comp>
  )

  if (!tip) {
    return button
  }

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="top">{tip}</TooltipContent>
    </Tooltip>
  )
}

export { IconButton, iconButtonVariants }

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Icon } from "./icon"


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
        default: "size-9 px-4 py-2 has-[>svg]:px-3",
        // sm: "size-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "size-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        sm: "size-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)


function IconButton({
  className,
  variant,
  size,
  loading = false,
  asChild = false,
  icon = '',  
  type="button",
  disabled,
  ...props
} ) {
  const Comp = asChild ? Slot : "button"

  return (
    <>
        <Comp
            data-slot="button"
            className={cn(iconButtonVariants({ variant, size, className }))}
            disabled={disabled || loading}
            type={type}
            {...props}
            >  
            { loading ? <Icon name="loader-3-fill" className="animate-spin" />:
                icon && <Icon name={icon} />
            }            
        </Comp>
    </>
  )
}

export { IconButton, iconButtonVariants }
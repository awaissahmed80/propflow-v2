import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const InlineSelectRoot = SelectPrimitive.Root

function InlineSelectTrigger({ className, children, ...props }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="inline-select-trigger"
      className={cn(
        "inline-flex h-auto w-fit max-w-full items-center gap-1 rounded-sm border-0 bg-transparent p-0 text-sm font-medium text-foreground shadow-none outline-none",
        "hover:text-foreground/80",
        "focus-visible:ring-0 focus-visible:ring-offset-0",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-placeholder:text-muted-foreground",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={<ChevronDownIcon className="size-3.5 text-muted-foreground" />}
      />
    </SelectPrimitive.Trigger>
  )
}

function InlineSelectValue({ className, ...props }) {
  return (
    <SelectPrimitive.Value
      data-slot="inline-select-value"
      className={cn("truncate", className)}
      {...props}
    />
  )
}

function InlineSelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "end",
  alignOffset = 0,
  alignItemWithTrigger = false,
  ...props
}) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="inline-select-content"
          className={cn(
            "relative z-50 max-h-(--available-height) min-w-28 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function InlineSelectItem({ className, children, ...props }) {
  return (
    <SelectPrimitive.Item
      data-slot="inline-select-item"
      className={cn(
        "relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none",
        "focus:bg-accent focus:text-accent-foreground",
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex-1 truncate">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon className="size-3.5" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function normalizeOption(option) {
  if (typeof option === "string") {
    return { value: option, label: option }
  }

  return {
    value: String(option.value),
    label: option.label ?? String(option.value),
    disabled: option.disabled,
  }
}

function InlineSelect({
  value,
  onValueChange,
  options = [],
  placeholder = "Select",
  disabled = false,
  className,
  triggerClassName,
  contentClassName,
  align = "end",
}) {
  const normalized = React.useMemo(
    () => options.map(normalizeOption),
    [options]
  )
  const selected = normalized.find((option) => option.value === String(value ?? ""))
  const hasValue = Boolean(selected)

  return (
    <InlineSelectRoot
      value={hasValue ? selected.value : null}
      onValueChange={(next) => onValueChange?.(next ?? "")}
      disabled={disabled}
    >
      <InlineSelectTrigger className={cn(className, triggerClassName)}>
        <InlineSelectValue placeholder={placeholder}>
          {(current) => {
            const option = normalized.find((item) => item.value === String(current ?? ""))

            return option?.label ?? (
              <span className="text-muted-foreground">{placeholder}</span>
            )
          }}
        </InlineSelectValue>
      </InlineSelectTrigger>
      <InlineSelectContent align={align} className={contentClassName}>
        {normalized.map((option) => (
          <InlineSelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </InlineSelectItem>
        ))}
      </InlineSelectContent>
    </InlineSelectRoot>
  )
}

export {
  InlineSelect,
  InlineSelectContent,
  InlineSelectItem,
  InlineSelectRoot,
  InlineSelectTrigger,
  InlineSelectValue,
}

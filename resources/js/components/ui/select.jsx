import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { CheckIcon, ChevronDownIcon, ChevronsUpDownIcon, ChevronUpIcon, XIcon } from "lucide-react"

import { Avatar } from "@/components/ui/avatar"
import { Icon } from "@/components/ui/icon"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root

function SelectGroup({ className, ...props }) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  )
}

function SelectValue({ className, ...props }) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex min-w-0 flex-1 items-center gap-2 text-left", className)}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  clearable = false,
  onClear,
  ...props
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-md border border-input bg-transparent py-1 pr-2 pl-2.5 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-control data-[size=sm]:h-control-sm data-[size=sm]:text-sm *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <span className="ml-auto flex shrink-0 items-center gap-1">
        {clearable && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear selection"
            className="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onClear?.()
            }}
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
          >
            <XIcon className="size-3.5" />
          </span>
        )}
        <SelectPrimitive.Icon
          render={
            <ChevronsUpDownIcon className="pointer-events-none size-4 text-muted-foreground" />
          }
        />
      </span>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
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
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            "relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({ className, ...props }) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItemMedia({ avatar, icon, image, className }) {
  if (avatar) {
    return (
      <Avatar
        name={avatar.name || ""}
        src={avatar.src}
        size="sm"
        className={cn("size-7", className)}
      />
    )
  }

  if (image) {
    return (
      <span
        className={cn(
          "relative flex size-7 shrink-0 overflow-hidden rounded-full border border-border",
          className
        )}
      >
        <img src={image} alt="" className="size-full object-cover" />
      </span>
    )
  }

  if (icon) {
    if (typeof icon === "string") {
      return <Icon name={icon} className={cn("size-4 shrink-0 text-muted-foreground", className)} />
    }

    return <span className={cn("flex shrink-0 items-center", className)}>{icon}</span>
  }

  return null
}

function SelectItemContent({
  label,
  description,
  avatar,
  icon,
  image,
  className,
  truncate = true,
}) {
  return (
    <span className={cn("flex min-w-0 flex-1 items-center gap-2", className)}>
      <SelectItemMedia avatar={avatar} icon={icon} image={image} />
      <span className="flex min-w-0 flex-col text-left">
        <span className={cn(truncate ? "truncate" : "whitespace-nowrap")}>
          {label}
        </span>
        {description ? (
          <span
            className={cn(
              "text-xs text-muted-foreground group-data-selected/select-item:text-primary-foreground/80",
              truncate ? "truncate" : "whitespace-nowrap"
            )}
          >
            {description}
          </span>
        ) : null}
      </span>
    </span>
  )
}

function SelectItem({ className, children, ...props }) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "group/select-item relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none",
        "focus:bg-accent focus:text-accent-foreground",
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        "data-selected:bg-primary data-selected:text-primary-foreground",
        "data-selected:focus:bg-primary data-selected:focus:text-primary-foreground",
        "data-selected:data-highlighted:bg-primary data-selected:data-highlighted:text-primary-foreground",
        "not-data-[variant=destructive]:focus:**:text-accent-foreground",
        "data-selected:**:text-primary-foreground",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "*:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex min-w-0 flex-1 items-center gap-2">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon className="pointer-events-none size-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({ className, ...props }) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({ className, ...props }) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronUpIcon />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({ className, ...props }) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronDownIcon />
    </SelectPrimitive.ScrollDownArrow>
  )
}

function normalizeOption(option) {
  if (typeof option === "string") {
    return { value: option, label: option }
  }

  return {
    value: String(option.value),
    label: option.label ?? String(option.value),
    description: option.description,
    avatar: option.avatar,
    icon: option.icon,
    image: option.image,
    disabled: option.disabled,
  }
}

function SelectBox({
  label,
  required = false,
  value,
  onValueChange,
  options = [],
  placeholder = "Select...",
  clearable = false,
  disabled = false,
  error,
  className,
  triggerClassName,
  contentClassName,
  size = "default",
  variant = "default",
}) {
  const normalized = React.useMemo(
    () => options.map(normalizeOption),
    [options]
  )
  const selected = normalized.find((option) => option.value === String(value ?? ""))
  const hasValue = Boolean(selected)
  const isGroup = variant === "group"

  return (
    <div className={cn(isGroup ? "contents" : "space-y-0.5", className)}>
      {label && !isGroup ? (
        <Label className="mb-1 flex flex-row items-center text-label font-medium text-muted-foreground">
          {label}
          {required ? <span className="text-xs text-destructive">*</span> : null}
        </Label>
      ) : null}

      <Select
        value={hasValue ? selected.value : null}
        onValueChange={(next) => onValueChange?.(next ?? "")}
        disabled={disabled}
      >
        <SelectTrigger
          size={size}
          clearable={clearable && hasValue}
          onClear={() => onValueChange?.("")}
          aria-invalid={Boolean(error) || undefined}
          data-slot={isGroup ? "input-group-control" : "select-trigger"}
          className={cn(
            "h-control w-full min-w-0 dark:bg-input/30",
            isGroup &&
              "h-full w-auto max-w-none shrink-0 rounded-none border-0 bg-transparent px-3 shadow-none ring-0 focus-visible:border-transparent focus-visible:ring-0 *:data-[slot=select-value]:line-clamp-none dark:bg-transparent dark:hover:bg-transparent",
            triggerClassName
          )}
        >
          <SelectValue placeholder={placeholder}>
            {(current) => {
              const option = normalized.find((item) => item.value === String(current ?? ""))

              if (!option) {
                return (
                  <span className="whitespace-nowrap text-sm text-muted-foreground">
                    {placeholder}
                  </span>
                )
              }

              return (
                <SelectItemContent
                  label={option.label}
                  avatar={option.avatar}
                  icon={option.icon}
                  image={option.image}
                  truncate={!isGroup}
                  className={isGroup ? "min-w-0 flex-none" : undefined}
                />
              )
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          align="end"
          className={cn(
            "min-w-[var(--anchor-width)]",
            isGroup && "w-max",
            contentClassName
          )}
        >
          {normalized.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              <SelectItemContent
                label={option.label}
                description={option.description}
                avatar={option.avatar}
                icon={option.icon}
                image={option.image}
                truncate={!isGroup}
                className={isGroup ? "min-w-0 flex-none" : undefined}
              />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {error && !isGroup ? <div className="text-[13px] text-destructive">{error}</div> : null}
    </div>
  )
}

export {
  Select,
  SelectBox,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectItemContent,
  SelectItemMedia,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}

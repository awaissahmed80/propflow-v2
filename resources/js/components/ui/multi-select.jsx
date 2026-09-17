import * as React from "react"
import { ChevronsUpDownIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SelectItemContent } from "@/components/ui/select"
import { cn } from "@/lib/utils"

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

function MultiSelect({
  label,
  required = false,
  value = [],
  onValueChange,
  options = [],
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  clearable = true,
  disabled = false,
  error,
  className,
  triggerClassName,
  contentClassName,
  searchable = true,
}) {
  const [open, setOpen] = React.useState(false)
  const selectedValues = React.useMemo(
    () => (Array.isArray(value) ? value.map(String) : []),
    [value]
  )
  const normalized = React.useMemo(
    () => options.map(normalizeOption),
    [options]
  )
  const selectedOptions = normalized.filter((option) =>
    selectedValues.includes(option.value)
  )

  const toggleValue = (nextValue) => {
    if (selectedValues.includes(nextValue)) {
      onValueChange?.(selectedValues.filter((item) => item !== nextValue))
      return
    }

    onValueChange?.([...selectedValues, nextValue])
  }

  const removeValue = (nextValue, event) => {
    event?.preventDefault()
    event?.stopPropagation()
    onValueChange?.(selectedValues.filter((item) => item !== nextValue))
  }

  const clearAll = (event) => {
    event.preventDefault()
    event.stopPropagation()
    onValueChange?.([])
  }

  return (
    <div className={cn("space-y-0.5", className)}>
      {label ? (
        <Label className="mb-1 flex flex-row items-center text-label font-medium text-muted-foreground">
          {label}
          {required ? <span className="text-xs text-destructive">*</span> : null}
        </Label>
      ) : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          className={cn(
            "flex min-h-control w-full items-center gap-2 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
            "dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
            triggerClassName
          )}
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-left">
            {selectedOptions.length === 0 ? (
              <span className="text-sm text-muted-foreground">{placeholder}</span>
            ) : (
              selectedOptions.map((option) => (
                <Badge
                  key={option.value}
                  variant="outline"
                  className="h-6 gap-1 rounded-md border-border bg-muted/60 px-2 font-normal text-foreground"
                >
                  {option.label}
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Remove ${option.label}`}
                    className="inline-flex size-3.5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                    onClick={(event) => removeValue(option.value, event)}
                    onPointerDown={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                    }}
                  >
                    <XIcon className="size-3" />
                  </span>
                </Badge>
              ))
            )}
          </span>

          <span className="ml-auto flex shrink-0 items-center gap-1">
            {clearable && selectedOptions.length > 0 ? (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Clear selection"
                className="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                onClick={clearAll}
                onPointerDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
              >
                <XIcon className="size-3.5" />
              </span>
            ) : null}
            <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
          </span>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={4}
          className={cn(
            "w-(--anchor-width) min-w-(--anchor-width) gap-0 p-0",
            contentClassName
          )}
        >
          <Command>
            {searchable ? <CommandInput placeholder={searchPlaceholder} /> : null}
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {normalized.map((option) => {
                  const isSelected = selectedValues.includes(option.value)

                  return (
                    <CommandItem
                      key={option.value}
                      value={`${option.label} ${option.description ?? ""} ${option.value}`}
                      disabled={option.disabled}
                      data-checked={isSelected || undefined}
                      onSelect={() => toggleValue(option.value)}
                      className="bg-transparent data-[selected=true]:bg-transparent data-[selected=true]:text-foreground hover:bg-accent hover:text-accent-foreground data-[selected=true]:hover:bg-accent data-[selected=true]:hover:text-accent-foreground"
                    >
                      <SelectItemContent
                        label={option.label}
                        description={option.description}
                        avatar={option.avatar}
                        icon={option.icon}
                        image={option.image}
                      />
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {error ? <div className="text-[13px] text-destructive">{error}</div> : null}
    </div>
  )
}

export { MultiSelect }

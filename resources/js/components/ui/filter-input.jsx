import { Input } from "@/components/ui/input"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

function FilterInput({
  className,
  placeholder = "Filter...",
  value,
  onChange,
  clearable = true,
  ...props
}) {
  const hasValue = String(value ?? "").length > 0

  const clear = (event) => {
    event.preventDefault()
    event.stopPropagation()

    onChange?.({
      target: { value: "" },
      currentTarget: { value: "" },
    })
  }

  return (
    <div className={cn("w-64", className)}>
      <Input
        size="default"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        startElement={
          <Icon name="filter-3-line" className="text-base text-muted-foreground" />
        }
        endElement={
          clearable && hasValue ? (
            <button
              type="button"
              aria-label="Clear filter"
              className="mr-1.5 inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={clear}
            >
              <Icon name="close-line" className="text-base" />
            </button>
          ) : null
        }
        className="pr-1 text-sm placeholder:text-sm"
        {...props}
      />
    </div>
  )
}

export { FilterInput }

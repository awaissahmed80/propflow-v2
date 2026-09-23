"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { XIcon } from "lucide-react"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/**
 * @param {string | { value: string, label?: string, disabled?: boolean }} option
 */
function normalizeOption(option) {
  if (typeof option === "string") {
    return { value: option, label: option }
  }

  return {
    value: String(option.value),
    label: option.label ?? String(option.value),
    disabled: Boolean(option.disabled),
  }
}

/**
 * Autocomplete-style input: type freely, filter suggestions on focus.
 * New values are not persisted here — the form submit / backend should
 * remember unknown meta values when saving.
 *
 * @param {object} props
 * @param {string} [props.label]
 * @param {boolean} [props.required]
 * @param {string | null | undefined} [props.value]
 * @param {(value: string) => void} [props.onValueChange]
 * @param {Array<string | { value: string, label?: string }>} [props.options]
 * @param {string} [props.placeholder]
 * @param {boolean} [props.clearable]
 * @param {boolean} [props.disabled]
 * @param {string} [props.error]
 * @param {(open: boolean) => void} [props.onOpenChange]
 * @param {"default" | "group"} [props.variant]
 * @param {string} [props.className]
 * @param {string} [props.inputClassName]
 * @param {string} [props.id]
 * @param {string} [props.name]
 * @param {(event: React.FocusEvent<HTMLInputElement>) => void} [props.onBlur]
 */
function ComboBox({
  label,
  required = false,
  value = "",
  onValueChange,
  options = [],
  placeholder = "Type or select...",
  clearable = true,
  disabled = false,
  error,
  onOpenChange,
  variant = "default",
  className,
  inputClassName,
  id,
  name,
  onBlur,
}) {
  const containerRef = React.useRef(null)
  const triggerRef = React.useRef(null)
  const listRef = React.useRef(null)
  const [open, setOpen] = React.useState(false)
  const [highlightIndex, setHighlightIndex] = React.useState(-1)
  const [coords, setCoords] = React.useState(null)
  const [filterActive, setFilterActive] = React.useState(false)
  const isGroup = variant === "group"
  const draft = String(value ?? "")

  const localOptions = React.useMemo(
    () => options.map(normalizeOption),
    [options]
  )

  const filtered = React.useMemo(() => {
    if (!filterActive) {
      return localOptions
    }

    const needle = draft.trim().toLowerCase()

    if (!needle) {
      return localOptions
    }

    return localOptions.filter((option) =>
      option.label.toLowerCase().includes(needle)
    )
  }, [localOptions, draft, filterActive])

  const setOpenState = React.useCallback(
    (nextOpen) => {
      setOpen(nextOpen)
      onOpenChange?.(nextOpen)

      if (!nextOpen) {
        setHighlightIndex(-1)
      }
    },
    [onOpenChange]
  )

  const updatePosition = React.useCallback(() => {
    const trigger = triggerRef.current

    if (!trigger) {
      return
    }

    const rect = trigger.getBoundingClientRect()
    const gap = 4
    const maxHeight = 240
    const spaceBelow = window.innerHeight - rect.bottom - gap
    const spaceAbove = rect.top - gap
    const placeAbove = spaceBelow < Math.min(maxHeight, 120) && spaceAbove > spaceBelow
    const available = placeAbove ? spaceAbove : spaceBelow
    const height = Math.min(maxHeight, Math.max(available, 0))

    setCoords({
      top: placeAbove ? Math.max(gap, rect.top - gap - height) : rect.bottom + gap,
      left: rect.left,
      width: Math.max(rect.width, isGroup ? 192 : rect.width),
      maxHeight: height || maxHeight,
    })
  }, [isGroup])

  const showList = open && !disabled && filtered.length > 0

  React.useLayoutEffect(() => {
    if (!showList) {
      setCoords(null)
      return
    }

    updatePosition()

    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [showList, updatePosition, filtered.length, draft])

  React.useEffect(() => {
    if (!open) {
      return
    }

    const onPointerDown = (event) => {
      const target = event.target

      if (
        containerRef.current?.contains(target) ||
        listRef.current?.contains(target)
      ) {
        return
      }

      setOpenState(false)
    }

    document.addEventListener("pointerdown", onPointerDown)

    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
    }
  }, [open, setOpenState])

  React.useEffect(() => {
    setHighlightIndex(-1)
  }, [draft])

  const selectOption = (option) => {
    if (option.disabled) {
      return
    }

    setFilterActive(false)
    onValueChange?.(option.value)
    setOpenState(false)
  }

  const clearValue = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setFilterActive(false)
    onValueChange?.("")
    setOpenState(true)
  }

  const activeOption =
    highlightIndex >= 0 && highlightIndex < filtered.length
      ? filtered[highlightIndex]
      : null

  const listbox =
    showList && coords
      ? createPortal(
          <div
            ref={listRef}
            id={id ? `${id}-listbox` : undefined}
            role="listbox"
            className={cn(
              "fixed z-[100] overflow-hidden rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
            )}
            style={{
              top: coords.top,
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
            }}
          >
            <ul
              className="overflow-y-auto p-1"
              style={{ maxHeight: coords.maxHeight }}
            >
              {filtered.map((option, index) => {
                const isActive = index === highlightIndex
                const isSelected =
                  option.value.toLowerCase() === draft.trim().toLowerCase()

                return (
                  <li
                    key={option.value}
                    id={id ? `${id}-option-${index}` : undefined}
                    role="option"
                    aria-selected={isSelected || isActive}
                    data-disabled={option.disabled || undefined}
                    className={cn(
                      "relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none whitespace-nowrap",
                      "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
                      isActive && !isSelected && "bg-accent text-accent-foreground",
                      isSelected && "bg-primary text-primary-foreground"
                    )}
                    onMouseEnter={() => setHighlightIndex(index)}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      selectOption(option)
                    }}
                  >
                    {option.label}
                  </li>
                )
              })}
            </ul>
          </div>,
          document.body
        )
      : null

  return (
    <div
      ref={containerRef}
      className={cn(isGroup ? "relative contents" : "relative w-full space-y-0.5", className)}
    >
      {label && !isGroup ? (
        <Label
          htmlFor={id}
          className="mb-1 flex flex-row items-center text-label font-medium text-muted-foreground"
        >
          {label}
          {required ? <span className="text-xs text-destructive">*</span> : null}
        </Label>
      ) : null}

      <div
        ref={triggerRef}
        className={cn(
          "relative flex h-control items-center gap-1 rounded-md border border-input bg-transparent px-2.5 shadow-xs transition-[color,box-shadow]",
          "has-[input:focus-within]:border-ring has-[input:focus-within]:ring-[3px] has-[input:focus-within]:ring-ring/50",
          "dark:bg-input/30",
          error &&
            "border-destructive ring-destructive/20 dark:ring-destructive/40",
          disabled && "cursor-not-allowed opacity-50",
          isGroup &&
            "h-full rounded-none border-0 bg-transparent px-3 shadow-none ring-0 has-[input:focus-within]:border-transparent has-[input:focus-within]:ring-0 dark:bg-transparent"
        )}
      >
        <input
          id={id}
          name={name}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-autocomplete="list"
          aria-controls={id ? `${id}-listbox` : undefined}
          aria-activedescendant={
            activeOption && id ? `${id}-option-${highlightIndex}` : undefined
          }
          aria-invalid={Boolean(error) || undefined}
          data-slot={isGroup ? "input-group-control" : "combobox-input"}
          disabled={disabled}
          placeholder={placeholder}
          value={draft}
          autoComplete="off"
          onChange={(event) => {
            setFilterActive(true)
            onValueChange?.(event.target.value)
            setOpenState(true)
          }}
          onFocus={() => {
            if (!disabled) {
              setFilterActive(false)
              setOpenState(true)
            }
          }}
          onBlur={(event) => {
            // Keep open while interacting with the portaled list.
            if (listRef.current?.contains(event.relatedTarget)) {
              return
            }

            setOpenState(false)
            onBlur?.(event)
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpenState(false)
              return
            }

            if (event.key === "ArrowDown") {
              event.preventDefault()
              setOpenState(true)
              setHighlightIndex((current) =>
                Math.min(current + 1, Math.max(filtered.length - 1, 0))
              )
              return
            }

            if (event.key === "ArrowUp") {
              event.preventDefault()
              setHighlightIndex((current) => Math.max(current - 1, 0))
              return
            }

            if (event.key === "Enter" && activeOption) {
              event.preventDefault()
              selectOption(activeOption)
            }
          }}
          className={cn(
            "min-w-0 grow bg-transparent py-1 text-sm outline-none",
            "placeholder:text-sm placeholder:text-muted-foreground disabled:cursor-not-allowed",
            "selection:bg-primary selection:text-primary-foreground",
            inputClassName
          )}
        />

        {clearable && draft && !disabled ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Clear value"
            className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
            onMouseDown={(event) => {
              event.preventDefault()
              clearValue(event)
            }}
          >
            <XIcon className="size-3.5" />
          </button>
        ) : null}
      </div>

      {listbox}

      {error && !isGroup ? (
        <div className="text-[13px] text-destructive">{error}</div>
      ) : null}
    </div>
  )
}

export { ComboBox, normalizeOption }

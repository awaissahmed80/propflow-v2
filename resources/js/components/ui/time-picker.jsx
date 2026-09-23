"use client"

import * as React from "react"
import { ClockIcon } from "lucide-react"

import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const WHEEL_ITEM_HEIGHT = 36

/**
 * @param {number} value
 * @param {number} [pad]
 * @returns {string}
 */
function padNumber(value, pad = 2) {
  return String(value).padStart(pad, "0")
}

/**
 * @param {string | null | undefined} value
 * @returns {{ hours24: number, minutes: number } | null}
 */
function parseTimeValue(value) {
  if (!value || typeof value !== "string") {
    return null
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) {
    return null
  }

  const hours24 = Number(match[1])
  const minutes = Number(match[2])

  if (
    !Number.isFinite(hours24) ||
    !Number.isFinite(minutes) ||
    hours24 < 0 ||
    hours24 > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null
  }

  return { hours24, minutes }
}

/**
 * @param {number} hours24
 * @param {number} minutes
 * @returns {string}
 */
function toTimeValue(hours24, minutes) {
  return `${padNumber(hours24)}:${padNumber(minutes)}`
}

/**
 * @param {number} hours24
 * @returns {{ hour12: number, period: "AM" | "PM" }}
 */
function to12Hour(hours24) {
  const period = hours24 >= 12 ? "PM" : "AM"
  const hour12 = hours24 % 12 === 0 ? 12 : hours24 % 12

  return { hour12, period }
}

/**
 * @param {number} hour12
 * @param {"AM" | "PM"} period
 * @returns {number}
 */
function to24Hour(hour12, period) {
  if (period === "AM") {
    return hour12 === 12 ? 0 : hour12
  }

  return hour12 === 12 ? 12 : hour12 + 12
}

/**
 * @param {number} hours24
 * @param {number} minutes
 * @param {"12h" | "24h"} displayFormat
 * @returns {string}
 */
function formatDisplayTime(hours24, minutes, displayFormat) {
  if (displayFormat === "24h") {
    return toTimeValue(hours24, minutes)
  }

  const { hour12, period } = to12Hour(hours24)

  return `${padNumber(hour12)}:${padNumber(minutes)} ${period}`
}

/**
 * Wheel-style scroll column — selected value stays vertically centered.
 *
 * @param {object} props
 * @param {string} props.label
 * @param {Array<string | number>} props.options
 * @param {string | number} props.value
 * @param {(value: string | number) => void} props.onSelect
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.wheel]
 * @param {boolean} [props.showLabel]
 * @param {boolean} [props.hideHighlight] Shared highlight is drawn by parent
 */
function TimeColumn({
  label,
  options,
  value,
  onSelect,
  disabled = false,
  wheel = false,
  showLabel = true,
  hideHighlight = false,
}) {
  const scrollerRef = React.useRef(null)
  const padRef = React.useRef(0)
  const frameRef = React.useRef(0)
  const settleRef = React.useRef(0)
  const draggingRef = React.useRef(false)
  const [pad, setPad] = React.useState(0)

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => String(option) === String(value))
  )

  const scrollToIndex = React.useCallback((index, behavior = "auto") => {
    const scroller = scrollerRef.current

    if (!scroller) {
      return
    }

    scroller.scrollTo({
      top: index * WHEEL_ITEM_HEIGHT,
      behavior,
    })
  }, [])

  React.useLayoutEffect(() => {
    if (!wheel) {
      return undefined
    }

    const scroller = scrollerRef.current

    if (!scroller) {
      return undefined
    }

    const syncPad = () => {
      const nextPad = Math.max(
        0,
        Math.round((scroller.clientHeight - WHEEL_ITEM_HEIGHT) / 2)
      )

      if (nextPad !== padRef.current) {
        padRef.current = nextPad
        setPad(nextPad)
      }
    }

    syncPad()

    const observer = new ResizeObserver(syncPad)
    observer.observe(scroller)

    return () => observer.disconnect()
  }, [wheel])

  React.useLayoutEffect(() => {
    if (!wheel || pad <= 0 || draggingRef.current) {
      return
    }

    scrollToIndex(selectedIndex, "auto")
  }, [selectedIndex, pad, scrollToIndex, wheel])

  const commitFromScroll = React.useCallback(() => {
    const scroller = scrollerRef.current

    if (!scroller) {
      return
    }

    const index = Math.round(scroller.scrollTop / WHEEL_ITEM_HEIGHT)
    const clamped = Math.max(0, Math.min(options.length - 1, index))
    const next = options[clamped]

    scrollToIndex(clamped, "smooth")

    if (next !== undefined && String(next) !== String(value)) {
      onSelect(next)
    }
  }, [onSelect, options, scrollToIndex, value])

  const handleScroll = () => {
    if (!wheel) {
      return
    }

    draggingRef.current = true

    window.cancelAnimationFrame(frameRef.current)
    frameRef.current = window.requestAnimationFrame(() => {
      const scroller = scrollerRef.current

      if (!scroller) {
        return
      }

      const index = Math.round(scroller.scrollTop / WHEEL_ITEM_HEIGHT)
      const clamped = Math.max(0, Math.min(options.length - 1, index))
      const next = options[clamped]

      if (next !== undefined && String(next) !== String(value)) {
        onSelect(next)
      }
    })

    window.clearTimeout(settleRef.current)
    settleRef.current = window.setTimeout(() => {
      draggingRef.current = false
      commitFromScroll()
    }, 100)
  }

  if (!wheel) {
    return (
      <div className="flex min-w-14 flex-1 flex-col">
        {showLabel ? (
          <div className="shrink-0 px-1 pb-1 text-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </div>
        ) : null}
        <div className="h-40 overflow-y-auto rounded-md border border-border bg-muted/20">
          <div className="flex flex-col gap-0.5 p-1" role="listbox" aria-label={label}>
            {options.map((option) => {
              const selected = String(option) === String(value)

              return (
                <button
                  key={String(option)}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={disabled}
                  onClick={() => onSelect(option)}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-center text-sm transition-colors",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground",
                    disabled && "pointer-events-none opacity-50"
                  )}
                >
                  {typeof option === "number" ? padNumber(option) : option}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col self-stretch overflow-hidden">
      {showLabel ? (
        <div className="shrink-0 px-1 pb-2 text-center text-[11px] font-medium tracking-wide text-muted-foreground">
          {label}
        </div>
      ) : null}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {!hideHighlight ? (
          <div
            className="pointer-events-none absolute inset-x-1 top-1/2 z-10 h-9 -translate-y-1/2 rounded-md bg-primary/20"
            aria-hidden
          />
        ) : null}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-12 bg-gradient-to-b from-popover from-35% to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-12 bg-gradient-to-t from-popover from-35% to-transparent"
          aria-hidden
        />
        <div
          ref={scrollerRef}
          role="listbox"
          aria-label={label}
          onScroll={handleScroll}
          className="absolute inset-0 z-0 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div style={{ height: pad }} aria-hidden />
          {options.map((option, index) => {
            const selected = String(option) === String(value)

            return (
              <button
                key={String(option)}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={disabled}
                onClick={() => {
                  onSelect(option)
                  draggingRef.current = false
                  scrollToIndex(index, "smooth")
                }}
                style={{ height: WHEEL_ITEM_HEIGHT }}
                className={cn(
                  "box-border flex w-full shrink-0 items-center justify-center border-0 bg-transparent p-0 leading-none text-sm transition-colors",
                  selected
                    ? "font-semibold text-foreground"
                    : "font-normal text-muted-foreground",
                  disabled && "pointer-events-none opacity-50"
                )}
              >
                {typeof option === "number" ? padNumber(option) : option}
              </button>
            )
          })}
          <div style={{ height: pad }} aria-hidden />
        </div>
      </div>
    </div>
  )
}

/**
 * Custom time picker (no native HTML5 time input).
 * Value / onChange use `HH:mm` (24-hour) strings.
 *
 * @param {object} props
 * @param {string | null | undefined} [props.value]
 * @param {(value: string) => void} [props.onChange]
 * @param {string} [props.label]
 * @param {string} [props.placeholder]
 * @param {string} [props.error]
 * @param {boolean} [props.required]
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.inline] Render columns only (for embedding in DatePicker)
 * @param {boolean} [props.wheel] Wheel selector with centered selection
 * @param {"12h" | "24h"} [props.displayFormat]
 * @param {number} [props.minuteStep]
 * @param {string} [props.className]
 * @param {string} [props.triggerClassName]
 * @param {string} [props.id]
 */
function TimePicker({
  value,
  onChange,
  label,
  placeholder = "Select time...",
  error,
  required = false,
  disabled = false,
  inline = false,
  wheel = false,
  displayFormat = "12h",
  minuteStep = 5,
  className,
  triggerClassName,
  id,
}) {
  const [open, setOpen] = React.useState(false)
  const parsed = parseTimeValue(value)
  const hours24 = parsed?.hours24 ?? 9
  const minutes = parsed?.minutes ?? 0
  const { hour12, period } = to12Hour(hours24)

  const step = Math.max(1, Math.min(30, Number(minuteStep) || 5))
  const minuteOptions = React.useMemo(() => {
    const options = []
    for (let minute = 0; minute < 60; minute += step) {
      options.push(minute)
    }

    if (!options.includes(minutes)) {
      options.push(minutes)
      options.sort((a, b) => a - b)
    }

    return options
  }, [step, minutes])

  const hourOptions =
    displayFormat === "24h"
      ? Array.from({ length: 24 }, (_, index) => index)
      : Array.from({ length: 12 }, (_, index) => index + 1)

  const emit = (nextHours24, nextMinutes) => {
    onChange?.(toTimeValue(nextHours24, nextMinutes))
  }

  const wheelBody = (
    <div
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden px-2 pb-2 pt-2"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="grid shrink-0 grid-cols-[1fr_1fr_auto] gap-1 px-1 pb-1">
        <div className="text-center text-[11px] font-medium text-muted-foreground">
          Hours
        </div>
        <div className="text-center text-[11px] font-medium text-muted-foreground">
          Minutes
        </div>
        <div className="w-10" aria-hidden />
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          className="pointer-events-none absolute inset-x-1 top-1/2 z-10 h-9 -translate-y-1/2 rounded-md bg-primary/25"
          aria-hidden
        />
        <div className="absolute inset-0 z-0 flex min-h-0 gap-0">
          {displayFormat === "24h" ? (
            <TimeColumn
              label="Hours"
              options={hourOptions}
              value={hours24}
              disabled={disabled}
              wheel
              showLabel={false}
              hideHighlight
              onSelect={(nextHour) => emit(Number(nextHour), minutes)}
            />
          ) : (
            <TimeColumn
              label="Hours"
              options={hourOptions}
              value={hour12}
              disabled={disabled}
              wheel
              showLabel={false}
              hideHighlight
              onSelect={(nextHour) =>
                emit(to24Hour(Number(nextHour), period), minutes)
              }
            />
          )}
          <TimeColumn
            label="Minutes"
            options={minuteOptions}
            value={minutes}
            disabled={disabled}
            wheel
            showLabel={false}
            hideHighlight
            onSelect={(nextMinute) => emit(hours24, Number(nextMinute))}
          />
          {displayFormat === "12h" ? (
            <div className="w-10 shrink-0">
              <TimeColumn
                label="Period"
                options={["AM", "PM"]}
                value={period}
                disabled={disabled}
                wheel
                showLabel={false}
                hideHighlight
                onSelect={(nextPeriod) =>
                  emit(
                    to24Hour(hour12, /** @type {"AM" | "PM"} */ (nextPeriod)),
                    minutes
                  )
                }
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )

  const listBody = (
    <div
      className={cn("flex gap-2", inline ? "w-full" : "min-w-56 p-3")}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {displayFormat === "24h" ? (
        <TimeColumn
          label="Hour"
          options={hourOptions}
          value={hours24}
          disabled={disabled}
          onSelect={(nextHour) => emit(Number(nextHour), minutes)}
        />
      ) : (
        <TimeColumn
          label="Hour"
          options={hourOptions}
          value={hour12}
          disabled={disabled}
          onSelect={(nextHour) =>
            emit(to24Hour(Number(nextHour), period), minutes)
          }
        />
      )}
      <TimeColumn
        label="Min"
        options={minuteOptions}
        value={minutes}
        disabled={disabled}
        onSelect={(nextMinute) => emit(hours24, Number(nextMinute))}
      />
      {displayFormat === "12h" ? (
        <TimeColumn
          label="Period"
          options={["AM", "PM"]}
          value={period}
          disabled={disabled}
          onSelect={(nextPeriod) =>
            emit(to24Hour(hour12, /** @type {"AM" | "PM"} */ (nextPeriod)), minutes)
          }
        />
      ) : null}
    </div>
  )

  const body = wheel ? wheelBody : listBody

  if (inline) {
    return (
      <div
        className={cn(
          wheel ? "flex h-full min-h-0 w-full flex-col overflow-hidden" : "space-y-1.5",
          className
        )}
      >
        {label ? (
          <Label
            htmlFor={id}
            className="flex shrink-0 items-center text-xs font-medium text-muted-foreground"
          >
            {label}
            {required ? <span className="ml-0.5 text-sm text-destructive">*</span> : null}
          </Label>
        ) : null}
        {body}
        {error ? <div className="text-[13px] text-destructive">{error}</div> : null}
      </div>
    )
  }

  return (
    <div className={cn("w-full space-y-0.5", className)}>
      {label ? (
        <Label
          htmlFor={id}
          className="mb-1 flex flex-row items-center text-label font-medium text-muted-foreground"
        >
          {label}
          {required ? <span className="text-xs text-destructive">*</span> : null}
        </Label>
      ) : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          data-empty={!parsed}
          className={cn(
            "inline-flex h-control w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none",
            "hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "data-[empty=true]:text-muted-foreground",
            "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
            "dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
            triggerClassName
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <ClockIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className={cn("truncate", !parsed && "text-muted-foreground")}>
              {parsed
                ? formatDisplayTime(hours24, minutes, displayFormat)
                : placeholder}
            </span>
          </span>
        </PopoverTrigger>

        <PopoverContent align="start" side="bottom" className="w-auto overflow-hidden p-0">
          <div className="h-56 w-56">{body}</div>
        </PopoverContent>
      </Popover>

      {error ? <div className="text-[13px] text-destructive">{error}</div> : null}
    </div>
  )
}

export {
  TimePicker,
  parseTimeValue,
  toTimeValue,
  formatDisplayTime,
}

"use client"

import * as React from "react"
import { addYears, endOfYear, format, isValid, parse, startOfYear } from "date-fns"
import { CalendarIcon, XIcon } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  TimePicker,
  formatDisplayTime,
  parseTimeValue,
  toTimeValue,
} from "@/components/ui/time-picker"
import { cn } from "@/lib/utils"

const DEFAULT_YEARS_RANGE = 10

/**
 * @param {number} yearsRange
 * @returns {{ startMonth: Date, endMonth: Date }}
 */
function getYearBounds(yearsRange = DEFAULT_YEARS_RANGE) {
  const today = new Date()

  return {
    startMonth: startOfYear(addYears(today, -yearsRange)),
    endMonth: endOfYear(addYears(today, yearsRange)),
  }
}

/**
 * Parse a form value into a local Date.
 * Prefers `yyyy-MM-dd` / `yyyy-MM-ddTHH:mm` strings to avoid UTC timezone shifts.
 *
 * @param {string | Date | null | undefined} value
 * @returns {Date | undefined}
 */
function parseDateValue(value) {
  if (!value) {
    return undefined
  }

  if (value instanceof Date) {
    return isValid(value) ? value : undefined
  }

  const asString = String(value).trim()

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(asString)) {
    const parsedDateTime = parse(asString.slice(0, 16), "yyyy-MM-dd'T'HH:mm", new Date())

    return isValid(parsedDateTime) ? parsedDateTime : undefined
  }

  const asDate = asString.slice(0, 10)
  const parsed = parse(asDate, "yyyy-MM-dd", new Date())

  return isValid(parsed) ? parsed : undefined
}

/**
 * @param {Date | undefined} date
 * @returns {string}
 */
function toDateString(date) {
  if (!date || !isValid(date)) {
    return ""
  }

  return format(date, "yyyy-MM-dd")
}

/**
 * @param {Date | undefined} date
 * @returns {string}
 */
function toDateTimeString(date) {
  if (!date || !isValid(date)) {
    return ""
  }

  return format(date, "yyyy-MM-dd'T'HH:mm")
}

/**
 * @param {Date | undefined} date
 * @returns {string}
 */
function toTimeString(date) {
  if (!date || !isValid(date)) {
    return "09:00"
  }

  return toTimeValue(date.getHours(), date.getMinutes())
}

/**
 * @param {Date | undefined} date
 * @param {string} draftTime
 * @param {boolean} showTime
 * @param {"12h" | "24h"} timeFormat
 */
function getHeaderSummary(date, draftTime, showTime, timeFormat) {
  const displayDate = date ?? new Date()
  const parsedTime = parseTimeValue(draftTime) || {
    hours24: displayDate.getHours(),
    minutes: displayDate.getMinutes(),
  }

  return {
    year: format(displayDate, "yyyy"),
    weekdayDate: format(displayDate, "EEE, d MMMM"),
    time: showTime
      ? formatDisplayTime(parsedTime.hours24, parsedTime.minutes, timeFormat)
      : null,
  }
}

/**
 * Reusable date / datetime picker built from Calendar + Popover.
 * Value / onChange use `yyyy-MM-dd` strings (empty string when cleared),
 * or `yyyy-MM-ddTHH:mm` when `showTime` is enabled.
 *
 * @param {object} props
 * @param {string | Date | null | undefined} [props.value]
 * @param {(value: string) => void} [props.onChange]
 * @param {string} [props.label]
 * @param {string} [props.placeholder]
 * @param {string} [props.error]
 * @param {boolean} [props.required]
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.clearable]
 * @param {boolean} [props.showTime] Enable time selection (datetime mode)
 * @param {"12h" | "24h"} [props.timeFormat]
 * @param {number} [props.minuteStep]
 * @param {string} [props.displayFormat]
 * @param {Date} [props.fromDate] Earliest selectable day
 * @param {Date} [props.toDate] Latest selectable day
 * @param {number} [props.yearsRange] Years before/after today in the year dropdown (default 10)
 * @param {Date} [props.startMonth] Override earliest month in year/month dropdowns
 * @param {Date} [props.endMonth] Override latest month in year/month dropdowns
 * @param {"top" | "bottom" | "left" | "right"} [props.side]
 * @param {string} [props.className]
 * @param {string} [props.triggerClassName]
 * @param {string} [props.id]
 */
function DatePicker({
  value,
  onChange,
  label,
  placeholder = "Select Date...",
  error,
  required = false,
  disabled = false,
  clearable = true,
  showTime = false,
  timeFormat = "12h",
  minuteStep = 5,
  displayFormat,
  fromDate,
  toDate,
  yearsRange = DEFAULT_YEARS_RANGE,
  startMonth,
  endMonth,
  side = "bottom",
  className,
  triggerClassName,
  id,
}) {
  const [open, setOpen] = React.useState(false)
  const selected = parseDateValue(value)
  const [month, setMonth] = React.useState(selected)
  const [draftTime, setDraftTime] = React.useState(() => toTimeString(selected))
  const [calendarHeight, setCalendarHeight] = React.useState(null)
  const calendarRef = React.useRef(null)
  const yearBounds = getYearBounds(yearsRange)
  const resolvedStartMonth = startMonth ?? yearBounds.startMonth
  const resolvedEndMonth = endMonth ?? yearBounds.endMonth
  const resolvedDisplayFormat =
    displayFormat || (showTime ? "d MMM yyyy h:mm a" : "PPP")
  const header = getHeaderSummary(selected, draftTime, showTime, timeFormat)

  React.useEffect(() => {
    if (selected) {
      setMonth(selected)
      setDraftTime(toTimeString(selected))
    }
  }, [selected])

  React.useLayoutEffect(() => {
    if (!showTime || !open) {
      setCalendarHeight(null)
      return undefined
    }

    let frame = 0
    /** @type {ResizeObserver | null} */
    let observer = null

    const attach = () => {
      const node = calendarRef.current

      if (!node) {
        frame = window.requestAnimationFrame(attach)
        return
      }

      const syncHeight = () => {
        const next = Math.round(node.getBoundingClientRect().height)

        if (next > 0) {
          setCalendarHeight(next)
        }
      }

      syncHeight()
      observer = new ResizeObserver(syncHeight)
      observer.observe(node)
    }

    attach()

    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [showTime, open, month])

  const emitChange = (date) => {
    if (!date) {
      onChange?.("")
      return
    }

    onChange?.(showTime ? toDateTimeString(date) : toDateString(date))
  }

  const applyTimeToDate = (date, timeValue) => {
    const parsedTime = parseTimeValue(timeValue) || { hours24: 9, minutes: 0 }
    const next = new Date(date)
    next.setHours(parsedTime.hours24, parsedTime.minutes, 0, 0)

    return next
  }

  const handleSelect = (date) => {
    if (!date) {
      return
    }

    if (showTime) {
      emitChange(applyTimeToDate(date, draftTime))
      return
    }

    emitChange(date)
    setOpen(false)
  }

  const handleTimeChange = (nextTime) => {
    setDraftTime(nextTime)

    if (!selected) {
      return
    }

    emitChange(applyTimeToDate(selected, nextTime))
  }

  const handleClear = (event) => {
    event.preventDefault()
    event.stopPropagation()
    onChange?.("")
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
          data-empty={!selected}
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
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
            <span
              className={cn(
                "truncate",
                !selected && "text-sm text-muted-foreground"
              )}
            >
              {selected ? format(selected, resolvedDisplayFormat) : placeholder}
            </span>
          </span>

          <span className="flex shrink-0 items-center gap-1">
            {clearable && selected && !disabled ? (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Clear date"
                className="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                onClick={handleClear}
                onPointerDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
              >
                <XIcon className="size-3.5" />
              </span>
            ) : null}
          </span>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          side={side}
          sideOffset={4}
          className="w-auto overflow-hidden rounded-xl border-border/80 bg-popover p-0 shadow-lg"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">{header.year}</div>
              <div className="truncate text-base font-semibold tracking-tight text-foreground">
                {header.weekdayDate}
              </div>
              {header.time ? (
                <div className="mt-0.5 text-sm text-muted-foreground">{header.time}</div>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Close"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              <XIcon className="size-4" />
            </button>
          </div>

          <div
            className={cn(
              showTime && "flex flex-col sm:flex-row sm:items-start"
            )}
          >
            <div ref={calendarRef} className="shrink-0">
              <Calendar
                mode="single"
                captionLayout="dropdown"
                selected={selected}
                month={month}
                onMonthChange={setMonth}
                onSelect={handleSelect}
                defaultMonth={selected}
                startMonth={resolvedStartMonth}
                endMonth={resolvedEndMonth}
                formatters={{
                  formatMonthDropdown: (date) => format(date, "MMMM"),
                }}
                className="bg-transparent p-3"
                classNames={{
                  month: "flex w-full flex-col gap-3",
                  dropdowns: "flex h-(--cell-size) w-full items-center justify-center gap-2 text-sm font-medium",
                  today: "rounded-(--cell-radius) bg-muted/60 text-foreground",
                }}
                disabled={[
                  ...(fromDate ? [{ before: fromDate }] : []),
                  ...(toDate ? [{ after: toDate }] : []),
                ]}
              />
            </div>

            {showTime ? (
              <div
                className="flex w-full min-h-0 shrink-0 flex-col overflow-hidden border-t border-border/70 bg-popover sm:w-[11.5rem] sm:border-t-0 sm:border-l"
                style={
                  calendarHeight
                    ? { height: `${calendarHeight}px`, maxHeight: `${calendarHeight}px` }
                    : { height: "18rem" }
                }
              >
                <TimePicker
                  inline
                  wheel
                  className="h-full min-h-0 w-full overflow-hidden"
                  id={id ? `${id}-time` : undefined}
                  value={draftTime}
                  onChange={handleTimeChange}
                  disabled={disabled}
                  displayFormat={timeFormat}
                  minuteStep={minuteStep}
                />
              </div>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>

      {error ? <div className="text-[13px] text-destructive">{error}</div> : null}
    </div>
  )
}

/**
 * Date + time picker. Same API as DatePicker with `showTime` enabled.
 *
 * @param {object} props
 */
function DateTimePicker(props) {
  return <DatePicker {...props} showTime />
}

export {
  DatePicker,
  DateTimePicker,
  parseDateValue,
  toDateString,
  toDateTimeString,
}

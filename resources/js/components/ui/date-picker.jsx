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
import { TimePicker, parseTimeValue, toTimeValue } from "@/components/ui/time-picker"
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
  const yearBounds = getYearBounds(yearsRange)
  const resolvedStartMonth = startMonth ?? yearBounds.startMonth
  const resolvedEndMonth = endMonth ?? yearBounds.endMonth
  const resolvedDisplayFormat =
    displayFormat || (showTime ? "d MMM yyyy h:mm a" : "PPP")

  React.useEffect(() => {
    if (selected) {
      setMonth(selected)
      setDraftTime(toTimeString(selected))
    }
  }, [selected])

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
          className="w-auto overflow-hidden p-0"
        >
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
            disabled={[
              ...(fromDate ? [{ before: fromDate }] : []),
              ...(toDate ? [{ after: toDate }] : []),
            ]}
          />

          {showTime ? (
            <div className="border-t border-border px-3 py-2.5">
              <TimePicker
                inline
                id={id ? `${id}-time` : undefined}
                label="Time"
                value={draftTime}
                onChange={handleTimeChange}
                disabled={disabled}
                displayFormat={timeFormat}
                minuteStep={minuteStep}
              />
            </div>
          ) : null}
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

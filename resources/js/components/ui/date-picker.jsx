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
 * Prefers `yyyy-MM-dd` strings to avoid UTC timezone shifts.
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

  const asString = String(value).slice(0, 10)
  const parsed = parse(asString, "yyyy-MM-dd", new Date())

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
 * Reusable date picker built from Calendar + Popover.
 * Value / onChange use `yyyy-MM-dd` strings (empty string when cleared).
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
 * @param {string} [props.displayFormat]
 * @param {Date} [props.fromDate] Earliest selectable day
 * @param {Date} [props.toDate] Latest selectable day
 * @param {number} [props.yearsRange] Years before/after today in the year dropdown (default 10)
 * @param {Date} [props.startMonth] Override earliest month in year/month dropdowns
 * @param {Date} [props.endMonth] Override latest month in year/month dropdowns
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
  displayFormat = "PPP",
  fromDate,
  toDate,
  yearsRange = DEFAULT_YEARS_RANGE,
  startMonth,
  endMonth,
  className,
  triggerClassName,
  id,
}) {
  const [open, setOpen] = React.useState(false)
  const selected = parseDateValue(value)
  const [month, setMonth] = React.useState(selected)
  const yearBounds = getYearBounds(yearsRange)
  const resolvedStartMonth = startMonth ?? yearBounds.startMonth
  const resolvedEndMonth = endMonth ?? yearBounds.endMonth

  React.useEffect(() => {
    if (selected) {
      setMonth(selected)
    }
  }, [selected])

  const handleSelect = (date) => {
    onChange?.(toDateString(date))
    setOpen(false)
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
          className="mb-0.5 flex flex-row items-center text-base font-medium text-muted-foreground"
        >
          {label}
          {required ? <span className="text-sm text-destructive">*</span> : null}
        </Label>
      ) : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          data-empty={!selected}
          className={cn(
            "inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none",
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
                !selected && "text-base text-muted-foreground"
              )}
            >
              {selected ? format(selected, displayFormat) : placeholder}
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
        </PopoverContent>
      </Popover>

      {error ? <div className="text-[13px] text-destructive">{error}</div> : null}
    </div>
  )
}

export { DatePicker, parseDateValue, toDateString }

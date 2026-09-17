"use client"

import * as React from "react"
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/**
 * @param {unknown} value
 * @returns {string}
 */
function toDisplayValue(value) {
  if (value === "" || value === null || value === undefined) {
    return ""
  }

  if (typeof value === "number" && Number.isNaN(value)) {
    return ""
  }

  return String(value)
}

/**
 * @param {string} raw
 * @param {{ allowDecimal?: boolean, allowNegative?: boolean }} options
 * @returns {string}
 */
function sanitizeNumericInput(raw, { allowDecimal = false, allowNegative = false } = {}) {
  let next = String(raw ?? "")

  if (allowNegative) {
    next = next.replace(/(?!^)-/g, "").replace(/[^\d.-]/g, "")
    if (next.indexOf("-") > 0) {
      next = next.replace(/-/g, "")
    }
  } else {
    next = next.replace(/[^\d.]/g, "")
  }

  if (!allowDecimal) {
    return next.replace(/\./g, "")
  }

  const firstDot = next.indexOf(".")
  if (firstDot === -1) {
    return next
  }

  return (
    next.slice(0, firstDot + 1) +
    next.slice(firstDot + 1).replace(/\./g, "")
  )
}

/**
 * @param {string} raw
 * @returns {number | null}
 */
function parseNumber(raw) {
  if (raw === "" || raw === "-" || raw === "." || raw === "-.") {
    return null
  }

  const parsed = Number(raw)

  return Number.isFinite(parsed) ? parsed : null
}

/**
 * @param {number} value
 * @param {number | undefined} min
 * @param {number | undefined} max
 * @returns {number}
 */
function clamp(value, min, max) {
  let next = value

  if (typeof min === "number" && Number.isFinite(min)) {
    next = Math.max(min, next)
  }

  if (typeof max === "number" && Number.isFinite(max)) {
    next = Math.min(max, next)
  }

  return next
}

/**
 * @param {number} value
 * @param {number} step
 * @returns {number}
 */
function roundToStep(value, step) {
  if (!step || step <= 0) {
    return value
  }

  const decimals = String(step).includes(".")
    ? String(step).split(".")[1].length
    : 0
  const rounded = Math.round(value / step) * step

  return Number(rounded.toFixed(decimals))
}

/**
 * Reusable numeric input with optional steppers and suffix.
 * `value` / `onChange` use `number | null` (null when empty).
 *
 * @param {object} props
 * @param {number | string | null | undefined} [props.value]
 * @param {(value: number | null) => void} [props.onChange]
 * @param {string} [props.label]
 * @param {string} [props.error]
 * @param {boolean} [props.required]
 * @param {boolean} [props.disabled]
 * @param {string} [props.placeholder]
 * @param {number} [props.min]
 * @param {number} [props.max]
 * @param {number} [props.step]
 * @param {boolean} [props.allowDecimal]
 * @param {boolean} [props.allowNegative]
 * @param {boolean} [props.showSteppers]
 * @param {"default" | "group"} [props.variant]
 * @param {React.ReactNode} [props.suffix]
 * @param {React.ReactNode} [props.startElement]
 * @param {string} [props.className]
 * @param {string} [props.inputClassName]
 * @param {string} [props.id]
 * @param {string} [props.name]
 * @param {(event: React.FocusEvent<HTMLInputElement>) => void} [props.onBlur]
 */
function NumberInput({
  value,
  onChange,
  label,
  error,
  required = false,
  disabled = false,
  placeholder,
  min,
  max,
  step = 1,
  allowDecimal = false,
  allowNegative = false,
  showSteppers = true,
  variant = "default",
  suffix,
  startElement,
  className,
  inputClassName,
  id,
  name,
  onBlur,
}) {
  const [draft, setDraft] = React.useState(() => toDisplayValue(value))
  const isGroup = variant === "group"

  React.useEffect(() => {
    setDraft(toDisplayValue(value))
  }, [value])

  const emit = (next) => {
    onChange?.(next)
  }

  const handleChange = (event) => {
    const nextDraft = sanitizeNumericInput(event.target.value, {
      allowDecimal,
      allowNegative: allowNegative || (typeof min === "number" && min < 0),
    })
    setDraft(nextDraft)

    const parsed = parseNumber(nextDraft)
    if (parsed === null) {
      emit(null)
      return
    }

    emit(parsed)
  }

  const commit = (raw = draft) => {
    const parsed = parseNumber(raw)

    if (parsed === null) {
      setDraft("")
      emit(null)
      return
    }

    const next = clamp(roundToStep(parsed, step), min, max)
    setDraft(String(next))
    emit(next)
  }

  const handleBlur = (event) => {
    commit()
    onBlur?.(event)
  }

  const nudge = (direction) => {
    if (disabled) {
      return
    }

    const current = parseNumber(draft)
    const base =
      current === null
        ? typeof min === "number"
          ? min
          : 0
        : current
    const next = clamp(roundToStep(base + direction * step, step), min, max)

    setDraft(String(next))
    emit(next)
  }

  const canDecrement =
    !disabled &&
    (parseNumber(draft) === null ||
      typeof min !== "number" ||
      (parseNumber(draft) ?? min) > min)

  const canIncrement =
    !disabled &&
    (parseNumber(draft) === null ||
      typeof max !== "number" ||
      (parseNumber(draft) ?? max) < max)

  const control = (
    <>
      {startElement ? (
        <div className="shrink-0 select-none text-sm text-muted-foreground">
          {startElement}
        </div>
      ) : null}

      <input
        id={id}
        name={name}
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        role="spinbutton"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={parseNumber(draft) ?? undefined}
        aria-invalid={Boolean(error) || undefined}
        data-slot={isGroup ? "input-group-control" : "input"}
        disabled={disabled}
        placeholder={placeholder}
        value={draft}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") {
            event.preventDefault()
            nudge(1)
          }
          if (event.key === "ArrowDown") {
            event.preventDefault()
            nudge(-1)
          }
          if (event.key === "Enter") {
            commit()
          }
        }}
        className={cn(
          "min-w-0 grow bg-transparent py-1 text-sm outline-none",
          "placeholder:text-sm placeholder:text-muted-foreground disabled:cursor-not-allowed",
          "selection:bg-primary selection:text-primary-foreground",
          isGroup && "h-full px-2.5",
          inputClassName
        )}
      />

      {suffix ? (
        <span className="shrink-0 select-none pr-1 text-sm text-muted-foreground">
          {suffix}
        </span>
      ) : null}

      {showSteppers ? (
        <div className="flex shrink-0 flex-col overflow-hidden rounded-sm border border-border">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Increase value"
            disabled={!canIncrement}
            className="inline-flex h-3.5 w-6 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            onClick={() => nudge(1)}
          >
            <ChevronUpIcon className="size-3" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Decrease value"
            disabled={!canDecrement}
            className="inline-flex h-3.5 w-6 items-center justify-center border-t border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            onClick={() => nudge(-1)}
          >
            <ChevronDownIcon className="size-3" />
          </button>
        </div>
      ) : null}
    </>
  )

  if (isGroup) {
    return (
      <div
        className={cn(
          "relative flex h-full min-w-0 flex-1 items-center",
          disabled && "pointer-events-none opacity-50",
          className
        )}
      >
        {control}
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

      <div
        className={cn(
          "flex h-control items-center gap-1 rounded-md border border-input bg-transparent px-2 shadow-xs transition-[color,box-shadow]",
          "has-[input:focus-within]:border-ring has-[input:focus-within]:ring-[1px] has-[input:focus-within]:ring-ring/50",
          "dark:bg-input/30",
          error &&
            "border-destructive ring-destructive/20 dark:ring-destructive/40",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        {control}
      </div>

      {error ? <div className="text-[13px] text-destructive">{error}</div> : null}
    </div>
  )
}

export { NumberInput }

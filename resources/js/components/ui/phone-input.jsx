import { useCallback, useEffect, useRef } from "react"
import useInputMask from "@/hooks/use-input-mask"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/** E.164 allows at most 15 digits (country code + subscriber number). */
const MAX_PHONE_DIGITS = 15

/**
 * Single-field international phone mask.
 * Allows an optional leading "+", then up to 15 digits (any country).
 *
 * @param {string} rawValue
 * @returns {Array<string|RegExp>}
 */
function flexiblePhoneMask(rawValue) {
  const value = String(rawValue ?? "")
  const hasPlus = value.trimStart().startsWith("+")
  const digits = value.replace(/\D/g, "").slice(0, MAX_PHONE_DIGITS)

  if (!hasPlus && digits.length === 0) {
    // First keystroke may be "+" or a digit.
    return [/[+\d]/]
  }

  const mask = []

  if (hasPlus) {
    mask.push("+")
  }

  const slots = Math.min(
    Math.max(digits.length + 1, 1),
    MAX_PHONE_DIGITS
  )

  for (let index = 0; index < slots; index += 1) {
    mask.push(/\d/)
  }

  return mask
}

/**
 * Normalize to optional "+" + digits only.
 *
 * @param {string} value
 * @returns {string}
 */
function normalizePhoneNumber(value = "") {
  const raw = String(value ?? "").trim()

  if (!raw) {
    return ""
  }

  const hasPlus = raw.startsWith("+")
  const digits = raw.replace(/\D/g, "").slice(0, MAX_PHONE_DIGITS)

  if (!digits) {
    return hasPlus ? "+" : ""
  }

  return hasPlus ? `+${digits}` : digits
}

function PhoneInput({
  label = "Phone Number",
  required = false,
  value = "",
  onChange,
  onBlur,
  error,
  disabled = false,
  className,
  placeholder = "+1234567890",
  name,
  id,
  autoComplete = "tel",
}) {
  const inputRef = useRef(null)
  const displayValue = normalizePhoneNumber(value)
  const mask = useCallback((rawValue) => flexiblePhoneMask(rawValue), [])

  const handleMaskedChange = useInputMask({
    input: inputRef,
    mask,
    guide: false,
    showMask: false,
    keepCharPositions: false,
    initialValue: displayValue,
    onChange: (event) => {
      onChange?.(normalizePhoneNumber(event.target.value))
    },
  })

  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== displayValue) {
      inputRef.current.value = displayValue
    }
  }, [displayValue])

  return (
    <div className={cn("space-y-0.5", className)}>
      {label ? (
        <Label className="mb-0.5 flex flex-row items-center text-base font-medium text-muted-foreground">
          {label}
          {required ? <span className="text-sm text-destructive">*</span> : null}
        </Label>
      ) : null}

      <div
        className={cn(
          "flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 shadow-xs transition-[color,box-shadow]",
          "has-[input:focus-within]:border-ring has-[input:focus-within]:ring-[1px] has-[input:focus-within]:ring-ring/50",
          "dark:bg-input/30",
          error &&
            "border-destructive ring-destructive/20 has-[input:focus-within]:border-destructive has-[input:focus-within]:ring-destructive/20 dark:ring-destructive/40",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete={autoComplete}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          defaultValue={displayValue}
          onChange={handleMaskedChange}
          onBlur={onBlur}
          className={cn(
            "min-w-0 grow bg-transparent text-base outline-none",
            "placeholder:text-base placeholder:text-muted-foreground disabled:cursor-not-allowed"
          )}
        />
      </div>

      {error ? <div className="text-[13px] text-destructive">{error}</div> : null}
    </div>
  )
}

export { PhoneInput, flexiblePhoneMask, normalizePhoneNumber }

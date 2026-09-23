"use client"

import { useEffect, useMemo, useState } from "react"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { HeatIconButton } from "@/components/ui/heat-icon"
import { Icon } from "@/components/ui/icon"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { heatMeta } from "@/lib/heat"
import { cn } from "@/lib/utils"
import { StageBadge } from "@/components/ui/stage-badge"

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function toSelectedList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean)
  }

  if (value == null || value === "") {
    return []
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

/**
 * @param {{ min?: number, max?: number }} section
 * @returns {[number, number]}
 */
function sectionBounds(section) {
  const min = Number(section.min ?? 0)
  const max = Number(section.max ?? 100)

  return [min, Math.max(min, max)]
}

/**
 * @param {unknown} value
 * @param {{ min?: number, max?: number }} section
 * @returns {[number, number]}
 */
function toRangeValue(value, section) {
  const [min, max] = sectionBounds(section)

  if (Array.isArray(value) && value.length >= 2) {
    const start = Number(value[0])
    const end = Number(value[1])

    if (Number.isFinite(start) && Number.isFinite(end)) {
      return [
        Math.min(Math.max(start, min), max),
        Math.min(Math.max(end, min), max),
      ]
    }
  }

  return [min, max]
}

/**
 * @param {[number, number]} range
 * @param {{ min?: number, max?: number }} section
 * @returns {boolean}
 */
function isRangeActive(range, section) {
  const [min, max] = sectionBounds(section)

  return range[0] > min || range[1] < max
}

/**
 * @param {number} value
 * @returns {string}
 */
function formatRangeMoney(value) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value) || 0)
}

/**
 * @param {[number, number]} range
 * @returns {string}
 */
function formatRangeLabel(range) {
  return `${formatRangeMoney(range[0])} – ${formatRangeMoney(range[1])}`
}

/**
 * @param {string[]} list
 * @param {string} next
 * @returns {boolean}
 */
function isSelected(list, next) {
  return list.includes(String(next))
}

/**
 * @param {Array<object>} sections
 * @param {Record<string, unknown>} value
 * @returns {Record<string, string[] | [number, number]>}
 */
function normalizeFilterValue(sections, value = {}) {
  const next = {}

  sections.forEach((section) => {
    if (section.type === "range") {
      next[section.key] = toRangeValue(value[section.key], section)
    } else {
      next[section.key] = toSelectedList(value[section.key])
    }
  })

  return next
}

/**
 * @param {Array<object>} sections
 * @returns {Record<string, string[] | [number, number]>}
 */
function emptyFilterValue(sections) {
  const next = {}

  sections.forEach((section) => {
    if (section.type === "range") {
      next[section.key] = sectionBounds(section)
    } else {
      next[section.key] = []
    }
  })

  return next
}

/**
 * @param {Record<string, string[] | [number, number]>} value
 * @param {Array<object>} sections
 * @returns {number}
 */
function countActiveFilters(value, sections) {
  return sections.reduce((total, section) => {
    if (section.type === "range") {
      return (
        total +
        (isRangeActive(toRangeValue(value[section.key], section), section)
          ? 1
          : 0)
      )
    }

    return total + toSelectedList(value[section.key]).length
  }, 0)
}

/**
 * @param {object} props
 * @param {boolean} props.selected
 * @param {() => void} props.onClick
 * @param {string} [props.className]
 * @param {import("react").ReactNode} props.children
 */
function FilterChip({ selected, onClick, className, children }) {
  return (
    <button
      type="button"
      data-selected={selected ? "true" : "false"}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-[13px] transition-colors",
        selected
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-background text-foreground hover:bg-muted/50",
        className
      )}
    >
      {children}
    </button>
  )
}

/**
 * @param {object} props
 * @param {object} props.section
 * @param {string[] | [number, number]} props.value
 * @param {(next: string) => void} props.onToggle
 * @param {(next: [number, number]) => void} props.onRangeChange
 */
function FilterSectionOptions({ section, value, onToggle, onRangeChange }) {
  const type = section.type || "chips"

  if (type === "range") {
    const [min, max] = sectionBounds(section)
    const range = toRangeValue(value, section)

    return (
      <div className="space-y-2 pt-0.5">
        <div className="flex items-center justify-between text-xs tabular-nums text-muted-foreground">
          <span>{formatRangeMoney(range[0])}</span>
          <span>{formatRangeMoney(range[1])}</span>
        </div>
        <Slider
          value={range}
          min={min}
          max={max}
          step={section.step ?? Math.max(1, Math.round((max - min) / 100))}
          onValueChange={(next) => {
            const resolved = Array.isArray(next) ? next : [min, max]
            onRangeChange([
              Number(resolved[0]) || min,
              Number(resolved[1]) || max,
            ])
          }}
        />
      </div>
    )
  }

  const selectedValues = toSelectedList(value)

  if (type === "people") {
    return (
      <div className="space-y-0.5">
        {section.options.map((option) => {
          const selected = isSelected(selectedValues, option.value)

          return (
            <button
              key={`${section.key}-${option.value}`}
              type="button"
              onClick={() => onToggle(option.value)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors",
                selected
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-transparent text-foreground hover:bg-muted/50"
              )}
            >
              <Avatar
                name={option.label}
                src={option.avatar || undefined}
                size="sm"
                className="size-5"
                textClass="text-[9px]"
              />
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {selected ? (
                <Icon name="check-line" className="shrink-0 text-sm text-primary" />
              ) : null}
            </button>
          )
        })}
      </div>
    )
  }

  if (type === "projects") {
    return (
      <div className="space-y-0.5">
        {section.options.map((option) => {
          const selected = isSelected(selectedValues, option.value)

          return (
            <button
              key={`${section.key}-${option.value}`}
              type="button"
              onClick={() => onToggle(option.value)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors",
                selected
                  ? "border-primary/40 bg-primary/10"
                  : "border-transparent hover:bg-muted/50"
              )}
            >
              {option.thumbnail ? (
                <img
                  src={option.thumbnail}
                  alt=""
                  className="size-5 shrink-0 rounded-md object-cover"
                />
              ) : (
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-md",
                    selected
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon name="community-line" className="text-sm" />
                </span>
              )}
              <span
                className={cn(
                  "min-w-0 flex-1 truncate",
                  selected ? "font-medium text-primary" : "text-foreground"
                )}
              >
                {option.label}
              </span>
              {selected ? (
                <Icon name="check-line" className="shrink-0 text-sm text-primary" />
              ) : null}
            </button>
          )
        })}
      </div>
    )
  }

  if (type === "heat") {
    return (
      <TooltipProvider delay={200}>
        <div className="flex flex-wrap gap-1.5">
          {section.options.map((option) => {
            const selected = isSelected(selectedValues, option.value)

            return (
              <HeatIconButton
                key={`${section.key}-${option.value}`}
                tag={option.value}
                selected={selected}
                onClick={() => onToggle(option.value)}
              />
            )
          })}
        </div>
      </TooltipProvider>
    )
  }

  if (type === "icons") {
    return (
      <TooltipProvider delay={200}>
        <div className="flex flex-wrap gap-1.5">
          {section.options.map((option) => {
            const selected = isSelected(selectedValues, option.value)
            const color = option.color || "var(--muted-foreground)"

            return (
              <Tooltip key={`${section.key}-${option.value}`}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      data-selected={selected ? "true" : "false"}
                      aria-label={option.label}
                      aria-pressed={selected}
                      onClick={() => onToggle(option.value)}
                      className={cn(
                        "inline-flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors",
                        selected
                          ? "border-primary/40 bg-primary/10 ring-1 ring-primary/30"
                          : "border-border bg-background opacity-80 hover:bg-muted/50 hover:opacity-100"
                      )}
                    >
                      <Icon
                        name={option.icon || "circle-line"}
                        className="text-base leading-none"
                        style={{ color }}
                      />
                    </button>
                  }
                />
                <TooltipContent side="top">{option.label}</TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </TooltipProvider>
    )
  }

  if (type === "stage") {
    return (
      <div className="flex flex-wrap gap-1.5">
        {section.options.map((option) => {
          const selected = isSelected(selectedValues, option.value)

          return (
            <StageBadge
              key={`${section.key}-${option.value}`}
              as="button"
              type="button"
              label={option.label}
              color={option.color}
              selected={selected}
              onClick={() => onToggle(option.value)}
              className={cn(
                "cursor-pointer outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                !selected && "hover:bg-muted/50"
              )}
            />
          )
        })}
      </div>
    )
  }

  if (type === "status") {
    return (
      <div className="flex flex-wrap gap-1.5">
        {section.options.map((option) => {
          const selected = isSelected(selectedValues, option.value)

          return (
            <FilterChip
              key={`${section.key}-${option.value}`}
              selected={selected}
              onClick={() => onToggle(option.value)}
            >
              <span
                className="size-1.5 shrink-0 rounded-sm"
                style={{
                  backgroundColor: option.color || "var(--muted-foreground)",
                }}
                aria-hidden
              />
              {option.label}
            </FilterChip>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {(section.options || []).map((option) => {
        const selected = isSelected(selectedValues, option.value)

        return (
          <FilterChip
            key={`${section.key}-${option.value}`}
            selected={selected}
            onClick={() => onToggle(option.value)}
          >
            {option.label}
          </FilterChip>
        )
      })}
    </div>
  )
}

/**
 * Multi-select typed filter popover with optional range sliders.
 */
function FilterMenu({ sections = [], value = {}, onApply, className }) {
  const normalizedValue = useMemo(
    () => normalizeFilterValue(sections, value),
    [sections, value]
  )

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(normalizedValue)

  useEffect(() => {
    if (open) {
      setDraft(normalizedValue)
    }
  }, [open, normalizedValue])

  const activeCount = useMemo(
    () => countActiveFilters(normalizedValue, sections),
    [normalizedValue, sections]
  )

  const toggleSectionValue = (key, next) => {
    const incoming = String(next ?? "")

    setDraft((current) => {
      const existing = toSelectedList(current[key])
      const hasValue = existing.includes(incoming)

      return {
        ...current,
        [key]: hasValue
          ? existing.filter((item) => item !== incoming)
          : [...existing, incoming],
      }
    })
  }

  const setRangeValue = (key, next) => {
    setDraft((current) => ({
      ...current,
      [key]: next,
    }))
  }

  const handleClearAll = () => {
    const cleared = emptyFilterValue(sections)

    setDraft(cleared)
    onApply?.(cleared)
    setOpen(false)
  }

  const handleCancel = () => {
    setDraft(normalizedValue)
    setOpen(false)
  }

  const handleApply = () => {
    onApply?.(normalizeFilterValue(sections, draft))
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "inline-flex h-control items-center gap-1.5 rounded-md border border-input bg-transparent px-2.5 text-sm text-foreground shadow-xs transition-colors outline-none",
          "hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "data-popup-open:border-ring",
          className
        )}
      >
        <Icon name="filter-3-line" className="text-base text-muted-foreground" />
        <span>Filters</span>
        {activeCount > 0 ? (
          <span className="flex size-5 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
            {activeCount}
          </span>
        ) : null}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-80 gap-0 overflow-hidden rounded-md p-0 sm:w-88"
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <h3 className="text-sm font-bold tracking-tight text-foreground">Filters</h3>
          <button
            type="button"
            className="text-sm font-medium text-primary transition-opacity hover:opacity-80"
            onClick={handleClearAll}
          >
            Clear all
          </button>
        </div>

        <div className="max-h-80 space-y-3 overflow-y-auto px-3 py-3">
          {sections.map((section) => (
            <div key={section.key} className="space-y-1.5">
              <div className="text-sm font-bold tracking-tight text-muted-foreground">
                {section.label}
              </div>
              <FilterSectionOptions
                section={section}
                value={draft[section.key]}
                onToggle={(next) => toggleSectionValue(section.key, next)}
                onRangeChange={(next) => setRangeValue(section.key, next)}
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-1.5 border-t border-border p-2">
          <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleApply}>
            Apply filters
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Removable chips showing currently applied filter selections.
 * Multi-select groups are combined, e.g. "Stage: New, Contacted".
 */
function ActiveFilters({ sections = [], value = {}, onChange, onClear, className }) {
  const chips = useMemo(() => {
    const items = []

    sections.forEach((section) => {
      if (section.type === "range") {
        const range = toRangeValue(value[section.key], section)

        if (!isRangeActive(range, section)) {
          return
        }

        items.push({
          key: section.key,
          values: [`${range[0]}-${range[1]}`],
          sectionLabel: section.label,
          optionLabel: formatRangeLabel(range),
          kind: "range",
        })

        return
      }

      const selected = toSelectedList(value[section.key])

      if (selected.length === 0) {
        return
      }

      const labels = selected.map((selectedValue) => {
        const option = (section.options || []).find(
          (entry) => String(entry.value) === String(selectedValue)
        )

        return option?.label || String(selectedValue)
      })

      items.push({
        key: section.key,
        values: selected,
        sectionLabel: section.label,
        optionLabel: labels.join(", "),
        kind:
          section.type === "heat"
            ? "heat"
            : section.type === "stage"
              ? "stage"
              : section.type === "icons"
                ? "icons"
                : "list",
        stageOptions:
          section.type === "stage"
            ? selected.map((selectedValue) => {
                const option = (section.options || []).find(
                  (entry) => String(entry.value) === String(selectedValue)
                )

                return {
                  value: selectedValue,
                  label: option?.label || String(selectedValue),
                  color: option?.color,
                }
              })
            : undefined,
        iconOptions:
          section.type === "icons"
            ? selected.map((selectedValue) => {
                const option = (section.options || []).find(
                  (entry) => String(entry.value) === String(selectedValue)
                )

                return {
                  value: selectedValue,
                  label: option?.label || String(selectedValue),
                  icon: option?.icon || "circle-line",
                  color: option?.color || "var(--muted-foreground)",
                }
              })
            : undefined,
      })
    })

    return items
  }, [sections, value])

  if (chips.length === 0) {
    return null
  }

  const removeChip = (chip) => {
    const next = normalizeFilterValue(sections, value)

    if (chip.kind === "range") {
      const section = sections.find((entry) => entry.key === chip.key)
      next[chip.key] = sectionBounds(section || {})
    } else {
      next[chip.key] = []
    }

    onChange?.(next)
  }

  const removeStageValue = (sectionKey, stageValue) => {
    const next = normalizeFilterValue(sections, value)
    next[sectionKey] = toSelectedList(next[sectionKey]).filter(
      (entry) => String(entry) !== String(stageValue)
    )
    onChange?.(next)
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 border-b border-border bg-muted/20 px-6 py-2",
        className
      )}
    >
      <span className="mr-1 text-sm font-medium text-muted-foreground">
        Showing
      </span>
      {chips.map((chip) =>
        chip.kind === "stage" ? (
          <span
            key={chip.key}
            className="inline-flex min-w-0 flex-wrap items-center gap-1.5"
          >
            <span className="text-sm text-muted-foreground">{chip.sectionLabel}:</span>
            {(chip.stageOptions || []).map((option) => (
              <Tooltip key={`${chip.key}-${option.value}`}>
                <TooltipTrigger
                  render={
                    <StageBadge
                      as="button"
                      type="button"
                      label={option.label}
                      color={option.color}
                      onClick={() => removeStageValue(chip.key, option.value)}
                      className="cursor-pointer hover:border-destructive/40 hover:bg-destructive/5"
                      aria-label={`Remove ${chip.sectionLabel}: ${option.label}`}
                    />
                  }
                />
                <TooltipContent>
                  {`Remove ${chip.sectionLabel}: ${option.label}`}
                </TooltipContent>
              </Tooltip>
            ))}
          </span>
        ) : (
        <Tooltip key={chip.key}>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => removeChip(chip)}
                className="inline-flex h-7 max-w-80 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-sm text-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5"
                aria-label={`Remove ${chip.sectionLabel}: ${chip.optionLabel}`}
              >
                {chip.kind === "heat" ? (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <span className="text-muted-foreground">{chip.sectionLabel}:</span>
                    <span className="inline-flex items-center gap-0.5">
                      {chip.values.map((value) => {
                        const meta = heatMeta(value)

                        if (!meta) {
                          return (
                            <span key={value} className="truncate">
                              {value}
                            </span>
                          )
                        }

                        return (
                          <Icon
                            key={value}
                            name={meta.icon}
                            className={cn("text-sm", meta.className)}
                            aria-label={meta.label}
                          />
                        )
                      })}
                    </span>
                  </span>
                ) : chip.kind === "icons" ? (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <span className="text-muted-foreground">{chip.sectionLabel}:</span>
                    <span className="inline-flex items-center gap-0.5">
                      {(chip.iconOptions || []).map((option) => (
                        <Icon
                          key={option.value}
                          name={option.icon}
                          className="text-sm"
                          style={{ color: option.color }}
                          aria-label={option.label}
                        />
                      ))}
                    </span>
                  </span>
                ) : (
                  <span className="truncate">
                    <span className="text-muted-foreground">{chip.sectionLabel}:</span>{" "}
                    {chip.optionLabel}
                  </span>
                )}
                <Icon
                  name="close-line"
                  className="shrink-0 text-sm text-muted-foreground"
                />
              </button>
            }
          />
          <TooltipContent>
            {`Remove ${chip.sectionLabel}: ${chip.optionLabel}`}
          </TooltipContent>
        </Tooltip>
        )
      )}
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="ml-1 text-sm font-medium text-primary transition-opacity hover:opacity-80"
        >
          Clear all
        </button>
      ) : null}
    </div>
  )
}

export {
  FilterMenu,
  ActiveFilters,
  toSelectedList,
  toRangeValue,
  isRangeActive,
  sectionBounds,
  emptyFilterValue,
}

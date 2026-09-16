"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

/**
 * Accordion filter popover with Clear / Apply.
 *
 * @param {object} props
 * @param {Array<{ key: string, label: string, options: Array<{ value: string, label: string }> }>} props.sections
 * @param {Record<string, string>} props.value Applied filter values
 * @param {(next: Record<string, string>) => void} props.onApply
 * @param {string} [props.className]
 */
function FilterMenu({ sections = [], value = {}, onApply, className }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (open) {
      setDraft(value)
    }
  }, [open, value])

  const activeCount = useMemo(
    () =>
      Object.values(value).filter((item) => item != null && String(item) !== "")
        .length,
    [value]
  )

  const triggerLabel =
    activeCount > 0 ? `Filter (${activeCount})` : "Filter..."

  const setSectionValue = (key, next) => {
    setDraft((current) => ({
      ...current,
      [key]: next ?? "",
    }))
  }

  const handleClear = () => {
    const cleared = Object.fromEntries(
      sections.map((section) => [section.key, ""])
    )
    setDraft(cleared)
    onApply?.(cleared)
    setOpen(false)
  }

  const handleApply = () => {
    onApply?.(draft)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "inline-flex h-9 min-w-40 items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm text-muted-foreground shadow-xs transition-colors outline-none",
          "hover:bg-muted/40 hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "data-popup-open:border-ring data-popup-open:text-foreground",
          className
        )}
      >
        <Icon name="filter-3-line" className="text-base" />
        <span className="flex-1 text-left">{triggerLabel}</span>
        <Icon name="arrow-down-s-line" className="text-base opacity-70" />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-72 gap-0 overflow-hidden p-0"
      >
        <Accordion defaultValue={["status"]} className="max-h-80 overflow-y-auto">
          {sections.map((section) => (
            <AccordionItem key={section.key} value={section.key} className="px-1">
              <AccordionTrigger className="px-3 py-3 text-sm font-semibold hover:no-underline">
                {section.label}
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3">
                <RadioGroup
                  value={draft[section.key] || null}
                  onValueChange={(next) => setSectionValue(section.key, next)}
                  className="gap-1"
                >
                  {section.options.map((option) => {
                    const selected =
                      String(draft[section.key] || "") === String(option.value)

                    return (
                      <label
                        key={`${section.key}-${option.value}`}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 text-sm text-muted-foreground transition-colors",
                          "hover:bg-muted/40 hover:text-foreground",
                          selected && "text-foreground"
                        )}
                      >
                        <RadioGroupItem value={option.value} />
                        <span>{option.label}</span>
                      </label>
                    )
                  })}
                </RadioGroup>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-2"
            onClick={handleClear}
          >
            Clear
          </Button>
          <Button type="button" size="sm" onClick={handleApply}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { FilterMenu }

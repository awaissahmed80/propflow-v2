import { useEffect, useState } from "react"
import { BlockPicker } from "react-color"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const subtleFlatColors = [
  "#E57373",
  "#81C784",
  "#64B5F6",
  "#FFB74D",
  "#9575CD",
  "#4DB6AC",
  "#FF8A65",
  "#A1887F",
  "#7986CB",
  "#4FC3F7",
  "#BA68C8",
  "#4DD0E1",
  "#AED581",
  "#FFD54F",
  "#E0E0E0",
  "#90A4AE",
  "#F06292",
  "#DCE775",
  "#8D6E63",
  "#4A148C",
]

function useIsDarkMode() {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false
  )

  useEffect(() => {
    const root = document.documentElement

    const sync = () => setIsDark(root.classList.contains("dark"))
    sync()

    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })

    return () => observer.disconnect()
  }, [])

  return isDark
}

export const ColorPicker = ({
  value = "#E57373",
  onChange,
  placeholder,
  colors = subtleFlatColors,
  required = false,
  label,
  className,
}) => {
  const [isOpen, setOpen] = useState(false)
  const isDark = useIsDarkMode()

  const handleChange = (color) => {
    onChange?.(color.hex)
  }

  return (
    <div className={cn("w-full space-y-0.5", className)}>
      {label ? (
        <Label className="mb-1 flex flex-row items-center text-label font-medium text-muted-foreground">
          {label}
          {required ? <span className="text-xs text-destructive">*</span> : null}
        </Label>
      ) : null}

      <Popover open={isOpen} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            "inline-flex h-control w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs transition-[color,box-shadow] outline-none",
            "hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "dark:bg-input/30 dark:hover:bg-input/50"
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <span
              className="size-4 shrink-0 rounded-sm border border-border"
              style={{ backgroundColor: value }}
            />
            <span className="truncate">
              {value?.toUpperCase() || placeholder || "Select Color..."}
            </span>
          </span>
          <i className="ri-expand-up-down-line shrink-0 text-muted-foreground" />
        </PopoverTrigger>

        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={4}
          className="w-(--anchor-width) min-w-(--anchor-width) gap-0 overflow-hidden p-0"
        >
          <BlockPicker
            color={value}
            onChange={handleChange}
            width="100%"
            triangle="hide"
            colors={colors}
            styles={{
              default: {
                card: {
                  backgroundColor: isDark ? "oklch(0.205 0 0)" : "#ffffff",
                  boxShadow: "none",
                  borderRadius: 0,
                  width: "100%",
                },
                head: {
                  height: "48px",
                },
                body: {
                  padding: "12px",
                  backgroundColor: isDark ? "oklch(0.205 0 0)" : "#ffffff",
                },
                label: {
                  color: isDark ? "#fafafa" : "#171717",
                },
                input: {
                  marginTop: "8px",
                  height: "36px",
                  fontSize: "14px",
                  border: "0px",
                  outline: "0px",
                  appearance: "none",
                  boxShadow: "none",
                  borderRadius: "6px",
                  color: isDark ? "#fafafa" : "#171717",
                  backgroundColor: isDark ? "oklch(0.269 0 0)" : "#f4f4f5",
                },
              },
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

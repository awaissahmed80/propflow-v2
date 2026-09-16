import { useEffect, useId, useRef, useState } from "react"
import { Avatar } from "@/components/ui/avatar"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

function ImagePicker({
  value = null,
  previewUrl = null,
  name = "",
  onChange,
  className,
  disabled = false,
  shape = "circle",
  accept = "image/png,image/jpeg,image/webp,image/gif",
}) {
  const inputId = useId()
  const inputRef = useRef(null)
  const [localPreview, setLocalPreview] = useState(null)
  const isTile = shape === "tile"

  useEffect(() => {
    if (!(value instanceof File)) {
      setLocalPreview(null)
      return
    }

    const objectUrl = URL.createObjectURL(value)
    setLocalPreview(objectUrl)

    return () => URL.revokeObjectURL(objectUrl)
  }, [value])

  const displayUrl = localPreview || previewUrl || null

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] ?? null
    onChange?.(file)
  }

  const clearImage = (event) => {
    event.preventDefault()
    event.stopPropagation()

    if (inputRef.current) {
      inputRef.current.value = ""
    }

    onChange?.(null)
  }

  return (
    <div className={cn("flex flex-col items-center gap-2", isTile && "w-[8.5rem]", className)}>
      <label
        htmlFor={disabled ? undefined : inputId}
        className={cn(
          "group relative inline-flex cursor-pointer items-center justify-center overflow-hidden border border-border bg-muted/40 transition-colors",
          "hover:border-primary/60 hover:bg-muted/60",
          isTile
            ? "aspect-square w-full rounded-xl border-solid"
            : "size-24 rounded-full border-dashed",
          disabled && "pointer-events-none cursor-not-allowed opacity-60"
        )}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={name || "Profile preview"}
            className="size-full object-cover"
          />
        ) : isTile ? (
          <span className="flex size-12 items-center justify-center rounded-full bg-background/80 text-muted-foreground shadow-sm ring-1 ring-border">
            <Icon name="image-add-line" className="text-2xl" />
          </span>
        ) : (
          <Avatar name={name} className="size-full text-lg" textClass="text-lg" />
        )}

        <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
          <Icon name={isTile ? "image-add-line" : "camera-line"} className="text-xl text-white" />
        </span>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={disabled}
          onChange={handleFileChange}
        />
      </label>

      {!isTile && (
        <div className="flex items-center gap-3 text-xs">
          <label
            htmlFor={disabled ? undefined : inputId}
            className={cn(
              "cursor-pointer font-medium text-primary hover:underline",
              disabled && "pointer-events-none opacity-60"
            )}
          >
            {displayUrl ? "Change photo" : "Upload photo"}
          </label>
          {displayUrl && !disabled && (
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive hover:underline"
              onClick={clearImage}
            >
              Remove
            </button>
          )}
        </div>
      )}

      {isTile && displayUrl && !disabled && (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-destructive hover:underline"
          onClick={clearImage}
        >
          Remove
        </button>
      )}
    </div>
  )
}

export { ImagePicker }

"use client"

import { useEffect, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

/**
 * Full-size image preview with next / previous navigation.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {Array<{ id?: string|number, src: string, name?: string, alt?: string }>} props.images
 * @param {number} [props.index]
 * @param {(index: number) => void} [props.onIndexChange]
 * @param {string} [props.className]
 */
function ImageLightbox({
  open,
  onOpenChange,
  images = [],
  index = 0,
  onIndexChange,
  className,
}) {
  const [activeIndex, setActiveIndex] = useState(index)
  const total = images.length
  const current = total > 0 ? images[Math.min(Math.max(activeIndex, 0), total - 1)] : null

  useEffect(() => {
    if (open) {
      setActiveIndex(index)
    }
  }, [open, index])

  const goTo = (nextIndex) => {
    if (total === 0) {
      return
    }

    const wrapped = ((nextIndex % total) + total) % total
    setActiveIndex(wrapped)
    onIndexChange?.(wrapped)
  }

  const showPrev = () => goTo(activeIndex - 1)
  const showNext = () => goTo(activeIndex + 1)

  useEffect(() => {
    if (!open || total <= 1) {
      return
    }

    const onKeyDown = (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        goTo(activeIndex - 1)
      }

      if (event.key === "ArrowRight") {
        event.preventDefault()
        goTo(activeIndex + 1)
      }
    }

    window.addEventListener("keydown", onKeyDown)

    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, total, activeIndex])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "fixed inset-0 top-0 left-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-black/90 p-0 text-white shadow-none ring-0 sm:max-w-none",
          "data-open:zoom-in-100 data-closed:zoom-out-100",
          className
        )}
      >
        <DialogTitle className="sr-only">
          {current?.name || current?.alt || "Image preview"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Large image preview. Use arrow keys or buttons to browse the gallery.
        </DialogDescription>

        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">
              {current?.name || current?.alt || "Image"}
            </p>
            {total > 0 ? (
              <p className="text-xs text-white/70">
                {activeIndex + 1} / {total}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-white hover:bg-white/10 hover:text-white"
            aria-label="Close preview"
            onClick={() => onOpenChange(false)}
          >
            <XIcon className="size-4" />
          </Button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-16 sm:px-16">
          {total > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute left-2 z-10 size-10 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white sm:left-4"
              aria-label="Previous image"
              onClick={showPrev}
            >
              <ChevronLeftIcon className="size-6" />
            </Button>
          ) : null}

          {current ? (
            <img
              src={current.src}
              alt={current.alt || current.name || ""}
              className="max-h-full max-w-full object-contain select-none"
              draggable={false}
            />
          ) : (
            <p className="text-sm text-white/70">No image to preview</p>
          )}

          {total > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 z-10 size-10 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white sm:right-4"
              aria-label="Next image"
              onClick={showNext}
            >
              <ChevronRightIcon className="size-6" />
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export { ImageLightbox }

"use client"

import { useEffect, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "svg"]

/**
 * @param {string | null | undefined} name
 */
function extensionOf(name) {
  return String(name || "")
    .split(".")
    .pop()
    ?.toLowerCase()
}

/**
 * @param {{ name?: string, type?: string | null, kind?: string }} file
 */
export function filePreviewMode(file) {
  const mime = String(file?.type || "")
  const extension = extensionOf(file?.name)

  if (
    file?.kind === "media" ||
    mime.startsWith("image/") ||
    IMAGE_EXTENSIONS.includes(extension || "")
  ) {
    return "image"
  }

  if (extension === "pdf" || mime === "application/pdf") {
    return "pdf"
  }

  if (mime.startsWith("text/") || ["txt", "csv"].includes(extension || "")) {
    return "text"
  }

  return "file"
}

/**
 * @param {string | null | undefined} name
 * @param {string | null | undefined} mime
 */
function fileTypeLabel(name, mime) {
  const extension = extensionOf(name)

  if (extension === "pdf" || mime === "application/pdf") {
    return "PDF"
  }

  if (["doc", "docx"].includes(extension || "") || mime?.includes("word")) {
    return "DOC"
  }

  if (
    ["xls", "xlsx", "csv"].includes(extension || "") ||
    mime?.includes("sheet") ||
    mime?.includes("excel")
  ) {
    return "XLS"
  }

  if (
    ["ppt", "pptx"].includes(extension || "") ||
    mime?.includes("presentation")
  ) {
    return "PPT"
  }

  if (["zip", "rar"].includes(extension || "")) {
    return "ZIP"
  }

  return (extension || "FILE").slice(0, 4).toUpperCase()
}

/**
 * In-panel preview for library attachments.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {Array<{ id?: string|number, name?: string, url?: string, thumbnail_url?: string|null, type?: string|null, kind?: string }>} [props.files]
 * @param {number} [props.index]
 * @param {(index: number) => void} [props.onIndexChange]
 */
export function FilePreview({
  open,
  onOpenChange,
  files = [],
  index = 0,
  onIndexChange,
}) {
  const [activeIndex, setActiveIndex] = useState(index)
  const total = files.length
  const current = total > 0 ? files[Math.min(Math.max(activeIndex, 0), total - 1)] : null
  const mode = current ? filePreviewMode(current) : "file"
  const src = current?.url

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(85vh,44rem)] max-h-[92vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 pr-12">
          <DialogTitle className="truncate">
            {current?.name || "File preview"}
          </DialogTitle>
          <DialogDescription>
            {total > 1 ? `${activeIndex + 1} of ${total}` : "Attachment preview"}
          </DialogDescription>
        </DialogHeader>

        <div className="relative min-h-0 flex-1 bg-muted/30">
          {total > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute top-1/2 left-3 z-10 -translate-y-1/2 bg-background"
              aria-label="Previous file"
              onClick={() => goTo(activeIndex - 1)}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
          ) : null}

          {current && src && mode === "image" ? (
            <div className="flex h-full items-center justify-center p-6 sm:px-16">
              <img
                src={src}
                alt={current.name || "Attachment"}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : null}

          {current && src && (mode === "pdf" || mode === "text") ? (
            <iframe
              title={current.name || "File preview"}
              src={src}
              className="size-full border-0 bg-background"
            />
          ) : null}

          {current && mode === "file" ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="relative">
                <Icon name="file-line" className="text-6xl text-muted-foreground/80" />
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-foreground">
                  {fileTypeLabel(current.name, current.type)}
                </span>
              </div>
              <p className="max-w-sm text-sm text-muted-foreground">
                This file type can&apos;t be previewed here. Open it to view or download.
              </p>
            </div>
          ) : null}

          {!current ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No file to preview
            </p>
          ) : null}

          {total > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute top-1/2 right-3 z-10 -translate-y-1/2 bg-background"
              aria-label="Next file"
              onClick={() => goTo(activeIndex + 1)}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-6 py-3">
          {src ? (
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Open
            </a>
          ) : null}
          <Button type="button" size="sm" onClick={() => onOpenChange?.(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Clickable attachment tile used in timelines and composers.
 *
 * @param {object} props
 * @param {{ id?: string|number, name?: string, url?: string, thumbnail_url?: string|null, type?: string|null, kind?: string }} props.file
 * @param {() => void} props.onPreview
 * @param {string} [props.className]
 */
export function FilePreviewTile({ file, onPreview, className }) {
  const image = filePreviewMode(file) === "image"
  const src = file.thumbnail_url || file.url

  return (
    <button
      type="button"
      className={cn(
        "overflow-hidden rounded-md border border-border bg-muted/40 text-left transition-colors hover:border-primary/40 hover:bg-muted",
        image ? "size-16" : "inline-flex max-w-full items-center gap-1.5 px-2 py-1",
        className
      )}
      aria-label={`Preview ${file.name || "file"}`}
      onClick={onPreview}
    >
      {image && src ? (
        <img
          src={src}
          alt={file.name || "Attachment"}
          className="size-full object-cover"
        />
      ) : (
        <>
          <Icon
            name="file-text-line"
            className="shrink-0 text-sm text-muted-foreground"
          />
          <span className="truncate text-xs text-foreground">{file.name}</span>
        </>
      )}
    </button>
  )
}

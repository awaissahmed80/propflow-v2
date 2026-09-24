"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
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
    mime.startsWith("audio/") ||
    ["webm", "mp3", "ogg", "wav", "m4a", "mpeg"].includes(extension || "")
  ) {
    return "audio"
  }

  if (
    mime.startsWith("image/") ||
    IMAGE_EXTENSIONS.includes(extension || "") ||
    (file?.kind === "media" && !mime)
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

  if (
    mime?.startsWith("audio/") ||
    ["webm", "mp3", "ogg", "wav", "m4a", "mpeg"].includes(extension || "")
  ) {
    return "AUDIO"
  }

  return (extension || "FILE").slice(0, 4).toUpperCase()
}

/**
 * @param {string} value
 */
function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

/**
 * Print HTML without opening a new browser tab.
 *
 * @param {string} html
 * @param {string} [title]
 */
function printHtmlDocument(html, title) {
  const iframe = document.createElement("iframe")
  iframe.setAttribute("aria-hidden", "true")
  iframe.setAttribute("tabindex", "-1")
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    visibility: "hidden",
    pointerEvents: "none",
  })

  const blob = new Blob([html], { type: "text/html" })
  const url = URL.createObjectURL(blob)
  let cleaned = false

  const cleanup = () => {
    if (cleaned) {
      return
    }
    cleaned = true
    URL.revokeObjectURL(url)
    iframe.remove()
  }

  iframe.addEventListener("load", () => {
    try {
      const win = iframe.contentWindow
      if (!win) {
        cleanup()
        return
      }

      if (title && iframe.contentDocument) {
        iframe.contentDocument.title = title
      }

      win.focus()
      win.addEventListener("afterprint", cleanup, { once: true })
      setTimeout(() => {
        win.print()
      }, 50)
      // Safari / some browsers never fire afterprint.
      setTimeout(cleanup, 60_000)
    } catch {
      cleanup()
    }
  })

  iframe.src = url
  document.body.appendChild(iframe)
}

/**
 * Print a remote document (e.g. PDF) via a hidden iframe — no new tab.
 *
 * @param {string} href
 */
function printFromUrl(href) {
  if (!href) {
    return
  }

  const iframe = document.createElement("iframe")
  iframe.setAttribute("aria-hidden", "true")
  iframe.setAttribute("tabindex", "-1")
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    visibility: "hidden",
    pointerEvents: "none",
  })

  let cleaned = false
  const cleanup = () => {
    if (cleaned) {
      return
    }
    cleaned = true
    iframe.remove()
  }

  iframe.addEventListener("load", () => {
    try {
      const win = iframe.contentWindow
      if (!win) {
        cleanup()
        return
      }
      win.focus()
      win.addEventListener("afterprint", cleanup, { once: true })
      setTimeout(() => {
        win.print()
      }, 250)
      setTimeout(cleanup, 60_000)
    } catch {
      cleanup()
    }
  })

  iframe.src = href
  document.body.appendChild(iframe)
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
 * @param {string | null} [props.downloadUrl] Optional PDF (or other) download href shown as Download PDF.
 * @param {"a4" | null} [props.pageAspect] When "a4", frames PDF/HTML previews in portrait A4 proportions.
 * @param {string | null} [props.emailTo] Contact email; when set, shows an email action.
 * @param {() => void | Promise<void>} [props.onEmail] Called when the email action is clicked.
 */
export function FilePreview({
  open,
  onOpenChange,
  files = [],
  index = 0,
  onIndexChange,
  downloadUrl = null,
  pageAspect = null,
  emailTo = null,
  onEmail = null,
}) {
  const [activeIndex, setActiveIndex] = useState(index)
  const [emailing, setEmailing] = useState(false)
  const iframeRef = useRef(null)
  const total = files.length
  const current = total > 0 ? files[Math.min(Math.max(activeIndex, 0), total - 1)] : null
  const mode = current ? filePreviewMode(current) : "file"
  const src = current?.url
  const canEmail = Boolean(emailTo && typeof onEmail === "function")

  useEffect(() => {
    if (open) {
      setActiveIndex(index)
      setEmailing(false)
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

  const handlePrint = () => {
    if (!src) {
      return
    }

    if ((mode === "pdf" || mode === "text") && iframeRef.current) {
      try {
        const frameDoc = iframeRef.current.contentDocument

        if (frameDoc?.documentElement) {
          printHtmlDocument(
            `<!DOCTYPE html>${frameDoc.documentElement.outerHTML}`,
            current?.name || "Document",
          )
          return
        }
      } catch {
        // Cross-origin or unavailable — fall through.
      }

      if (downloadUrl) {
        printFromUrl(downloadUrl)
        return
      }
    }

    if (mode === "image") {
      printHtmlDocument(
        `<!DOCTYPE html><html><head><title>${escapeHtml(current?.name || "Print")}</title></head><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;"><img src="${escapeHtml(src)}" style="max-width:100%;height:auto;" /></body></html>`,
        current?.name || "Print",
      )
      return
    }

    printFromUrl(downloadUrl || src)
  }

  const handleEmail = async () => {
    if (!canEmail || emailing) {
      return
    }

    setEmailing(true)

    try {
      await onEmail()
    } finally {
      setEmailing(false)
    }
  }

  const a4Preview = pageAspect === "a4" && (mode === "pdf" || mode === "text")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[92vh] w-full flex-col gap-0 overflow-hidden p-0",
          a4Preview
            ? "h-[min(92vh,56rem)] sm:max-w-3xl"
            : "h-[min(85vh,44rem)] sm:max-w-4xl",
        )}
      >
        <DialogHeader className="shrink-0 space-y-0 border-b border-border px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <DialogTitle className="truncate text-base">
                {current?.name || "File preview"}
              </DialogTitle>
              <DialogDescription className="truncate">
                {total > 1
                  ? `${activeIndex + 1} of ${total}`
                  : canEmail
                    ? `Attachment preview · ${emailTo}`
                    : "Attachment preview"}
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {src ? (
                <IconButton
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="text-lg"
                  icon="printer-line"
                  aria-label="Print"
                  tooltip="Print"
                  disabled={mode === "audio"}
                  onClick={handlePrint}
                />
              ) : null}
              {src && downloadUrl ? (
                <IconButton
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="text-lg"
                  icon="download-2-line"
                  aria-label="Download PDF"
                  tooltip="Download PDF"
                  onClick={() => {
                    window.open(downloadUrl, "_blank", "noopener,noreferrer")
                  }}
                />
              ) : null}
              {src && canEmail ? (
                <IconButton
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="text-lg"
                  icon="mail-send-line"
                  aria-label={`Email to ${emailTo}`}
                  tooltip={`Email to ${emailTo}`}
                  loading={emailing}
                  disabled={emailing}
                  onClick={handleEmail}
                />
              ) : null}
              <IconButton
                type="button"
                variant="ghost"
                size="lg"
                className="text-lg"
                icon="close-line"
                aria-label="Close"
                tooltip="Close"
                onClick={() => onOpenChange?.(false)}
              />
            </div>
          </div>
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

          {current && src && mode === "audio" ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
              <Icon name="mic-line" className="text-5xl text-muted-foreground" />
              <audio controls src={src} className="w-full max-w-md" preload="metadata" />
            </div>
          ) : null}

          {current && src && (mode === "pdf" || mode === "text") && a4Preview ? (
            <div className="flex h-full w-full items-center justify-center overflow-auto p-4 sm:p-6">
              <div className="aspect-[210/297] w-full max-w-[min(100%,calc((min(92vh,56rem)-9rem)*210/297))] shrink-0 overflow-hidden rounded-sm border border-border bg-white shadow-md">
                <iframe
                  ref={iframeRef}
                  title={current.name || "File preview"}
                  src={src}
                  className="size-full border-0 bg-white"
                />
              </div>
            </div>
          ) : null}

          {current && src && (mode === "pdf" || mode === "text") && !a4Preview ? (
            <iframe
              ref={iframeRef}
              title={current.name || "File preview"}
              src={src}
              className="size-full border-0 bg-white"
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
  const mode = filePreviewMode(file)
  const image = mode === "image"
  const audio = mode === "audio"
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
            name={audio ? "mic-line" : "file-text-line"}
            className="shrink-0 text-sm text-muted-foreground"
          />
          <span className="truncate text-xs text-foreground">
            {audio ? file.name || "Voice note" : file.name}
          </span>
        </>
      )}
    </button>
  )
}

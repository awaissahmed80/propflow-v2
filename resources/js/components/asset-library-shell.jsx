"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FilterInput } from "@/components/ui/filter-input"
import { Icon } from "@/components/ui/icon"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  syncLibraryLinks,
  uploadLibraryFile,
} from "@/lib/assets"

export const EMPTY_SELECTED_IDS = []

/**
 * Shared selection state for library pickers.
 *
 * @param {object} options
 * @param {Array<number|string>} options.selectedIds
 * @param {boolean} options.multiple
 * @param {boolean} options.enabled
 */
export function useLibrarySelection({
  selectedIds = EMPTY_SELECTED_IDS,
  multiple = true,
  enabled = true,
}) {
  const [selection, setSelection] = useState(() => selectedIds.map(String))

  useEffect(() => {
    setSelection((current) => {
      const next = selectedIds.map(String)

      if (
        current.length === next.length &&
        current.every((id, index) => id === next[index])
      ) {
        return current
      }

      return next
    })
  }, [selectedIds])

  const toggleItem = (id) => {
    if (!enabled) {
      return
    }

    const key = String(id)

    setSelection((current) => {
      if (current.includes(key)) {
        return current.filter((item) => item !== key)
      }

      if (!multiple) {
        return [key]
      }

      return [...current, key]
    })
  }

  const selectUploaded = (uploaded) => {
    if (!enabled) {
      return
    }

    const ids = uploaded.map((item) => String(item.id))

    setSelection((current) => {
      if (!multiple) {
        return ids.slice(0, 1)
      }

      return [...new Set([...current, ...ids])]
    })
  }

  const removeFromSelection = (id) => {
    setSelection((current) => current.filter((row) => row !== String(id)))
  }

  return {
    selection,
    setSelection,
    selectedCount: selection.length,
    toggleItem,
    selectUploaded,
    removeFromSelection,
    isSelected: (id) => enabled && selection.includes(String(id)),
  }
}

/**
 * Report the current selection as library items, including files that are
 * not on the current page or folder.
 *
 * @param {object} options
 * @param {string[]} options.selection
 * @param {Array<{ id: number|string, name?: string, url?: string, thumbnail_url?: string|null }>} options.items
 * @param {"media"|"document"} options.kind
 * @param {boolean} [options.enabled]
 * @param {(selection: { ids: string[], items: Array<{ id: number|string, name?: string, url?: string, thumbnail_url?: string|null, kind: string }> }) => void} [options.onSelectionChange]
 */
export function useReportLibrarySelection({
  selection,
  items,
  kind,
  enabled = false,
  onSelectionChange,
}) {
  const cache = useRef(new Map())
  const callbackRef = useRef(onSelectionChange)
  const signatureRef = useRef("")

  callbackRef.current = onSelectionChange

  useEffect(() => {
    if (!enabled) {
      return
    }

    for (const item of items) {
      cache.current.set(String(item.id), item)
    }

    const resolved = []

    for (const id of selection) {
      const item = cache.current.get(String(id))

      if (!item) {
        continue
      }

      resolved.push({
        id: item.id,
        name: item.name,
        url: item.url,
        thumbnail_url: item.thumbnail_url ?? null,
        type: item.type ?? null,
        kind,
      })
    }

    const signature = `${selection.map(String).join(",")}|${resolved.map((item) => String(item.id)).join(",")}`

    if (signature === signatureRef.current) {
      return
    }

    signatureRef.current = signature
    callbackRef.current?.({
      ids: selection,
      items: resolved,
    })
  }, [enabled, items, kind, selection])
}

/**
 * Upload one or more files into a library kind.
 *
 * @param {"media"|"documents"} kind
 * @param {File[]} files
 * @param {{ folderId?: number|string|null }} [options]
 */
export async function uploadLibraryFiles(kind, files, options = {}) {
  const uploaded = []

  for (const file of files) {
    uploaded.push(await uploadLibraryFile(kind, file, options))
  }

  toast.success(
    uploaded.length === 1
      ? "Uploaded successfully"
      : `${uploaded.length} files uploaded`
  )

  return uploaded
}

/**
 * Persist the current selection against an assetable.
 *
 * @param {"media"|"documents"} kind
 * @param {object} payload
 */
export async function applyLibrarySelection(kind, payload) {
  await syncLibraryLinks(kind, payload)
  toast.success("Selection saved")
}

/**
 * Shared search + upload toolbar for library managers.
 */
export function AssetLibraryToolbar({
  embedded = false,
  query,
  onQueryChange,
  placeholder = "Search...",
  accept,
  multiple = true,
  uploading = false,
  onUpload,
  actions,
  className,
}) {
  const inputRef = useRef(null)

  const handleUpload = async (event) => {
    const files = Array.from(event.target.files || [])

    if (inputRef.current) {
      inputRef.current.value = ""
    }

    if (files.length === 0) {
      return
    }

    await onUpload?.(files)
  }

  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-2",
        embedded ? "px-0 py-0" : "border-b border-border px-6 py-3",
        className
      )}
    >
      <FilterInput
        className="w-full max-w-xs"
        placeholder={placeholder}
        value={query}
        onChange={(event) => onQueryChange?.(event.target.value)}
      />

      <div className="ml-auto flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={handleUpload}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Icon name="upload-2-line" className="text-base" />
          Upload
        </Button>
        {actions}
      </div>
    </div>
  )
}

/**
 * Shared scrollable body for library grids.
 */
export function AssetLibraryBody({ embedded = false, className, children }) {
  return (
    <ScrollArea
      className={cn(
        "min-h-0 flex-1",
        embedded ? "pt-4" : "px-6 py-4",
        className
      )}
    >
      {children}
    </ScrollArea>
  )
}

/**
 * Dialog / embedded shell shared by media and document managers.
 */
export function AssetLibraryShell({
  embedded = false,
  open = false,
  onOpenChange,
  title,
  description,
  contentClassName = "sm:max-w-3xl",
  toolbar,
  children,
  extras,
  multiple = true,
  selectedCount = 0,
  saving = false,
  onApply,
}) {
  const body = (
    <>
      {toolbar}
      {children}
    </>
  )

  const footer = !embedded ? (
    <DialogFooter className="shrink-0 border-t border-border bg-popover px-6 py-4 sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {selectedCount === 0
          ? multiple
            ? "Nothing selected"
            : "No item selected"
          : multiple
            ? `${selectedCount} selected`
            : "1 selected"}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange?.(false)}
        >
          Cancel
        </Button>
        <Button type="button" loading={saving} onClick={onApply}>
          Apply
        </Button>
      </div>
    </DialogFooter>
  ) : null

  if (embedded) {
    return (
      <>
        <div className="flex h-full min-h-0 flex-col">{body}</div>
        {extras}
      </>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0",
            contentClassName
          )}
        >
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {body}
          {footer}
        </DialogContent>
      </Dialog>
      {extras}
    </>
  )
}

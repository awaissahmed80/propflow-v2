"use client"

import { useEffect, useRef, useState } from "react"
import { DocumentManager, MediaManager } from "@/components/media-manager"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Icon } from "@/components/ui/icon"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

const TABS = [
  { value: "documents", label: "Documents", icon: "file-text-line" },
  { value: "media", label: "Media", icon: "image-line" },
]

/**
 * Library picker with Documents and Media tabs.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {Array<{ id: number|string, name?: string, url?: string, thumbnail_url?: string|null, kind: "document"|"media" }>} [props.value]
 * @param {(items: Array<{ id: number|string, name?: string, url?: string, thumbnail_url?: string|null, kind: string }>) => void} props.onApply
 */
function mergeLibrarySelection(previous, report) {
  const known = new Map(previous.map((item) => [String(item.id), item]))

  for (const item of report.items) {
    known.set(String(item.id), { ...known.get(String(item.id)), ...item })
  }

  return report.ids
    .map((id) => known.get(String(id)))
    .filter(Boolean)
}

export function FileManagerPicker({
  open,
  onOpenChange,
  value = [],
  onApply,
}) {
  const valueRef = useRef(value)
  const [tab, setTab] = useState("documents")
  const [session, setSession] = useState(null)
  const [picked, setPicked] = useState({ documents: [], media: [] })

  valueRef.current = value

  useEffect(() => {
    if (!open) {
      setSession(null)

      return
    }

    const documents = valueRef.current.filter((item) => item.kind === "document")
    const media = valueRef.current.filter((item) => item.kind === "media")

    setSession({
      documentIds: documents.map((item) => item.id),
      mediaIds: media.map((item) => item.id),
    })
    setPicked({ documents, media })
    setTab("documents")
  }, [open])

  const selectedCount = picked.documents.length + picked.media.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(85vh,44rem)] max-h-[92vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 pr-12">
          <DialogTitle>Attach files</DialogTitle>
          <DialogDescription>
            Choose documents or media from the library. New uploads are saved there too.
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 items-center border-b border-border px-6 py-3">
          <ToggleGroup
            variant="outline"
            spacing={0}
            value={[tab]}
            onValueChange={(next) => {
              if (next?.[0]) {
                setTab(next[0])
              }
            }}
            aria-label="Library type"
          >
            {TABS.map((item) => (
              <ToggleGroupItem
                key={item.value}
                value={item.value}
                className="gap-1.5 px-3 data-pressed:bg-muted data-pressed:text-foreground"
                aria-label={item.label}
              >
                <Icon name={item.icon} className="text-base" />
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="relative min-h-0 flex-1">
          {session ? (
            <>
              <div
                className={cn(
                  "absolute inset-0 px-6 py-4",
                  tab !== "documents" && "hidden"
                )}
              >
                <DocumentManager
                  embedded
                  selectable
                  selectedIds={session.documentIds}
                  onSelectionChange={(report) =>
                    setPicked((current) => ({
                      ...current,
                      documents: mergeLibrarySelection(current.documents, report),
                    }))
                  }
                />
              </div>
              <div
                className={cn(
                  "absolute inset-0 px-6 py-4",
                  tab !== "media" && "hidden"
                )}
              >
                <MediaManager
                  embedded
                  selectable
                  selectedIds={session.mediaIds}
                  onSelectionChange={(report) =>
                    setPicked((current) => ({
                      ...current,
                      media: mergeLibrarySelection(current.media, report),
                    }))
                  }
                />
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 border-t border-border bg-popover px-6 py-4 sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {selectedCount === 0
              ? "Nothing selected"
              : `${selectedCount} selected`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange?.(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                onApply?.([...picked.documents, ...picked.media])
                onOpenChange?.(false)
              }}
            >
              Attach
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

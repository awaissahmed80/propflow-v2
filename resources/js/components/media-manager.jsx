"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Icon } from "@/components/ui/icon"
import { ImageLightbox } from "@/components/ui/image-lightbox"
import {
  AssetLibraryBody,
  AssetLibraryShell,
  AssetLibraryToolbar,
  EMPTY_SELECTED_IDS,
  applyLibrarySelection,
  uploadLibraryFiles,
  useLibrarySelection,
} from "@/components/asset-library-shell"
import { cn } from "@/lib/utils"
import { destroyLibraryFile, fetchLibrary } from "@/lib/assets"

/**
 * Media library picker / manager.
 *
 * @param {object} props
 * @param {boolean} [props.embedded]
 * @param {boolean} [props.open]
 * @param {(open: boolean) => void} [props.onOpenChange]
 */
function MediaManager({
  embedded = false,
  open = false,
  onOpenChange,
  title = "Media manager",
  description = "Browse uploaded media or upload new images, then apply your selection.",
  accept = "image/png,image/jpeg,image/webp,image/gif",
  multiple = true,
  assetableType,
  assetableId,
  linkage = "GALLERY",
  selectedIds = EMPTY_SELECTED_IDS,
  onApplied,
}) {
  const isOpen = embedded || open
  const selectable = !embedded
  const [items, setItems] = useState([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const {
    selection,
    selectedCount,
    toggleItem,
    selectUploaded,
    removeFromSelection,
    isSelected,
  } = useLibrarySelection({
    selectedIds,
    multiple,
    enabled: selectable,
  })

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setQuery("")
    void loadItems("")
  }, [isOpen, selectedIds])

  const loadItems = async (nextQuery) => {
    setLoading(true)

    try {
      setItems(await fetchLibrary("media", nextQuery))
    } catch (error) {
      toast.error(error.message || "Unable to load library")
    } finally {
      setLoading(false)
    }
  }

  const lightboxImages = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        src: item.url,
        name: item.name,
        alt: item.name,
      })),
    [items]
  )

  const handleActivate = (item, index) => {
    if (selectable) {
      toggleItem(item.id)
      return
    }

    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  const handleUpload = async (files) => {
    setUploading(true)

    try {
      const uploaded = await uploadLibraryFiles("media", files)
      setItems((current) => [...uploaded, ...current])
      selectUploaded(uploaded)
    } catch (error) {
      toast.error(error.message || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (item, event) => {
    event.preventDefault()
    event.stopPropagation()

    const confirmed = await confirm(
      `Delete "${item.name}" from the library? This removes it everywhere it is used.`,
      "Delete media"
    )

    if (!confirmed) {
      return
    }

    try {
      await destroyLibraryFile("media", item.id)
      setItems((current) => current.filter((row) => row.id !== item.id))
      removeFromSelection(item.id)
      toast.success("Deleted from library")
    } catch (error) {
      toast.error(error.message || "Unable to delete")
    }
  }

  const handleApply = async () => {
    if (!selectable) {
      return
    }

    if (!multiple && selection.length > 1) {
      toast.error("Select only one item")
      return
    }

    setSaving(true)

    try {
      await applyLibrarySelection("media", {
        assetableType,
        assetableId,
        linkage,
        assetIds: selection,
      })
      onApplied?.()
      onOpenChange?.(false)
    } catch (error) {
      toast.error(error.message || "Unable to save selection")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AssetLibraryShell
      embedded={embedded}
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      contentClassName="sm:max-w-4xl"
      multiple={multiple}
      selectedCount={selectedCount}
      saving={saving}
      onApply={handleApply}
      toolbar={
        <AssetLibraryToolbar
          embedded={embedded}
          query={query}
          onQueryChange={(next) => {
            setQuery(next)
            void loadItems(next)
          }}
          placeholder="Search media..."
          accept={accept}
          multiple={multiple}
          uploading={uploading}
          onUpload={handleUpload}
        />
      }
      extras={
        <ImageLightbox
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          images={lightboxImages}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
        />
      }
    >
      <AssetLibraryBody embedded={embedded}>
        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {query.trim()
              ? "No matches for that search."
              : "No media uploaded yet. Upload your first image."}
          </p>
        ) : (
          <div
            className={cn(
              "grid gap-3",
              embedded
                ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5"
            )}
          >
            {items.map((item, index) => {
              const selected = isSelected(item.id)

              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "group relative aspect-square overflow-hidden rounded-md border bg-muted/40 outline-none transition-colors",
                    selected
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-primary/50"
                  )}
                  onClick={() => handleActivate(item, index)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      handleActivate(item, index)
                    }
                  }}
                >
                  <img
                    src={item.thumbnail_url || item.url}
                    alt={item.name || ""}
                    className="size-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/55 px-2 py-1.5">
                    <span className="truncate text-[11px] text-white">
                      {item.name}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 rounded-sm p-0.5 text-white/80 hover:bg-white/15 hover:text-white"
                      aria-label={`Delete ${item.name}`}
                      onClick={(event) => handleDelete(item, event)}
                    >
                      <Icon name="delete-bin-line" className="text-sm" />
                    </button>
                  </div>
                  {selected ? (
                    <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Icon name="check-line" className="text-xs" />
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </AssetLibraryBody>
    </AssetLibraryShell>
  )
}

export { MediaManager }
export { DocumentManager } from "@/components/document-manager"

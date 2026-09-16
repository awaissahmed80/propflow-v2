"use client"

import { useEffect, useMemo, useState } from "react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
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
import {
  createDocumentFolder,
  destroyDocumentFolder,
  destroyLibraryFile,
  fetchDocumentFolders,
  fetchLibrary,
  moveDocumentsToFolder,
} from "@/lib/assets"

/**
 * @param {string | null | undefined} name
 * @param {string | null | undefined} mime
 */
function fileTypeMeta(name, mime) {
  const extension = String(name || "")
    .split(".")
    .pop()
    ?.toLowerCase()

  if (extension === "pdf" || mime === "application/pdf") {
    return { label: "PDF", className: "bg-red-500 text-white" }
  }

  if (["doc", "docx"].includes(extension || "") || mime?.includes("word")) {
    return { label: "DOC", className: "bg-blue-600 text-white" }
  }

  if (
    ["xls", "xlsx", "csv"].includes(extension || "") ||
    mime?.includes("sheet") ||
    mime?.includes("excel")
  ) {
    return { label: "XLS", className: "bg-emerald-600 text-white" }
  }

  if (
    ["ppt", "pptx"].includes(extension || "") ||
    mime?.includes("presentation")
  ) {
    return { label: "PPT", className: "bg-orange-500 text-white" }
  }

  if (["zip", "rar"].includes(extension || "")) {
    return { label: "ZIP", className: "bg-violet-600 text-white" }
  }

  if (
    mime?.startsWith("image/") ||
    ["jpg", "jpeg", "png", "webp", "gif"].includes(extension || "")
  ) {
    return { label: "IMG", className: "bg-sky-600 text-white" }
  }

  return {
    label: (extension || "FILE").slice(0, 4).toUpperCase(),
    className: "bg-slate-500 text-white",
  }
}

/**
 * @param {string | null | undefined} value
 */
function formatRelativeDate(value) {
  if (!value) {
    return ""
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 1) {
    return "Just now"
  }

  if (diffHours < 24) {
    return `${diffHours} Hour${diffHours === 1 ? "" : "s"} Ago`
  }

  if (diffDays === 1) {
    return "Yesterday"
  }

  if (diffDays < 7) {
    return `${diffDays} Days Ago`
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/**
 * Document library picker — grid of folders + files.
 *
 * @param {object} props
 * @param {boolean} [props.embedded]
 * @param {boolean} [props.open]
 * @param {(open: boolean) => void} [props.onOpenChange]
 */
function DocumentManager({
  embedded = false,
  open = false,
  onOpenChange,
  title = "Document manager",
  description = "Browse folders or upload files, then apply your selection.",
  accept = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,image/*",
  multiple = true,
  assetableType,
  assetableId,
  linkage = "DOCUMENT",
  selectedIds = EMPTY_SELECTED_IDS,
  onApplied,
}) {
  const isOpen = embedded || open
  const selectable = !embedded
  const [folders, setFolders] = useState([])
  const [items, setItems] = useState([])
  const [query, setQuery] = useState("")
  const [currentFolderId, setCurrentFolderId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [creatingFolder, setCreatingFolder] = useState(false)

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

  const currentFolder = useMemo(() => {
    if (!currentFolderId) {
      return null
    }

    for (const folder of folders) {
      if (String(folder.id) === String(currentFolderId)) {
        return folder
      }

      const child = (folder.children || []).find(
        (row) => String(row.id) === String(currentFolderId)
      )

      if (child) {
        return { ...child, parent: folder }
      }
    }

    return null
  }, [folders, currentFolderId])

  const visibleFolders = useMemo(() => {
    let rows = []

    if (!currentFolderId) {
      rows = folders
    } else if (currentFolder?.parent_id) {
      rows = []
    } else {
      rows = currentFolder?.children || []
    }

    const needle = query.trim().toLowerCase()

    if (!needle) {
      return rows
    }

    return rows.filter((folder) =>
      String(folder.name || "")
        .toLowerCase()
        .includes(needle)
    )
  }, [folders, currentFolderId, currentFolder, query])

  const canCreateFolder = !currentFolder || !currentFolder.parent_id

  const moveTargets = useMemo(() => {
    const rows = [{ id: null, label: "Unfiled" }]

    folders.forEach((folder) => {
      rows.push({ id: folder.id, label: folder.name })
      ;(folder.children || []).forEach((child) => {
        rows.push({ id: child.id, label: `${folder.name} / ${child.name}` })
      })
    })

    return rows
  }, [folders])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setQuery("")
    setCurrentFolderId(null)
    setNewFolderName("")
    setCreateFolderOpen(false)
    void bootstrap()
  }, [isOpen, selectedIds])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    void loadItems()
  }, [isOpen, currentFolderId, query])

  const bootstrap = async () => {
    try {
      setFolders(await fetchDocumentFolders())
      await loadItems()
    } catch (error) {
      toast.error(error.message || "Unable to load document library")
    }
  }

  const loadItems = async () => {
    setLoading(true)

    try {
      const rows = await fetchLibrary("documents", query, {
        folderId: currentFolderId,
        unfiled: !currentFolderId && !query.trim(),
      })
      setItems(rows)
    } catch (error) {
      toast.error(error.message || "Unable to load files")
    } finally {
      setLoading(false)
    }
  }

  const refreshFolders = async () => {
    setFolders(await fetchDocumentFolders())
  }

  const handleUpload = async (files) => {
    setUploading(true)

    try {
      const uploaded = await uploadLibraryFiles("documents", files, {
        folderId: currentFolderId,
      })
      selectUploaded(uploaded)
      await refreshFolders()
      await loadItems()
    } catch (error) {
      toast.error(error.message || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleCreateFolder = async () => {
    const name = newFolderName.trim()

    if (!name) {
      toast.error("Folder name is required")
      return
    }

    if (!canCreateFolder) {
      toast.error("Folders can only be nested two levels deep")
      return
    }

    setCreatingFolder(true)

    try {
      await createDocumentFolder({
        name,
        parentId: currentFolderId,
      })
      setNewFolderName("")
      setCreateFolderOpen(false)
      await refreshFolders()
      toast.success("Folder created")
    } catch (error) {
      toast.error(error.message || "Unable to create folder")
    } finally {
      setCreatingFolder(false)
    }
  }

  const handleDeleteFolder = async (folder) => {
    const confirmed = await confirm(
      `Delete folder "${folder.name}"? All files inside will be permanently deleted and unlinked everywhere.`,
      "Delete folder"
    )

    if (!confirmed) {
      return
    }

    try {
      await destroyDocumentFolder(folder.id)

      if (String(currentFolderId) === String(folder.id)) {
        setCurrentFolderId(folder.parent_id ?? null)
      }

      await refreshFolders()
      await loadItems()
      toast.success("Folder deleted")
    } catch (error) {
      toast.error(error.message || "Unable to delete folder")
    }
  }

  const handleDeleteFile = async (item) => {
    const confirmed = await confirm(
      `Delete "${item.name}" from the library? This removes it everywhere it is used.`,
      "Delete file"
    )

    if (!confirmed) {
      return
    }

    try {
      await destroyLibraryFile("documents", item.id)
      removeFromSelection(item.id)
      await refreshFolders()
      await loadItems()
      toast.success("Deleted from library")
    } catch (error) {
      toast.error(error.message || "Unable to delete")
    }
  }

  const handleMoveFile = async (item, folderId) => {
    try {
      await moveDocumentsToFolder([item.id], folderId)
      await refreshFolders()
      await loadItems()
      toast.success("File moved")
    } catch (error) {
      toast.error(error.message || "Unable to move file")
    }
  }

  const handleApply = async () => {
    if (!selectable) {
      return
    }

    setSaving(true)

    try {
      await applyLibrarySelection("documents", {
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
      contentClassName="sm:max-w-5xl"
      multiple={multiple}
      selectedCount={selectedCount}
      saving={saving}
      onApply={handleApply}
      toolbar={
        <AssetLibraryToolbar
          embedded={embedded}
          query={query}
          onQueryChange={setQuery}
          placeholder="Search files..."
          accept={accept}
          multiple={multiple}
          uploading={uploading}
          onUpload={handleUpload}
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canCreateFolder}
              onClick={() => setCreateFolderOpen(true)}
            >
              <Icon name="folder-add-line" className="text-base" />
              Create Folder
            </Button>
          }
        />
      }
      extras={
        <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create folder</DialogTitle>
              <DialogDescription>
                {currentFolder
                  ? `Create a subfolder inside “${currentFolder.name}”.`
                  : "Create a top-level folder in the document library."}
              </DialogDescription>
            </DialogHeader>
            <Input
              label="Folder name"
              placeholder="e.g. Contracts"
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  void handleCreateFolder()
                }
              }}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateFolderOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                loading={creatingFolder}
                onClick={handleCreateFolder}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {currentFolder ? (
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 text-sm",
            embedded ? "pt-3" : "border-b border-border px-6 py-2"
          )}
        >
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setCurrentFolderId(null)}
          >
            All files
          </button>
          {currentFolder.parent ? (
            <>
              <Icon name="arrow-right-s-line" className="text-muted-foreground" />
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setCurrentFolderId(currentFolder.parent.id)}
              >
                {currentFolder.parent.name}
              </button>
            </>
          ) : null}
          <Icon name="arrow-right-s-line" className="text-muted-foreground" />
          <span className="font-medium text-foreground">{currentFolder.name}</span>
        </div>
      ) : null}

      <AssetLibraryBody embedded={embedded} className={embedded ? "pt-4" : "px-6 py-5"}>
        {loading ? (
          <p className="py-20 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : visibleFolders.length === 0 && items.length === 0 ? (
          <p className="py-20 text-center text-sm text-muted-foreground">
            {query.trim()
              ? "No matching files."
              : "No folders or files here yet."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {visibleFolders.map((folder) => (
              <FolderTile
                key={`folder-${folder.id}`}
                folder={folder}
                onOpen={() => setCurrentFolderId(folder.id)}
                onDelete={() => handleDeleteFolder(folder)}
              />
            ))}

            {items.map((item) => (
              <FileTile
                key={`file-${item.id}`}
                item={item}
                selected={isSelected(item.id)}
                selectable={selectable}
                moveTargets={moveTargets}
                onToggle={() => toggleItem(item.id)}
                onDelete={() => handleDeleteFile(item)}
                onMove={(folderId) => handleMoveFile(item, folderId)}
              />
            ))}
          </div>
        )}
      </AssetLibraryBody>
    </AssetLibraryShell>
  )
}

function FolderTile({ folder, onOpen, onDelete }) {
  const count = Number(folder.assets_count) || 0

  return (
    <div className="group relative">
      <button
        type="button"
        className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-4 text-center transition-colors hover:border-primary/30 hover:bg-muted/40"
        onClick={onOpen}
        onDoubleClick={onOpen}
      >
        <Icon name="folder-fill" className="text-5xl text-sky-500" />
        <div className="min-w-0 space-y-0.5">
          <div className="truncate text-sm font-medium text-foreground">
            {folder.name}
          </div>
          <div className="text-xs text-muted-foreground">
            ({count}) File{count === 1 ? "" : "s"}
          </div>
        </div>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          className="absolute top-2 right-2 inline-flex rounded-md p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground data-popup-open:opacity-100"
          aria-label={`Folder actions for ${folder.name}`}
          onClick={(event) => event.stopPropagation()}
        >
          <Icon name="more-2-fill" className="text-base" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-36">
          <DropdownMenuItem onClick={onOpen}>Open</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            Delete folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function FileTile({
  item,
  selected,
  selectable = true,
  moveTargets,
  onToggle,
  onDelete,
  onMove,
}) {
  const type = fileTypeMeta(item.name, item.type)
  const addedAt = formatRelativeDate(item.created_at)

  const handleActivate = () => {
    if (selectable) {
      onToggle()
      return
    }

    if (item.url) {
      window.open(item.url, "_blank", "noopener,noreferrer")
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group relative flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border bg-transparent px-3 py-4 text-center outline-none transition-all",
        selected
          ? "border-sky-500 bg-background shadow-[0_8px_24px_-12px_rgba(14,165,233,0.55)]"
          : "border-transparent hover:bg-muted/20"
      )}
      onClick={handleActivate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          handleActivate()
        }
      }}
    >
      <div className="relative">
        <Icon name="file-line" className="text-5xl text-muted-foreground/80" />
        <span
          className={cn(
            "absolute bottom-1 left-1/2 -translate-x-1/2 rounded-sm px-1.5 py-0.5 text-[10px] font-bold tracking-wide",
            type.className
          )}
        >
          {type.label}
        </span>
      </div>

      <div className="min-w-0 space-y-0.5">
        <div className="line-clamp-2 text-sm font-medium text-foreground">
          {item.name}
        </div>
        {addedAt ? (
          <div className="text-xs text-muted-foreground">{addedAt}</div>
        ) : null}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "absolute top-2 right-2 inline-flex rounded-md p-1 transition-opacity hover:bg-muted data-popup-open:opacity-100",
            selected
              ? "text-sky-600 opacity-100"
              : "text-muted-foreground opacity-0 group-hover:opacity-100"
          )}
          aria-label={`Actions for ${item.name}`}
          onClick={(event) => event.stopPropagation()}
        >
          <Icon name="more-2-fill" className="text-base" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation()
              window.open(item.url, "_blank", "noopener,noreferrer")
            }}
          >
            Open
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {moveTargets.map((target) => (
            <DropdownMenuItem
              key={target.id ?? "unfiled"}
              onClick={(event) => {
                event.stopPropagation()
                onMove(target.id)
              }}
            >
              Move to {target.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={(event) => {
              event.stopPropagation()
              onDelete()
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export { DocumentManager }

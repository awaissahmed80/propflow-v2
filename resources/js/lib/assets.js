/**
 * Portal media / document library helpers.
 */

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`))

  return match ? decodeURIComponent(match[2]) : null
}

function jsonHeaders() {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  }

  const xsrfToken = getCookie("XSRF-TOKEN")

  if (xsrfToken) {
    headers["X-XSRF-TOKEN"] = xsrfToken
  }

  return headers
}

function multipartHeaders() {
  const headers = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  }

  const xsrfToken = getCookie("XSRF-TOKEN")

  if (xsrfToken) {
    headers["X-XSRF-TOKEN"] = xsrfToken
  }

  return headers
}

/**
 * @param {unknown} payload
 * @returns {Array<object>}
 */
function unwrapCollection(payload) {
  if (Array.isArray(payload?.data)) {
    return payload.data
  }

  if (Array.isArray(payload)) {
    return payload
  }

  return []
}

/**
 * @param {"media" | "documents"} kind
 * @param {string} [query]
 * @param {{
 *   folderId?: number|string|null,
 *   unfiled?: boolean,
 *   labelIds?: Array<number|string>,
 * }} [filters]
 */
export async function fetchLibrary(kind, query = "", filters = {}) {
  const base = kind === "documents" ? "/documents" : "/media"
  const params = new URLSearchParams()

  if (query.trim()) {
    params.set("q", query.trim())
  }

  if (filters.unfiled) {
    params.set("unfiled", "1")
  } else if (filters.folderId != null && filters.folderId !== "" && filters.folderId !== "all") {
    params.set("folder_id", String(filters.folderId))
  }

  if (Array.isArray(filters.labelIds) && filters.labelIds.length > 0) {
    params.set("label_ids", filters.labelIds.join(","))
  }

  const suffix = params.toString() ? `?${params}` : ""
  const response = await fetch(`${base}${suffix}`, {
    method: "GET",
    credentials: "same-origin",
    headers: jsonHeaders(),
  })

  if (!response.ok) {
    throw new Error("Unable to load library")
  }

  return unwrapCollection(await response.json())
}

/**
 * @param {"media" | "documents"} kind
 * @param {File} file
 * @param {{ folderId?: number|string|null, labelIds?: Array<number|string> }} [options]
 */
export async function uploadLibraryFile(kind, file, options = {}) {
  const base = kind === "documents" ? "/documents" : "/media"
  const body = new FormData()
  body.append("file", file)

  if (options.folderId) {
    body.append("folder_id", String(options.folderId))
  }

  if (Array.isArray(options.labelIds)) {
    options.labelIds.forEach((id) => body.append("label_ids[]", String(id)))
  }

  const response = await fetch(base, {
    method: "POST",
    credentials: "same-origin",
    headers: multipartHeaders(),
    body,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const message =
      payload?.message ||
      payload?.errors?.file?.[0] ||
      "Unable to upload file"

    throw new Error(message)
  }

  const payload = await response.json()

  return payload?.data ?? payload
}

/**
 * @param {"media" | "documents"} kind
 * @param {number|string} id
 */
export async function destroyLibraryFile(kind, id) {
  const base = kind === "documents" ? "/documents" : "/media"
  const response = await fetch(`${base}/${id}`, {
    method: "DELETE",
    credentials: "same-origin",
    headers: jsonHeaders(),
  })

  if (!response.ok) {
    throw new Error("Unable to delete file")
  }
}

/**
 * @param {"media" | "documents"} kind
 * @param {{
 *   assetableType: string,
 *   assetableId: number|string,
 *   linkage: string,
 *   assetIds: Array<number|string>,
 *   label?: string|null,
 * }} payload
 */
export async function syncLibraryLinks(kind, payload) {
  const base = kind === "documents" ? "/documents" : "/media"
  const body = {
    assetable_type: payload.assetableType,
    assetable_id: Number(payload.assetableId),
    linkage: payload.linkage,
    asset_ids: payload.assetIds.map(Number),
  }

  if (payload.label != null && String(payload.label).trim() !== "") {
    body.label = String(payload.label).trim()
  }

  const response = await fetch(`${base}/sync`, {
    method: "POST",
    credentials: "same-origin",
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody?.message || "Unable to save selection")
  }
}

/**
 * @param {number|null|undefined} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  const size = Number(bytes) || 0

  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export async function fetchDocumentFolders() {
  const response = await fetch("/documents/folders", {
    method: "GET",
    credentials: "same-origin",
    headers: jsonHeaders(),
  })

  if (!response.ok) {
    throw new Error("Unable to load folders")
  }

  return unwrapCollection(await response.json())
}

export async function createDocumentFolder({ name, parentId = null }) {
  const response = await fetch("/documents/folders", {
    method: "POST",
    credentials: "same-origin",
    headers: jsonHeaders(),
    body: JSON.stringify({
      name,
      parent_id: parentId,
    }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body?.message || body?.errors?.name?.[0] || "Unable to create folder")
  }

  const payload = await response.json()

  return payload?.data ?? payload
}

export async function destroyDocumentFolder(id) {
  const response = await fetch(`/documents/folders/${id}`, {
    method: "DELETE",
    credentials: "same-origin",
    headers: jsonHeaders(),
  })

  if (!response.ok) {
    throw new Error("Unable to delete folder")
  }
}

export async function moveDocumentsToFolder(assetIds, folderId = null) {
  const response = await fetch("/documents/folders/move", {
    method: "POST",
    credentials: "same-origin",
    headers: jsonHeaders(),
    body: JSON.stringify({
      asset_ids: assetIds.map(Number),
      folder_id: folderId,
    }),
  })

  if (!response.ok) {
    throw new Error("Unable to move files")
  }
}

export async function fetchDocumentLabels() {
  const response = await fetch("/documents/labels", {
    method: "GET",
    credentials: "same-origin",
    headers: jsonHeaders(),
  })

  if (!response.ok) {
    throw new Error("Unable to load labels")
  }

  return unwrapCollection(await response.json())
}

export async function createDocumentLabel({ name, color = null }) {
  const response = await fetch("/documents/labels", {
    method: "POST",
    credentials: "same-origin",
    headers: jsonHeaders(),
    body: JSON.stringify({ name, color }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body?.message || body?.errors?.name?.[0] || "Unable to create label")
  }

  const payload = await response.json()

  return payload?.data ?? payload
}

export async function syncDocumentLabels(documentId, labelIds) {
  const response = await fetch(`/documents/${documentId}/labels`, {
    method: "POST",
    credentials: "same-origin",
    headers: jsonHeaders(),
    body: JSON.stringify({ label_ids: labelIds.map(Number) }),
  })

  if (!response.ok) {
    throw new Error("Unable to update labels")
  }

  const payload = await response.json()

  return unwrapCollection(payload)
}

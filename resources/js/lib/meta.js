/**
 * Helpers for portal meta_data option lists.
 */

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`))

  return match ? decodeURIComponent(match[2]) : null
}

function metaHeaders() {
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

/**
 * @param {string} type
 * @returns {Promise<string[]>}
 */
export async function fetchMetaValues(type) {
  const response = await fetch(`/meta-data?type=${encodeURIComponent(type)}`, {
    method: "GET",
    credentials: "same-origin",
    headers: metaHeaders(),
  })

  if (!response.ok) {
    throw new Error("Unable to load options")
  }

  const payload = await response.json()

  return Array.isArray(payload.data) ? payload.data.map(String) : []
}

/**
 * @param {string} type
 * @param {string} value
 * @returns {Promise<string>}
 */
export async function createMetaValue(type, value) {
  const response = await fetch("/meta-data", {
    method: "POST",
    credentials: "same-origin",
    headers: metaHeaders(),
    body: JSON.stringify({ type, value }),
  })

  if (!response.ok) {
    throw new Error("Unable to save option")
  }

  const payload = await response.json()

  return String(payload?.data?.value ?? value)
}

/**
 * Extract a map iframe src from an embed snippet or absolute URL.
 *
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function extractMapEmbedSrc(value) {
  if (!value) {
    return null
  }

  const trimmed = String(value).trim()

  if (!trimmed) {
    return null
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  const match = trimmed.match(/src\s*=\s*["']([^"']+)["']/i)

  return match?.[1] ? match[1] : null
}

import { useEffect, useMemo, useState } from "react"
import { router } from "@inertiajs/react"
import { Modal } from "./modal"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Icon } from "@/components/ui/icon"
import { useDebounce } from "@/hooks/use-debounce"
import { index as searchIndex } from "@/actions/App/Http/Controllers/Portal/SearchController"
import { cn } from "@/lib/utils"

const RECENT_STORAGE_KEY = "propflow.spotlight.recent"
const RECENT_LIMIT = 6

const SUGGESTIONS = [
  { title: "Leads", url: "/leads", icon: "customer-service-line" },
  { title: "Contacts", url: "/contacts", icon: "contacts-book-line" },
  { title: "Bookings", url: "/bookings", icon: "book-2-line" },
  { title: "Projects", url: "/projects", icon: "community-line" },
  { title: "Campaigns", url: "/campaigns", icon: "focus-3-line" },
  { title: "Inventory", url: "/inventory", icon: "building-2-line" },
  { title: "Calendar", url: "/calendar", icon: "calendar-event-line" },
  { title: "Users", url: "/users", icon: "user-line" },
  { title: "Teams", url: "/teams", icon: "user-community-line" },
  { title: "Settings", url: "/settings", icon: "settings-3-line" },
]

/**
 * @returns {Array<{id: string, title: string, subtitle?: string|null, url: string, icon?: string, type?: string}>}
 */
function readRecentSearches() {
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter((item) => item && typeof item.url === "string" && typeof item.title === "string")
      .slice(0, RECENT_LIMIT)
  } catch {
    return []
  }
}

/**
 * @param {{id?: string, title: string, subtitle?: string|null, url: string, icon?: string, type?: string}} item
 */
function rememberRecentSearch(item) {
  if (!item?.url || !item?.title) {
    return
  }

  const next = [
    {
      id: item.id || item.url,
      title: item.title,
      subtitle: item.subtitle || null,
      url: item.url,
      icon: item.icon || "search-line",
      type: item.type || null,
    },
    ...readRecentSearches().filter((entry) => entry.url !== item.url),
  ].slice(0, RECENT_LIMIT)

  try {
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Ignore quota / private mode failures.
  }
}

function pathFrom(url) {
  const raw = String(url || "/")

  if (raw.startsWith("//") || raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const parsed = new URL(raw.startsWith("//") ? `https:${raw}` : raw)
      const path = parsed.pathname || "/"

      return `${path}${parsed.search}${parsed.hash}`
    } catch {
      return "/"
    }
  }

  return raw.startsWith("/") ? raw : `/${raw}`
}

function ResultRow({ item, onSelect }) {
  return (
    <CommandItem
      value={`${item.title} ${item.subtitle || ""} ${item.url}`}
      onSelect={() => onSelect(item)}
      className="gap-3"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground">
        <Icon name={item.icon || "search-line"} className="text-base" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{item.title}</span>
        {item.subtitle ? (
          <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
        ) : null}
      </span>
    </CommandItem>
  )
}

export const SpotlightSearch = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebounce(query, 250)
  const [results, setResults] = useState([])
  const [isFetching, setIsFetching] = useState(false)
  const [recent, setRecent] = useState([])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setRecent(readRecentSearches())
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setQuery("")
      setResults([])
      setIsFetching(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const trimmed = debouncedQuery.trim()

    if (trimmed.length < 2) {
      setResults([])
      setIsFetching(false)
      return
    }

    const controller = new AbortController()
    setIsFetching(true)

    fetch(pathFrom(searchIndex.url({ query: { q: trimmed } })), {
      method: "GET",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Search failed")
        }

        return response.json()
      })
      .then((payload) => {
        setResults(Array.isArray(payload?.results) ? payload.results : [])
      })
      .catch((error) => {
        if (error?.name === "AbortError") {
          return
        }

        setResults([])
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsFetching(false)
        }
      })

    return () => controller.abort()
  }, [debouncedQuery, isOpen])

  const hasQuery = query.trim().length > 0
  const showResults = debouncedQuery.trim().length >= 2
  const emptyResults = showResults && !isFetching && results.length === 0

  const recentItems = useMemo(
    () =>
      recent.map((item) => ({
        ...item,
        subtitle: item.type || item.subtitle || null,
      })),
    [recent]
  )

  const visit = (item) => {
    rememberRecentSearch(item)
    setRecent(readRecentSearches())
    onClose?.()
    router.get(item.url)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} hideTitle hideClose={true} variant="top">
      <Command shouldFilter={false} className="rounded-lg border shadow-md md:min-w-[450px]">
        <CommandInput
          onValueChange={setQuery}
          value={query}
          placeholder="Search leads, bookings, projects…"
        />
        <CommandList>
          {emptyResults ? (
            <CommandEmpty>No results for “{debouncedQuery.trim()}”.</CommandEmpty>
          ) : null}

          {showResults ? (
            <>
              {isFetching && results.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Searching…
                </div>
              ) : null}

              {results.map((group) =>
                group?.items?.length > 0 ? (
                  <CommandGroup key={group.type} heading={group.type}>
                    {group.items.map((item) => (
                      <ResultRow
                        key={item.id || item.url}
                        item={{ ...item, type: group.type, icon: item.icon || group.icon }}
                        onSelect={visit}
                      />
                    ))}
                  </CommandGroup>
                ) : null
              )}
            </>
          ) : (
            <>
              {recentItems.length > 0 ? (
                <>
                  <CommandGroup heading="Recent">
                    {recentItems.map((item) => (
                      <ResultRow key={`recent-${item.url}`} item={item} onSelect={visit} />
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              ) : null}

              <CommandGroup heading="Go to">
                {SUGGESTIONS.map((item) => (
                  <CommandItem
                    key={item.url}
                    value={item.title}
                    onSelect={() => visit(item)}
                    className="gap-3"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground">
                      <Icon name={item.icon} className="text-base" />
                    </span>
                    <span className={cn("truncate font-medium")}>{item.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>

              {hasQuery && query.trim().length < 2 ? (
                <div className="px-3 py-3 text-center text-xs text-muted-foreground">
                  Type at least 2 characters to search
                </div>
              ) : null}
            </>
          )}
        </CommandList>
      </Command>
    </Modal>
  )
}

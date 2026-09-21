import { useEffect, useState } from "react"
import { router, usePage } from "@inertiajs/react"
import dayjs from "dayjs"
import { toast } from "sonner"
import {
    index as notificationsIndex,
    read as readNotification,
    readAll as readAllNotifications,
} from "@/routes/portal/notifications"
import { Icon } from "@/components/ui/icon"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

function pathFrom(url) {
    const raw = String(url || "/")

    if (raw.startsWith("//") || raw.startsWith("http://") || raw.startsWith("https://")) {
        try {
            const pathname = new URL(raw.startsWith("//") ? `https:${raw}` : raw).pathname

            return pathname === "" ? "/" : pathname
        } catch {
            return "/"
        }
    }

    return raw.startsWith("/") ? raw : `/${raw}`
}

function csrfToken() {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/)

    return match ? decodeURIComponent(match[1]) : ""
}

async function requestJson(url, method = "GET") {
    const response = await fetch(pathFrom(url), {
        method,
        credentials: "same-origin",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            "X-XSRF-TOKEN": csrfToken(),
        },
    })

    if (!response.ok) {
        throw new Error("Request failed")
    }

    return response.json()
}

function present(notification) {
    return {
        id: notification.id,
        title: notification.title || "Notification",
        body: notification.body || "",
        href: notification.href || null,
        read_at: notification.read_at || null,
        created_at: notification.created_at || new Date().toISOString(),
    }
}

export function NotificationMenu() {
    const page = usePage()
    const userId = page.props.auth?.user?.id
    const tenantId = page.props.tenant?.current?.id
    const [open, setOpen] = useState(false)
    const [items, setItems] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)

    useEffect(() => {
        let ignore = false

        requestJson(notificationsIndex.url())
            .then((payload) => {
                if (ignore) {
                    return
                }

                setItems(payload.notifications ?? [])
                setUnreadCount(payload.unread_count ?? 0)
            })
            .catch(() => {})

        return () => {
            ignore = true
        }
    }, [tenantId])

    useEffect(() => {
        const echo = window.Echo

        if (!echo || !userId) {
            return undefined
        }

        const channelName = `App.Models.User.${userId}`
        const channel = echo.private(channelName)

        channel.notification((notification) => {
            if (tenantId && Number(notification.tenant_id) !== Number(tenantId)) {
                return
            }

            const item = present(notification)

            setItems((current) => {
                if (current.some((row) => row.id === item.id)) {
                    return current
                }

                return [item, ...current].slice(0, 30)
            })
            setUnreadCount((count) => count + 1)
            toast(item.title, { description: item.body || undefined })
        })

        return () => {
            echo.leave(channelName)
        }
    }, [userId, tenantId])

    const markRead = async (item) => {
        if (!item.read_at) {
            const payload = await requestJson(readNotification.url(item.id), "POST")

            setItems((current) =>
                current.map((row) =>
                    row.id === item.id ? { ...row, read_at: payload.notification?.read_at } : row
                )
            )
            setUnreadCount(payload.unread_count ?? 0)
        }

        if (item.href) {
            setOpen(false)
            router.visit(item.href)
        }
    }

    const markAllRead = async () => {
        await requestJson(readAllNotifications.url(), "POST")
        setItems((current) =>
            current.map((row) => ({ ...row, read_at: row.read_at || new Date().toISOString() }))
        )
        setUnreadCount(0)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                aria-label="Notifications"
                className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-md border bg-background text-foreground shadow-xs hover:bg-accent"
            >
                <Icon name="notification-3-line" className="text-sm" />
                {unreadCount > 0 ? (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                ) : null}
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={12} className="w-80 gap-0 p-0">
                <div className="flex items-center justify-between gap-3 border-b border-border/70 px-3 py-2.5">
                    <p className="text-sm font-semibold text-foreground">Notifications</p>
                    <button
                        type="button"
                        className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
                        disabled={unreadCount === 0}
                        onClick={markAllRead}
                    >
                        Mark all read
                    </button>
                </div>
                <ScrollArea className="max-h-80">
                    {items.length === 0 ? (
                        <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                            You are all caught up.
                        </p>
                    ) : (
                        <ul>
                            {items.map((item) => (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        onClick={() => markRead(item)}
                                        className={cn(
                                            "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-muted/60",
                                            !item.read_at && "bg-primary/5"
                                        )}
                                    >
                                        <span className="flex items-start justify-between gap-2">
                                            <span className="text-sm font-medium text-foreground">
                                                {item.title}
                                            </span>
                                            {!item.read_at ? (
                                                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                                            ) : null}
                                        </span>
                                        {item.body ? (
                                            <span className="line-clamp-2 text-xs text-muted-foreground">
                                                {item.body}
                                            </span>
                                        ) : null}
                                        <span className="text-[11px] text-muted-foreground">
                                            {item.created_at
                                                ? dayjs(item.created_at).format("D MMM, HH:mm")
                                                : ""}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    )
}

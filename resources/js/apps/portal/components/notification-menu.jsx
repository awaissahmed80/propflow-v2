import { useEffect, useState } from "react"
import { router, usePage } from "@inertiajs/react"
import dayjs from "dayjs"
import { toast } from "sonner"
import {
    feed as notificationsFeed,
    read as readNotification,
    readAll as readAllNotifications,
} from "@/routes/portal/notifications"
import { Icon } from "@/components/ui/icon"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
    pathFrom,
    presentNotification,
    requestJson,
    styleForEvent,
} from "./notifications-helpers"
import { NotificationsModal } from "./notifications-modal"

export function NotificationMenu() {
    const page = usePage()
    const userId = page.props.auth?.user?.id
    const tenantId = page.props.tenant?.current?.id
    const [open, setOpen] = useState(false)
    const [allOpen, setAllOpen] = useState(false)
    const [items, setItems] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)

    const applyFeed = (payload) => {
        if (!payload) {
            return
        }

        if (Array.isArray(payload.notifications)) {
            setItems(payload.notifications.map(presentNotification).filter((row) => !row.read_at))
        }

        if (payload.unread_count !== undefined) {
            setUnreadCount(payload.unread_count ?? 0)
        }
    }

    const refreshFeed = async () => {
        try {
            applyFeed(await requestJson(notificationsFeed.url()))
        } catch {
            // Keep current badge state if refresh fails.
        }
    }

    useEffect(() => {
        let ignore = false

        requestJson(notificationsFeed.url())
            .then((payload) => {
                if (!ignore) {
                    applyFeed(payload)
                }
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

            const item = presentNotification(notification)

            setItems((current) => {
                if (current.some((row) => row.id === item.id)) {
                    return current
                }

                return [item, ...current].slice(0, 30)
            })
            setUnreadCount((count) => count + 1)
            toast(item.title, {
                description: item.body || undefined,
                action: item.href
                    ? {
                          label: "Open",
                          onClick: () => router.visit(pathFrom(item.href)),
                      }
                    : undefined,
            })
        })

        return () => {
            echo.leave(channelName)
        }
    }, [userId, tenantId])

    const markRead = async (item) => {
        if (!item.read_at) {
            const payload = await requestJson(readNotification.url(item.id), "POST")

            setItems((current) => current.filter((row) => row.id !== item.id))
            setUnreadCount(payload.unread_count ?? 0)
        }

        if (item.href) {
            setOpen(false)
            router.visit(pathFrom(item.href))
        }
    }

    const markAllRead = async () => {
        await requestJson(readAllNotifications.url(), "POST")
        setItems([])
        setUnreadCount(0)
    }

    const viewAll = () => {
        setOpen(false)
        setAllOpen(true)
    }

    return (
        <>
            <Popover open={open} onOpenChange={setOpen}>
                <Tooltip>
                    <TooltipTrigger
                        render={
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
                        }
                    />
                    <TooltipContent>Notifications</TooltipContent>
                </Tooltip>
                <PopoverContent
                    align="end"
                    sideOffset={12}
                    className="flex max-h-[min(28rem,70vh)] w-80 flex-col gap-0 overflow-hidden p-0"
                >
                    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-3 py-2.5">
                        <p className="text-base font-bold tracking-tight text-foreground">
                            Notifications
                        </p>
                        <button
                            type="button"
                            className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
                            disabled={unreadCount === 0}
                            onClick={markAllRead}
                        >
                            Mark all read
                        </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {items.length === 0 ? (
                            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                                You are all caught up.
                            </p>
                        ) : (
                            <ul>
                                {items.map((item) => {
                                    const style = styleForEvent(item.event)

                                    return (
                                        <li key={item.id}>
                                            <button
                                                type="button"
                                                onClick={() => markRead(item)}
                                                className="flex w-full items-start gap-2.5 bg-primary/5 px-3 py-2.5 text-left hover:bg-muted/60"
                                            >
                                                <span
                                                    className={cn(
                                                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border",
                                                        style.icon
                                                    )}
                                                >
                                                    <Icon
                                                        name={item.icon || "notification-3-line"}
                                                        className="text-sm"
                                                    />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-start justify-between gap-2">
                                                        <span className="text-sm font-medium text-foreground">
                                                            {item.title}
                                                        </span>
                                                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                                                    </span>
                                                    {item.body ? (
                                                        <span className="line-clamp-2 text-xs text-muted-foreground">
                                                            {item.body}
                                                        </span>
                                                    ) : null}
                                                    <span className="text-[11px] text-muted-foreground">
                                                        {item.created_at
                                                            ? dayjs(item.created_at).format(
                                                                  "D MMM, HH:mm"
                                                              )
                                                            : ""}
                                                    </span>
                                                </span>
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </div>
                    <div className="shrink-0 border-t border-border/70 bg-popover px-3 py-2">
                        <button
                            type="button"
                            onClick={viewAll}
                            className="flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-foreground hover:bg-muted/60"
                        >
                            View all notifications
                            <Icon
                                name="arrow-right-s-line"
                                className="text-base text-muted-foreground"
                            />
                        </button>
                    </div>
                </PopoverContent>
            </Popover>

            <NotificationsModal
                open={allOpen}
                onClose={() => {
                    setAllOpen(false)
                    refreshFeed()
                }}
                onChanged={(payload) => {
                    if (payload?.unread_count !== undefined) {
                        setUnreadCount(payload.unread_count ?? 0)
                    }

                    if (Array.isArray(payload?.notifications)) {
                        setItems(
                            payload.notifications
                                .map(presentNotification)
                                .filter((row) => !row.read_at)
                                .slice(0, 30)
                        )
                    }
                }}
            />
        </>
    )
}

import { useEffect, useState } from "react"
import { router } from "@inertiajs/react"
import dayjs from "dayjs"
import {
    index as notificationsIndex,
    read as readNotification,
    unread as unreadNotification,
    destroy as destroyNotification,
    readAll as readAllNotifications,
} from "@/routes/portal/notifications"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { cn } from "@/lib/utils"
import { Modal } from "./modal"
import {
    pathFrom,
    presentNotification,
    requestJson,
    styleForEvent,
} from "./notifications-helpers"

const emptyPagination = {
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
    from: null,
    to: null,
}

export function NotificationsModal({ open, onClose, onChanged }) {
    const [items, setItems] = useState([])
    const [pagination, setPagination] = useState(emptyPagination)
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(false)
    const [page, setPage] = useState(1)

    const load = async (nextPage = 1) => {
        setLoading(true)

        try {
            const payload = await requestJson(
                notificationsIndex.url({
                    query: nextPage > 1 ? { page: nextPage } : {},
                })
            )

            setItems((payload.notifications ?? []).map(presentNotification))
            setPagination(payload.pagination ?? emptyPagination)
            setUnreadCount(payload.unread_count ?? 0)
            setPage(nextPage)
            onChanged?.(payload)
        } catch {
            // Keep current list if the request fails.
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!open) {
            return
        }

        load(1)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when modal opens
    }, [open])

    const syncAfterMutation = (payload, nextItems) => {
        setItems(nextItems)
        setUnreadCount(payload.unread_count ?? 0)
        onChanged?.({
            ...payload,
            notifications: nextItems.filter((item) => !item.read_at),
        })
    }

    const openItem = async (item) => {
        if (!item.read_at) {
            try {
                const payload = await requestJson(readNotification.url(item.id), "POST")
                const nextItems = items.map((row) =>
                    row.id === item.id
                        ? { ...row, read_at: payload.notification?.read_at || new Date().toISOString() }
                        : row
                )
                syncAfterMutation(payload, nextItems)
            } catch {
                // Still navigate if marking read fails.
            }
        }

        if (item.href) {
            onClose?.()
            router.visit(pathFrom(item.href))
        }
    }

    const markRead = async (item) => {
        if (item.read_at) {
            return
        }

        const payload = await requestJson(readNotification.url(item.id), "POST")
        syncAfterMutation(
            payload,
            items.map((row) =>
                row.id === item.id
                    ? { ...row, read_at: payload.notification?.read_at || new Date().toISOString() }
                    : row
            )
        )
    }

    const markUnread = async (item) => {
        if (!item.read_at) {
            return
        }

        const payload = await requestJson(unreadNotification.url(item.id), "POST")
        syncAfterMutation(
            payload,
            items.map((row) =>
                row.id === item.id ? { ...row, read_at: null } : row
            )
        )
    }

    const remove = async (item) => {
        const payload = await requestJson(destroyNotification.url(item.id), "DELETE")
        syncAfterMutation(
            payload,
            items.filter((row) => row.id !== item.id)
        )
    }

    const markAllRead = async () => {
        const payload = await requestJson(readAllNotifications.url(), "POST")
        const stamped = new Date().toISOString()
        syncAfterMutation(
            payload,
            items.map((row) => ({ ...row, read_at: row.read_at || stamped }))
        )
    }

    const currentPage = Number(pagination.current_page) || page || 1
    const lastPage = Math.max(1, Number(pagination.last_page) || 1)

    return (
        <Modal
            title="All notifications"
            isOpen={open}
            onClose={() => onClose?.()}
            size="lg"
            toolbar={
                <div className="flex w-full items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                        {unreadCount > 0
                            ? `${unreadCount} unread`
                            : "You’re all caught up"}
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={unreadCount === 0 || loading}
                        onClick={markAllRead}
                    >
                        Mark all read
                    </Button>
                </div>
            }
            footer={
                lastPage > 1 ? (
                    <div className="flex w-full items-center justify-between gap-3 px-5 py-3">
                        <p className="text-xs tabular-nums text-muted-foreground">
                            {pagination.from}–{pagination.to} of {pagination.total}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={currentPage <= 1 || loading}
                                onClick={() => load(currentPage - 1)}
                            >
                                Previous
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={currentPage >= lastPage || loading}
                                onClick={() => load(currentPage + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                ) : null
            }
        >
            {loading && items.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                    Loading notifications…
                </p>
            ) : items.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No notifications yet.
                </p>
            ) : (
                <ul className="divide-y divide-border/70">
                    {items.map((item) => {
                        const style = styleForEvent(item.event)
                        const unread = !item.read_at

                        return (
                            <li
                                key={item.id}
                                className={cn(
                                    "flex items-start gap-3 px-5 py-3",
                                    unread && "bg-primary/5"
                                )}
                            >
                                <button
                                    type="button"
                                    onClick={() => openItem(item)}
                                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                                >
                                    <span
                                        className={cn(
                                            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border",
                                            style.icon
                                        )}
                                    >
                                        <Icon
                                            name={item.icon || "notification-3-line"}
                                            className="text-base"
                                        />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-semibold text-foreground">
                                                {item.title}
                                            </span>
                                            {unread ? (
                                                <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                                            ) : null}
                                        </span>
                                        {item.body ? (
                                            <span className="mt-0.5 block line-clamp-2 text-sm text-muted-foreground">
                                                {item.body}
                                            </span>
                                        ) : null}
                                        <span className="mt-1 block text-[11px] text-muted-foreground">
                                            {style.label}
                                            {item.created_at
                                                ? ` · ${dayjs(item.created_at).format("D MMM YYYY, HH:mm")}`
                                                : ""}
                                        </span>
                                    </span>
                                </button>
                                <div className="flex shrink-0 items-center gap-0.5">
                                    {item.href ? (
                                        <IconButton
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            icon="external-link-line"
                                            aria-label="Open"
                                            onClick={() => openItem(item)}
                                        />
                                    ) : null}
                                    {unread ? (
                                        <IconButton
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            icon="mail-open-line"
                                            aria-label="Mark as read"
                                            onClick={() => markRead(item)}
                                        />
                                    ) : (
                                        <IconButton
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            icon="mail-unread-line"
                                            aria-label="Mark as unread"
                                            onClick={() => markUnread(item)}
                                        />
                                    )}
                                    <IconButton
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        icon="delete-bin-line"
                                        aria-label="Delete notification"
                                        onClick={() => remove(item)}
                                    />
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}
        </Modal>
    )
}

export function pathFrom(url) {
    const raw = String(url || "/")

    if (raw.startsWith("//") || raw.startsWith("http://") || raw.startsWith("https://")) {
        try {
            const parsed = new URL(raw.startsWith("//") ? `https:${raw}` : raw)

            return `${parsed.pathname || "/"}${parsed.search}${parsed.hash}`
        } catch {
            return "/"
        }
    }

    return raw.startsWith("/") ? raw : `/${raw}`
}

export function csrfToken() {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/)

    return match ? decodeURIComponent(match[1]) : ""
}

export async function requestJson(url, method = "GET") {
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

    if (response.status === 204) {
        return null
    }

    return response.json()
}

export function presentNotification(notification) {
    return {
        id: notification.id,
        title: notification.title || "Notification",
        body: notification.body || "",
        href: notification.href || null,
        event: notification.event || null,
        icon: notification.icon || iconForEvent(notification.event),
        read_at: notification.read_at || null,
        created_at: notification.created_at || new Date().toISOString(),
    }
}

export function iconForEvent(event) {
    const value = String(event || "")

    if (value.startsWith("lead_")) {
        return "customer-service-line"
    }

    if (value.startsWith("follow_up_")) {
        return "calendar-schedule-line"
    }

    if (value.startsWith("task_")) {
        return "checkbox-circle-line"
    }

    if (value.startsWith("personal_reminder_")) {
        return "alarm-line"
    }

    if (value === "installment_due" || value === "installment_overdue") {
        return "money-dollar-circle-line"
    }

    if (value === "handover_ready") {
        return "home-smile-2-line"
    }

    return "notification-3-line"
}

export function styleForEvent(event) {
    const value = String(event || "")

    if (value.startsWith("lead_") || value.startsWith("follow_up_")) {
        return {
            icon: "border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300",
            label: "Lead",
        }
    }

    if (value === "installment_due" || value === "installment_overdue" || value === "handover_ready") {
        return {
            icon: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
            label: "Booking",
        }
    }

    if (value.startsWith("task_")) {
        return {
            icon: "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300",
            label: "Task",
        }
    }

    if (value.startsWith("personal_reminder_")) {
        return {
            icon: "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300",
            label: "Reminder",
        }
    }

    return {
        icon: "border-border bg-muted/50 text-muted-foreground",
        label: "Alert",
    }
}

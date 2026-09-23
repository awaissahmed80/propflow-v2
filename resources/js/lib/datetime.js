import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

/**
 * @param {unknown} value
 * @returns {dayjs.Dayjs | null}
 */
export function toDayjs(value) {
    if (value == null || value === "") {
        return null;
    }

    const date = dayjs(value);

    return date.isValid() ? date : null;
}

/**
 * Absolute date + time for display.
 *
 * @param {unknown} value
 * @param {string} [format]
 * @returns {string}
 */
export function formatDateTime(value, format = "MMM D, YYYY h:mm A") {
    const date = toDayjs(value);

    return date ? date.format(format) : "—";
}

/**
 * Relative time from now (e.g. "3 hours ago").
 *
 * @param {unknown} value
 * @returns {string}
 */
export function formatRelativeTime(value) {
    const date = toDayjs(value);

    return date ? date.fromNow() : "—";
}

/**
 * Calendar day label for activity / feed grouping.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function formatDayLabel(value) {
    const date = toDayjs(value);

    if (!date) {
        return "Unknown";
    }

    const today = dayjs();

    if (date.isSame(today, "day")) {
        return "Today";
    }

    if (date.isSame(today.subtract(1, "day"), "day")) {
        return "Yesterday";
    }

    if (date.isSame(today, "year")) {
        return date.format("MMM D");
    }

    return date.format("MMM D, YYYY");
}

/**
 * Group items by calendar day, preserving input order within each day.
 *
 * @template T
 * @param {T[]} items
 * @param {(item: T) => unknown} [getDate]
 * @returns {{ key: string, label: string, items: T[] }[]}
 */
export function groupByDay(items = [], getDate = (item) => item?.created_at) {
    /** @type {Map<string, { key: string, label: string, items: T[] }>} */
    const groups = new Map();

    for (const item of items) {
        const date = toDayjs(getDate(item));
        const key = date ? date.format("YYYY-MM-DD") : "unknown";
        const existing = groups.get(key);

        if (existing) {
            existing.items.push(item);
            continue;
        }

        groups.set(key, {
            key,
            label: formatDayLabel(getDate(item)),
            items: [item],
        });
    }

    return Array.from(groups.values());
}

export { dayjs };

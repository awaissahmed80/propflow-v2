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

export { dayjs };

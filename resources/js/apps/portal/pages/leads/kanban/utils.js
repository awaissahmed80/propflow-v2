export const LEAD_DND_TYPE = "LEAD_CARD";

/**
 * @param {string | null | undefined} source
 * @returns {{ label: string, className: string } | null}
 */
export function sourceBadge(source) {
    const label = String(source || "").trim();

    if (!label) {
        return null;
    }

    const key = label.toLowerCase();

    if (key.includes("meta") || key.includes("facebook")) {
        return {
            label,
            className: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300",
        };
    }

    if (key.includes("google")) {
        return {
            label,
            className: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
        };
    }

    if (key.includes("bitrix") || key.includes("bittrex")) {
        return {
            label,
            className: "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-300",
        };
    }

    return {
        label,
        className: "border-border bg-muted text-muted-foreground",
    };
}

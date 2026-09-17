export const HEAT_LABELS = {
    "VERY HOT": "Very Hot",
    HOT: "Hot",
    MODERATE: "Moderate",
    COLD: "Cold",
    "VERY COLD": "Very Cold",
};

export const HEAT_OPTIONS = [
    { value: "VERY HOT", label: HEAT_LABELS["VERY HOT"] },
    { value: "HOT", label: HEAT_LABELS.HOT },
    { value: "MODERATE", label: HEAT_LABELS.MODERATE },
    { value: "COLD", label: HEAT_LABELS.COLD },
    { value: "VERY COLD", label: HEAT_LABELS["VERY COLD"] },
];

/**
 * @param {string | null | undefined} tag
 * @returns {{ icon: string, className: string, label: string } | null}
 */
export function heatMeta(tag) {
    switch (tag) {
        case "VERY HOT":
            return {
                icon: "fire-fill",
                className: "text-red-600 dark:text-red-400",
                label: HEAT_LABELS["VERY HOT"],
            };
        case "HOT":
            return {
                icon: "fire-line",
                className: "text-orange-500 dark:text-orange-400",
                label: HEAT_LABELS.HOT,
            };
        case "MODERATE":
            return {
                icon: "temp-hot-line",
                className: "text-amber-500 dark:text-amber-400",
                label: HEAT_LABELS.MODERATE,
            };
        case "COLD":
            return {
                icon: "temp-cold-line",
                className: "text-sky-500 dark:text-sky-400",
                label: HEAT_LABELS.COLD,
            };
        case "VERY COLD":
            return {
                icon: "snowflake-line",
                className: "text-slate-500 dark:text-slate-300",
                label: HEAT_LABELS["VERY COLD"],
            };
        default:
            return null;
    }
}

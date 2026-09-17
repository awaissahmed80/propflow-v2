import { router, usePage } from "@inertiajs/react";
import { useMemo } from "react";

const DEFAULT_CURRENCY = {
    code: "USD",
    symbol: "$",
};

/**
 * @param {unknown} value
 * @returns {{ code: string, symbol: string }}
 */
function normalizeCurrency(value) {
    const code = String(value?.code || DEFAULT_CURRENCY.code)
        .trim()
        .toUpperCase();
    const symbol = String(value?.symbol || DEFAULT_CURRENCY.symbol).trim();

    return {
        code: code || DEFAULT_CURRENCY.code,
        symbol: symbol || DEFAULT_CURRENCY.symbol,
    };
}

/**
 * Read currency from the initial Inertia page payload in the DOM.
 *
 * @returns {unknown}
 */
function readCurrencyFromDom() {
    if (typeof document === "undefined") {
        return null;
    }

    const pageElement = document.querySelector(
        'script[data-page][type="application/json"]',
    );

    if (!pageElement?.textContent) {
        return null;
    }

    try {
        return JSON.parse(pageElement.textContent)?.props?.currency ?? null;
    } catch {
        return null;
    }
}

/** @type {{ code: string, symbol: string }} */
let cachedCurrency = normalizeCurrency(readCurrencyFromDom());

/**
 * @param {unknown} value
 * @returns {{ code: string, symbol: string }}
 */
function rememberCurrency(value) {
    cachedCurrency = normalizeCurrency(value);

    return cachedCurrency;
}

if (typeof window !== "undefined") {
    // Inertia v3 no longer exposes `router.page`; keep a cache from visit events.
    router.on("navigate", (event) => {
        rememberCurrency(event.detail.page.props.currency);
    });
    router.on("success", (event) => {
        rememberCurrency(event.detail.page.props.currency);
    });
}

/**
 * Resolve tenant currency from the current Inertia page.
 *
 * @returns {{ code: string, symbol: string }}
 */
export function getCurrency() {
    return cachedCurrency;
}

/**
 * Hook for reactive access to shared currency settings.
 *
 * @returns {{
 *   code: string,
 *   symbol: string,
 *   formatMoney: (value: unknown, options?: object) => string
 * }}
 */
export function useCurrency() {
    const { currency } = usePage().props;

    return useMemo(() => {
        const resolved = rememberCurrency(currency);

        return {
            ...resolved,
            formatMoney: (value, options = {}) =>
                formatMoney(value, { ...resolved, ...options }),
        };
    }, [currency]);
}

/**
 * Format a monetary amount using tenant currency settings.
 *
 * @param {unknown} value
 * @param {{
 *   code?: string,
 *   symbol?: string,
 *   compact?: boolean,
 *   maximumFractionDigits?: number,
 *   empty?: string,
 * }} [options]
 * @returns {string}
 */
export function formatMoney(value, options = {}) {
    if (value == null || value === "") {
        return options.empty ?? "—";
    }

    const amount = Number(value);

    if (Number.isNaN(amount)) {
        return options.empty ?? "—";
    }

    const currency = normalizeCurrency({
        ...getCurrency(),
        ...options,
    });
    const maximumFractionDigits = options.maximumFractionDigits ?? 0;
    const compact = Boolean(options.compact);

    const number = new Intl.NumberFormat(undefined, {
        notation: compact ? "compact" : "standard",
        maximumFractionDigits,
    }).format(amount);

    const spacer = currency.symbol.length > 1 ? " " : "";

    return `${currency.symbol}${spacer}${number}`;
}

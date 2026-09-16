import { usePage } from '@inertiajs/react';

const EMPTY_META = {
    CITY: [],
    COUNTRY: [],
    PROJECT: [],
    UNIT: [],
    AREA: [],
    LINK: [],
    DEPARTMENT: [],
};

/**
 * Portal shared props helper.
 * - useMeta() → meta lists + sidebarOpen
 * - useMeta('AREA') → string[] for that meta type
 *
 * @param {keyof typeof EMPTY_META | undefined} [type]
 */
export function useMeta(type) {
    const { meta = EMPTY_META, sidebarOpen = false } = usePage().props;

    if (type) {
        return meta[type] ?? [];
    }

    return {
        ...EMPTY_META,
        ...meta,
        sidebarOpen,
    };
}

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

/**
 * Initials from a display name (e.g. "Imran Nawaz" → "IN").
 */
export function getInitials(name = '') {
    const parts = String(name)
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    if (parts[0]?.length) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return '?';
}

/**
 * Stable colored backgrounds for avatar fallbacks (readable with white text in light & dark).
 */
const AVATAR_COLORS = [
    '#3847d0',
    '#0f766e',
    '#b45309',
    '#be185d',
    '#7c3aed',
    '#0369a1',
    '#15803d',
    '#c2410c',
    '#a21caf',
    '#1d4ed8',
    '#0e7490',
    '#b91c1c',
    '#4f46e5',
    '#047857',
    '#ca8a04',
    '#9333ea',
];

export function stringToColor(value = '') {
    const str = String(value);

    if (!str) {
        return AVATAR_COLORS[0];
    }

    let hash = 0;

    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

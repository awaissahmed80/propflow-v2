import { useCallback, useEffect, useState } from 'react';

const prefersDark = () => {
    if (typeof window === 'undefined') {
        return false;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const setCookie = (name, value, days = 365) => {
    if (typeof document === 'undefined') {
        return;
    }

    const host = window.location.hostname.split('.').slice(-2).join('.');
    const maxAge = days * 24 * 60 * 60;
    document.cookie = `${name}=${value};path=/;max-age=${maxAge};SameSite=Lax;domain=.${host}`;
};

const getCookie = (name) => {
    if (typeof document === 'undefined') {
        return null;
    }

    const nameEQ = `${name}=`;
    const cookies = document.cookie.split(';');

    for (let i = 0; i < cookies.length; i += 1) {
        const cookie = cookies[i].trim();

        if (cookie.indexOf(nameEQ) === 0) {
            return cookie.substring(nameEQ.length);
        }
    }

    return null;
};

const resolveAppearance = () => getCookie('appearance') || 'system';

const applyTheme = (appearance) => {
    const mode = appearance || 'system';
    const isDark = mode === 'dark' || (mode === 'system' && prefersDark());

    document.documentElement.classList.toggle('dark', isDark);
};

const mediaQuery = () => {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.matchMedia('(prefers-color-scheme: dark)');
};

const handleSystemThemeChange = () => {
    applyTheme(resolveAppearance());
};

export function initializeTheme() {
    applyTheme(resolveAppearance());
    mediaQuery()?.addEventListener('change', handleSystemThemeChange);
}

export function useAppearance() {
    const [appearance, setAppearance] = useState(() => resolveAppearance());

    const updateAppearance = useCallback((mode) => {
        setAppearance(mode);
        setCookie('appearance', mode);
        applyTheme(mode);
    }, []);

    useEffect(() => {
        const savedAppearance = resolveAppearance();
        setAppearance(savedAppearance);
        applyTheme(savedAppearance);

        const mq = mediaQuery();
        mq?.addEventListener('change', handleSystemThemeChange);

        return () => {
            mq?.removeEventListener('change', handleSystemThemeChange);
        };
    }, []);

    return { appearance, updateAppearance };
}

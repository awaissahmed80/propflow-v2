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
    console.log('Cookie value', value)
    const host = window.location.hostname.split('.').slice(-2).join('.');        
    const maxAge = days * 24 * 60 * 60;
    document.cookie = `${name}=${value};path=/;max-age=${maxAge};SameSite=Lax;domain=.${host}`;
};

const getCookie = (name) => {
    if (typeof document === 'undefined') {
        return null;
    }

    // Match the cookie name followed by '=' and capture the value
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');

    for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim(); // Remove leading spaces
        if (c.indexOf(nameEQ) === 0) {
            return c.substring(nameEQ.length, c.length);
        }
    }
    
    return null; // Return null if the cookie doesn't exist
};

const applyTheme = (appearance) => {
    const isDark = appearance === 'dark' || (appearance === 'system' && prefersDark());

    document.documentElement.classList.toggle('dark', isDark);
};

const mediaQuery = () => {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.matchMedia('(prefers-color-scheme: dark)');
};

const handleSystemThemeChange = () => {
    const currentAppearance = localStorage.getItem('appearance');
    applyTheme(currentAppearance || 'system');
};


export function initializeTheme() {
    const cookie_theme = getCookie('appearance');
    // console.log('Cookie theme', cookie_theme)
    // const savedAppearance = localStorage.getItem('appearance') || 'system';
    // console.log('Saved appearance', savedAppearance)
    // const savedAppearance = 'light'
    // applyTheme(savedAppearance);
    // localStorage.setItem('appearance', savedAppearance);
    setCookie('appearance', cookie_theme || 'system');
    mediaQuery()?.addEventListener('change', handleSystemThemeChange);
}

export function useAppearance() {
    const [appearance, setAppearance] = useState('system');

    const updateAppearance = useCallback((mode) => {
        setAppearance(mode);        
        setCookie('appearance', mode);
        applyTheme(mode);
    }, [setAppearance]);

    useEffect(() => {
        const mq = mediaQuery();
        mq?.addEventListener('change', handleSystemThemeChange);

        return () => {
            mq?.removeEventListener('change', handleSystemThemeChange);
        };
    }, []); // Empty dependency array means this only runs once on mount.

    // useEffect(() => {
    //     const savedAppearance = localStorage.getItem('appearance');
    //     updateAppearance(savedAppearance || 'system');

    //     return () => {
    //         const mq = mediaQuery();

    //         if (mq) {
    //             mq.removeEventListener('change', handleSystemThemeChange);
    //         }
    //     };
    // }, [updateAppearance]);

    return { appearance, updateAppearance };
}
